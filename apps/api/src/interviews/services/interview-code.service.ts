import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export interface CodeExecutionResult {
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  status: 'SUCCESS' | 'RUNTIME_ERROR' | 'TIMEOUT';
}

@Injectable()
export class InterviewCodeService {
  private readonly logger = new Logger(InterviewCodeService.name);
  private readonly workspaceBase = path.join(process.cwd(), 'scratch', 'interview_exec');

  constructor(private prisma: PrismaService) {}

  async executeCode(
    interviewId: string,
    language: 'javascript' | 'python',
    code: string,
    stdin: string = ''
  ): Promise<CodeExecutionResult> {
    const execId = crypto.randomBytes(8).toString('hex');
    const workDir = path.join(this.workspaceBase, execId);
    await fs.mkdir(workDir, { recursive: true });

    const startTime = Date.now();
    const timeLimitMs = 5000;

    let childCommand = '';
    let childArgs: string[] = [];

    try {
      if (language === 'javascript') {
        const filePath = path.join(workDir, 'solution.js');
        await fs.writeFile(filePath, code, 'utf8');
        childCommand = 'node';
        childArgs = ['--max-old-space-size=128', filePath];
      } else if (language === 'python') {
        const filePath = path.join(workDir, 'solution.py');
        await fs.writeFile(filePath, code, 'utf8');
        childCommand = 'python';
        childArgs = ['-u', filePath];
      } else {
        throw new Error(`Unsupported language: ${language}`);
      }

      const result = await new Promise<CodeExecutionResult>((resolve) => {
        let stdout = '';
        let stderr = '';
        let timedOut = false;

        const proc = spawn(childCommand, childArgs, {
          cwd: workDir,
          env: { PATH: process.env.PATH },
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        const timer = setTimeout(() => {
          timedOut = true;
          proc.kill('SIGKILL');
        }, timeLimitMs);

        if (stdin) {
          proc.stdin.write(stdin);
        }
        proc.stdin.end();

        proc.stdout.on('data', (data) => {
          if (stdout.length < 50000) stdout += data.toString();
        });

        proc.stderr.on('data', (data) => {
          if (stderr.length < 50000) stderr += data.toString();
        });

        proc.on('close', (code) => {
          clearTimeout(timer);
          const executionTimeMs = Date.now() - startTime;

          if (timedOut) {
            resolve({
              stdout,
              stderr: stderr + '\nExecution timed out (5s limit)',
              executionTimeMs,
              status: 'TIMEOUT',
            });
          } else if (code === 0) {
            resolve({
              stdout,
              stderr,
              executionTimeMs,
              status: 'SUCCESS',
            });
          } else {
            resolve({
              stdout,
              stderr,
              executionTimeMs,
              status: 'RUNTIME_ERROR',
            });
          }
        });

        proc.on('error', (err) => {
          clearTimeout(timer);
          resolve({
            stdout: '',
            stderr: `Execution error: ${err.message}`,
            executionTimeMs: Date.now() - startTime,
            status: 'RUNTIME_ERROR',
          });
        });
      });

      // Update or create active coding session record
      await this.prisma.interviewCodingSession.upsert({
        where: { id: `session_${interviewId}` },
        update: {
          language,
          code,
          updatedAt: new Date(),
        },
        create: {
          id: `session_${interviewId}`,
          interviewId,
          title: 'Live Technical Challenge',
          description: 'In-interview coding session',
          language,
          code,
        },
      }).catch((e) => this.logger.warn(`Failed to persist coding session: ${e.message}`));

      return result;
    } finally {
      // Clean up ephemeral workspace
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
