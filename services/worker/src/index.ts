import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const prisma = new PrismaClient();
const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });

import { closeMailWorker } from './email-worker.js';

const WORKSPACE_BASE = path.join(process.cwd(), 'workspaces');

async function ensureWorkspace(jobId: string) {
  const dir = path.join(WORKSPACE_BASE, jobId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function cleanupWorkspace(jobId: string) {
  const dir = path.join(WORKSPACE_BASE, jobId);
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
}

async function processAttemptEvaluation(job: Job) {
  const { attemptId } = job.data;
  console.log(`Processing complete evaluation for attempt ${attemptId}`);

  const attempt = await prisma.assessmentAttempt.findUnique({
    where: { id: attemptId },
    include: {
      assessmentVersion: true,
      answers: true,
      evaluationResults: true
    }
  });

  if (!attempt) throw new Error('Attempt not found');

  const snapshot = attempt.assessmentVersion.snapshot as any;
  const sections = snapshot.sections || [];
  
  let totalScore = 0;
  let maximumScore = 0;

  const newEvaluationResults = [];

  for (const section of sections) {
    for (const question of section.questions || []) {
      maximumScore += question.points || 0;

      // Check if it's CODING
      if (question.type === 'CODING') {
        const existingResult = attempt.evaluationResults.find(e => e.questionId === question.id);
        if (existingResult) {
          totalScore += existingResult.score;
        }
        continue; // Coding is evaluated asynchronously during the test, we just aggregate it.
      }

      const answer = attempt.answers.find(a => a.questionId === question.id);
      let status = 'INCORRECT';
      let score = 0;

      if (!answer) {
        status = 'INCORRECT';
        score = 0;
      } else {
        const candidateAns = answer.answerData as any;
        
        if (question.type === 'MCQ_SINGLE' || question.type === 'TRUE_FALSE') {
          const correctOption = question.options?.find((o: any) => o.isCorrect);
          if (correctOption && candidateAns?.optionId === correctOption.id) {
            status = 'ACCEPTED';
            score = question.points;
          }
        } else if (question.type === 'MCQ_MULTI') {
          const correctOptions = question.options?.filter((o: any) => o.isCorrect).map((o: any) => o.id) || [];
          const candidateOptions = candidateAns?.optionIds || [];
          
          if (correctOptions.length === candidateOptions.length && correctOptions.every((id: string) => candidateOptions.includes(id))) {
            status = 'ACCEPTED';
            score = question.points;
          }
        } else if (question.type === 'SHORT_ANSWER') {
          const expected = (question.configuration?.expectedAnswer || '').trim().toLowerCase();
          const provided = (candidateAns?.text || '').trim().toLowerCase();
          if (expected && provided === expected) {
            status = 'ACCEPTED';
            score = question.points;
          }
        }
      }

      totalScore += score;

      // Upsert Question Result for Objective Question
      await prisma.evaluationResult.upsert({
        where: { attemptId_questionId: { attemptId, questionId: question.id } },
        update: { status, score, testCaseResults: [] },
        create: {
          attemptId,
          questionId: question.id,
          status,
          score,
          testCaseResults: []
        }
      });
    }
  }

  const percentage = maximumScore > 0 ? (totalScore / maximumScore) * 100 : 0;
  
  const passingScore = snapshot.settings?.passingScore || 50;
  const resultStatus = percentage >= passingScore ? 'PASSED' : 'FAILED';

  await prisma.attemptResult.upsert({
    where: { attemptId },
    update: {
      score: totalScore,
      maximumScore,
      percentage,
      status: resultStatus,
      evaluatedAt: new Date()
    },
    create: {
      attemptId,
      score: totalScore,
      maximumScore,
      percentage,
      status: resultStatus
    }
  });

  return { success: true, score: totalScore, percentage, status: resultStatus };
}

export async function processJob(job: Job) {
  if (job.name === 'evaluate-attempt') {
    return processAttemptEvaluation(job);
  }

  // Default fallback (evaluate-code)
  const { attemptId, questionId, language } = job.data;
  console.log(`Processing evaluation for attempt ${attemptId}, question ${questionId}`);

  // Fetch Attempt and Answer
  const attempt = await prisma.assessmentAttempt.findUnique({
    where: { id: attemptId },
    include: { assessmentVersion: true }
  });

  if (!attempt) throw new Error('Attempt not found');

  const answer = await prisma.attemptAnswer.findUnique({
    where: { attemptId_questionId: { attemptId, questionId } }
  });

  if (!answer) throw new Error('Answer not found');

  const sourceCode = (answer.answerData as any)?.code || '';

  // Extract Question config for Test Cases
  const snapshot = attempt.assessmentVersion.snapshot as any;
  let question: any = null;
  for (const s of snapshot.sections) {
    question = s.questions.find((q: any) => q.id === questionId);
    if (question) break;
  }

  if (!question || question.type !== 'CODING') {
    throw new Error('Invalid coding question');
  }

  const testCases = question.configuration?.testCases || [];
  const timeLimit = question.configuration?.timeLimit || 2000;
  const memoryLimit = question.configuration?.memoryLimit || 128; // MB

  const workspace = await ensureWorkspace(job.id!);

  let overallStatus = 'ACCEPTED';
  let overallScore = 0;
  const testCaseResults = [];

  try {
    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const tcId = tc.id || `tc-${i}`;
      let status = 'ACCEPTED';
      let timeMs = 0;
      let compilerOutput = '';
      
      const tcWorkspace = path.join(workspace, tcId);
      await fs.mkdir(tcWorkspace, { recursive: true });

      // Language specifics
      let imageName = '';
      let command = '';
      let runCmd = '';
      
      if (language === 'javascript') {
        imageName = 'node:20-alpine';
        await fs.writeFile(path.join(tcWorkspace, 'index.js'), sourceCode);
        runCmd = `node index.js`;
      } else if (language === 'python') {
        imageName = 'python:3.11-alpine';
        await fs.writeFile(path.join(tcWorkspace, 'main.py'), sourceCode);
        runCmd = `python main.py`;
      } else {
        throw new Error('Unsupported language');
      }

      // We pass the test case input via stdin or file. Let's create an input file.
      await fs.writeFile(path.join(tcWorkspace, 'input.txt'), tc.input || '');

      // Run securely using Docker
      // - network none
      // - cpu limits
      // - memory limits
      // - pids limit
      // - user nobody
      // - read-only base, only workspace mounted as read-write
      const startTime = Date.now();
      try {
        const dockerArgs = [
          'run', '--rm', '-i',
          '--network', 'none',
          `--cpus=0.5`,
          `--memory=${memoryLimit}m`,
          '--pids-limit=64',
          '--security-opt=no-new-privileges:true',
          '--cap-drop=ALL',
          '--user', 'nobody',
          '-v', `${tcWorkspace}:/workspace:rw`,
          '-w', '/workspace',
          imageName,
          ...runCmd.split(' ')
        ];
        
        const outputBuffer: Buffer[] = [];
        let timeLimitExceeded = false;
        
        await new Promise<void>((resolve, reject) => {
          const { spawn } = require('child_process');
          const child = spawn('docker', dockerArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
          
          let timer: any;
          if (timeLimit > 0) {
            timer = setTimeout(() => {
              timeLimitExceeded = true;
              child.kill('SIGKILL');
            }, timeLimit + 1000);
          }

          child.stdin.write(tc.input || '');
          child.stdin.end();

          child.stdout.on('data', (data: Buffer) => {
            outputBuffer.push(data);
          });
          
          // Do not capture stderr for candidate output directly to avoid leakage, but keep it for debug if needed
          let errBuffer = '';
          child.stderr.on('data', (data: Buffer) => {
            errBuffer += data.toString();
          });

          child.on('close', (code: number, signal: string) => {
            if (timer) clearTimeout(timer);
            if (timeLimitExceeded || signal === 'SIGKILL' || code === 137 || code === 124) {
               return reject({ code: 137, killed: true });
            }
            if (code !== 0) {
               return reject({ code, message: 'Runtime error' });
            }
            resolve();
          });
          
          child.on('error', (err: Error) => {
            if (timer) clearTimeout(timer);
            reject(err);
          });
        });

        timeMs = Date.now() - startTime;
        const output = Buffer.concat(outputBuffer).toString('utf-8').trim();
        const expected = (tc.output || '').trim();

        if (output !== expected) {
          status = 'WRONG_ANSWER';
          overallStatus = 'WRONG_ANSWER';
          compilerOutput = 'Output mismatch';
        }

      } catch (err: any) {
        console.error('Docker execution error:', err);
        timeMs = Date.now() - startTime;
        if (err.killed || err.code === 137) {
           status = 'TIME_LIMIT_EXCEEDED';
           overallStatus = 'TIME_LIMIT_EXCEEDED';
        } else {
           status = 'RUNTIME_ERROR';
           overallStatus = 'RUNTIME_ERROR';
           compilerOutput = err.message;
        }
      }

      testCaseResults.push({
        testCaseId: tcId,
        status,
        timeMs
      });
      
      if (status === 'ACCEPTED') {
        overallScore += (1 / testCases.length) * question.points;
      }
    }

    await prisma.evaluationResult.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      update: {
        status: overallStatus,
        score: overallScore,
        testCaseResults,
      },
      create: {
        attemptId,
        questionId,
        status: overallStatus,
        score: overallScore,
        testCaseResults,
      }
    });

  } finally {
    await cleanupWorkspace(job.id!);
  }
}

const worker = new Worker('evaluation-queue', processJob, { connection });

worker.on('completed', job => {
  console.log(`${job.id} has completed!`);
});

worker.on('failed', (job, err) => {
  console.log(`${job?.id} has failed with ${err.message}`);
});

console.log('Worker is running and listening to evaluation-queue...');

export async function closeWorker() {
  await worker.close();
  await closeMailWorker();
  connection.disconnect();
}
