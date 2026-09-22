import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectQueue('mail-queue') private mailQueue: Queue
  ) {}

  async sendVerificationEmail(email: string, name: string, token: string) {
    await this.mailQueue.add('email-verification', {
      email,
      name,
      token
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 }
    });
  }

  async sendPasswordResetEmail(email: string, token: string) {
    await this.mailQueue.add('password-reset', {
      email,
      token
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 }
    });
  }

  async sendAssessmentInvitation(
    invitationId: string,
    candidateEmail: string,
    candidateName: string,
    organizationName: string,
    assessmentTitle: string,
    token: string
  ) {
    await this.mailQueue.add('assessment-invitation', {
      candidateEmail,
      candidateName,
      organizationName,
      assessmentTitle,
      token
    }, {
      jobId: `invitation-${invitationId}`, // Idempotency key prevents duplicate sends
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 }
    });
  }

  async sendAssessmentSubmitted(
    attemptId: string,
    candidateEmail: string,
    candidateName: string,
    assessmentTitle: string
  ) {
    await this.mailQueue.add('assessment-submitted', {
      candidateEmail,
      candidateName,
      assessmentTitle
    }, {
      jobId: `submitted-${attemptId}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 }
    });
  }
}
