import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ThrottlerGuard } from '@nestjs/throttler';
import { vi } from 'vitest';

const originalCreate = Test.createTestingModule;
Test.createTestingModule = (metadata) => {
  const builder = originalCreate.call(Test, metadata);
  return builder
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .overrideProvider(getQueueToken('mail-queue'))
    .useValue({ add: vi.fn().mockResolvedValue({ id: 'mock-job' }), on: vi.fn(), close: vi.fn() })
    .overrideProvider(getQueueToken('evaluation-queue'))
    .useValue({ add: vi.fn().mockResolvedValue({ id: 'mock-job' }), on: vi.fn(), close: vi.fn() });
};
