import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { EmailProvider, MockEmailProvider, SmtpEmailProvider } from './email-provider.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });

// Initialize provider based on env
const emailProvider: EmailProvider = process.env.NODE_ENV === 'production' 
  ? new SmtpEmailProvider() 
  : new MockEmailProvider();

export async function processEmailJob(job: Job) {
  console.log(`Processing email job: ${job.name} (ID: ${job.id})`);

  switch (job.name) {
    case 'email-verification': {
      const { email, name, token } = job.data;
      const url = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
      await emailProvider.send({
        to: email,
        subject: 'Verify your email address',
        html: `
          <h1>Welcome, ${name}!</h1>
          <p>Please verify your email address by clicking the link below:</p>
          <a href="${url}">Verify Email</a>
          <p>If you did not request this, please ignore this email.</p>
        `
      });
      break;
    }
    case 'password-reset': {
      const { email, token } = job.data;
      const url = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
      await emailProvider.send({
        to: email,
        subject: 'Password Reset Request',
        html: `
          <h1>Password Reset</h1>
          <p>You requested a password reset. Click the link below to set a new password:</p>
          <a href="${url}">Reset Password</a>
          <p>If you did not request this, please ignore this email.</p>
        `
      });
      break;
    }
    case 'assessment-invitation': {
      const { candidateEmail, candidateName, token, assessmentTitle, organizationName } = job.data;
      const url = `${process.env.CANDIDATE_FRONTEND_URL || 'http://localhost:3001'}/invite?token=${token}`;
      await emailProvider.send({
        to: candidateEmail,
        subject: `You're invited to take an assessment for ${organizationName}`,
        html: `
          <h1>Hello ${candidateName},</h1>
          <p>You have been invited by <strong>${organizationName}</strong> to take the following assessment:</p>
          <h2>${assessmentTitle}</h2>
          <p>Click the link below to get started:</p>
          <a href="${url}">Start Assessment</a>
          <p>Good luck!</p>
        `
      });
      break;
    }
    case 'assessment-submitted': {
      const { candidateEmail, candidateName, assessmentTitle } = job.data;
      await emailProvider.send({
        to: candidateEmail,
        subject: `Assessment Submitted: ${assessmentTitle}`,
        html: `
          <h1>Hello ${candidateName},</h1>
          <p>Your assessment <strong>${assessmentTitle}</strong> has been successfully submitted.</p>
          <p>Thank you for completing the assessment.</p>
        `
      });
      break;
    }
    default:
      console.error(`Unknown email job type: ${job.name}`);
  }
}

const mailWorker = new Worker('mail-queue', processEmailJob, { connection });

mailWorker.on('completed', job => {
  console.log(`Mail job ${job.id} has completed!`);
});

mailWorker.on('failed', (job, err) => {
  console.error(`Mail job ${job?.id} failed:`, err);
});

console.log('Mail Worker is running and listening to mail-queue...');

export async function closeMailWorker() {
  await mailWorker.close();
}
