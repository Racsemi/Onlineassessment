import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import * as argon2 from 'argon2';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let notificationsService: NotificationsService;

  const mockPrismaService = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    userSession: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      updateMany: vi.fn(),
    },
    emailVerificationToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    passwordResetToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };

  const mockNotificationsService = {
    sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    notificationsService = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
      });

      const result = await service.register({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      });

      expect(result.success).toBe(true);
      expect(result.data.email).toBe('test@example.com');
      expect(mockNotificationsService.sendVerificationEmail).toHaveBeenCalledWith(
        'test@example.com',
        'Test User',
        expect.any(String)
      );
    });

    it('should throw ConflictException if email exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: '1' });

      await expect(service.register({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      })).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should return a session token on valid credentials', async () => {
      const passwordHash = await argon2.hash('password123');
      
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        password: passwordHash,
        status: 'ACTIVE',
      });
      mockPrismaService.userSession.create.mockResolvedValue({});

      const result = await service.login(
        { email: 'test@example.com', password: 'password123' },
        '127.0.0.1',
        'test-agent'
      );

      expect(result.sessionToken).toBeDefined();
      expect(result.user.id).toBe('1');
    });

    it('should throw UnauthorizedException on invalid password', async () => {
      const passwordHash = await argon2.hash('password123');
      
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        password: passwordHash,
        status: 'ACTIVE',
      });

      await expect(service.login(
        { email: 'test@example.com', password: 'wrongpassword' },
        '127.0.0.1',
        'test-agent'
      )).rejects.toThrow(UnauthorizedException);
    });
  });
});
