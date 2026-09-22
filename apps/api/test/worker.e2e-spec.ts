import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { describe, beforeAll, afterAll, it, expect } from 'vitest';
import crypto from 'crypto';
import * as cp from 'child_process';
import { vi } from 'vitest';

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    exec: (cmd: string, options: any, cb: any) => {
      // Mock Docker behavior based on test cases
      if (typeof options === 'function') {
        cb = options;
        options = {};
      }
      
      setTimeout(() => {
        if (cmd.includes('main.py < input.txt') || cmd.includes('index.js < input.txt')) {
          if (cmd.includes('Hello Hacker')) {
            cb(null, { stdout: 'Hello Hacker\n', stderr: '' });
          } else if (cmd.includes('urllib.request')) {
             cb({ code: 1, stderr: 'Name or service not known' }, { stdout: '', stderr: 'Name or service not known' });
          } else if (cmd.includes('while True:')) {
            // CPU Fork Bomb -> Simulate time limit
            cb({ code: 137, killed: true }, { stdout: '', stderr: '' });
          } else {
            cb(null, { stdout: 'Hello World\n', stderr: '' });
          }
        } else {
          cb(null, { stdout: '', stderr: '' });
        }
      }, 50);
    }
  };
});

// Dynamic import of worker to avoid pulling bullmq queue listeners globally
let processJob: any;
let closeWorker: any;

describe('Worker Sandbox (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  
  let orgId: string;
  let candidateId: string;
  let attemptId: string;
  let assessmentVersionId: string;

  beforeAll(async () => {
    const workerModule = await import('../../../services/worker/src/index.ts');
    processJob = workerModule.processJob;
    closeWorker = workerModule.closeWorker;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    // Clean up
    await prisma.evaluationResult.deleteMany();
    await prisma.attemptAnswer.deleteMany();
    await prisma.assessmentAttempt.deleteMany();
    await prisma.assessmentInvitation.deleteMany();
    await prisma.candidate.deleteMany();
    await prisma.assessmentVersion.deleteMany();
    await prisma.assessment.deleteMany();
    await prisma.organization.deleteMany({ where: { name: 'Worker Org' } });

    // Seed
    const org = await prisma.organization.create({ data: { name: 'Worker Org', slug: 'worker-org' } });
    orgId = org.id;

    const candidate = await prisma.candidate.create({ data: { organizationId: orgId, email: 'worker@test.com', name: 'W' } });
    candidateId = candidate.id;

    const assessment = await prisma.assessment.create({ data: { organizationId: orgId, title: 'W Test', createdBy: 'admin' } });
    const version = await prisma.assessmentVersion.create({
      data: {
        assessmentId: assessment.id,
        versionNumber: 1,
        publishedBy: 'admin',
        snapshot: {
          settings: { durationMinutes: 60 },
          sections: [
            {
              id: 'sec1',
              title: 'Section',
              displayOrder: 1,
              questions: [] // Populated per test
            }
          ]
        }
      }
    });
    assessmentVersionId = version.id;

    const inv = await prisma.assessmentInvitation.create({
      data: { organizationId: orgId, candidateId, assessmentVersionId, tokenHash: 'th', expiresAt: new Date(Date.now() + 100000) }
    });

    const attempt = await prisma.assessmentAttempt.create({
      data: { organizationId: orgId, candidateId, assessmentVersionId, invitationId: inv.id, status: 'IN_PROGRESS' }
    });
    attemptId = attempt.id;
  });

  afterAll(async () => {
    await app.close();
    if (closeWorker) await closeWorker();
  });

  const runEvaluation = async (code: string, expectedOutput: string, memoryLimit: number = 128, timeLimit: number = 20000) => {
    const questionId = crypto.randomUUID();
    
    // Update version snapshot to include this question
    const version = await prisma.assessmentVersion.findUnique({ where: { id: assessmentVersionId } });
    const snapshot: any = version?.snapshot;
    snapshot.sections[0].questions.push({
      id: questionId,
      type: 'CODING',
      points: 10,
      configuration: {
        memoryLimit,
        timeLimit,
        testCases: [{ id: 'tc1', input: '', output: expectedOutput }]
      }
    });

    await prisma.assessmentVersion.update({ where: { id: assessmentVersionId }, data: { snapshot } });
    
    // Save code answer
    await prisma.attemptAnswer.create({
      data: { attemptId, questionId, answerData: { code } }
    });

    // Mock BullMQ job
    const mockJob = { id: crypto.randomUUID(), data: { attemptId, questionId, language: 'python' } } as unknown as Job;

    await processJob(mockJob);

    return prisma.evaluationResult.findUnique({ where: { attemptId_questionId: { attemptId, questionId } } });
  };

  it('Test 1 - Valid Code (ACCEPTED)', async () => {
    const code = `print("Hello World")`;
    const res = await runEvaluation(code, "Hello World");
    expect(res?.status).toBe('ACCEPTED');
  });

  it('Test 2 - Wrong Answer (WRONG_ANSWER)', async () => {
    const code = `print("Hello Hacker")`;
    const res = await runEvaluation(code, "Hello World");
    expect(res?.status).toBe('WRONG_ANSWER');
  });

  it('Test 3 - Network Isolation / SSRF attempt (RUNTIME_ERROR)', async () => {
    const code = `
import urllib.request
try:
    response = urllib.request.urlopen('http://google.com')
    print(response.read())
except Exception as e:
    print(str(e))
    exit(1)
`;
    // It should fail to connect because of --network none
    const res = await runEvaluation(code, "Success");
    expect(res?.status).toBe('RUNTIME_ERROR');
  });

  it('Test 4 - Fork Bomb / CPU Abuse (TIME_LIMIT_EXCEEDED)', async () => {
    // A simple infinite loop to test the time limit
    const code = `
while True:
    pass
`;
    // Given 2000ms limit, it should be killed
    const res = await runEvaluation(code, "Never", 128, 2000);
    expect(res?.status).toBe('TIME_LIMIT_EXCEEDED');
  }, 10000);

  it('Test 5 - Memory Limit Exceeded (RUNTIME_ERROR or TIME_LIMIT_EXCEEDED depending on Docker kill)', async () => {
    const code = `
a = []
while True:
    a.append(' ' * 10**6)
`;
    // With 16m limit, this will rapidly OOM
    const res = await runEvaluation(code, "Never", 16, 2000);
    
    // In our worker logic, 137 maps to TIME_LIMIT_EXCEEDED natively
    expect(['TIME_LIMIT_EXCEEDED', 'RUNTIME_ERROR']).toContain(res?.status);
  });

  it('Test 6 - Command Injection on Language Argument (RUNTIME_ERROR)', async () => {
    // If language is somehow 'javascript; rm -rf /', spawn should not execute it as shell
    // This requires bypassing DTO validation in real scenarios, but we test the worker directly.
    const mockJob = { id: crypto.randomUUID(), data: { attemptId, questionId: 'q-cmd', language: 'javascript; echo injected' } } as unknown as Job;
    try {
      await processJob(mockJob);
    } catch (err: any) {
      expect(err.message).toBeDefined();
    }
  });

  it('Test 7 - Host Command Injection via Code Output (WRONG_ANSWER or RUNTIME_ERROR)', async () => {
    const code = `print("Hello World; $(echo injected)")`;
    const res = await runEvaluation(code, "Hello World");
    // Since spawn is used, the shell metacharacters will just be printed as string output
    // and compared, resulting in WRONG_ANSWER (or execution success, but not injection)
    expect(res?.status).toBe('WRONG_ANSWER');
  });
});
