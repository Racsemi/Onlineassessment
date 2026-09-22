import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SYSTEM_PERMISSIONS = [
  'organization.read',
  'organization.update',
  'member.read',
  'member.invite',
  'member.update',
  'member.remove',
  'role.read',
  'role.create',
  'role.update',
  'role.delete',
  'permission.read',
  'assessment.create',
  'assessment.read',
  'assessment.update',
  'assessment.delete',
  'assessment.publish',
];

const SYSTEM_ROLES = [
  {
    name: 'OWNER',
    description: 'Organization Owner with full privileges',
    permissions: SYSTEM_PERMISSIONS, // Owner gets everything
  },
  {
    name: 'ADMIN',
    description: 'Organization Administrator',
    // Admins get everything except deleting roles and removing owners, etc.
    permissions: SYSTEM_PERMISSIONS.filter(p => p !== 'role.delete'),
  },
  {
    name: 'MEMBER',
    description: 'Standard Organization Member',
    permissions: ['organization.read', 'member.read'],
  },
  {
    name: 'VIEWER',
    description: 'Read-only Organization Viewer',
    permissions: ['organization.read'],
  }
];

async function main() {
  console.log('Start seeding...');

  // Seed permissions
  for (const action of SYSTEM_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { action },
      update: {},
      create: {
        action,
        description: `System permission for ${action}`,
      },
    });
  }

  // Seed global roles
  for (const roleData of SYSTEM_ROLES) {
    const role = await prisma.role.upsert({
      where: {
        organizationId_name: {
          organizationId: '', // Wait, organizationId is nullable.
          // Prisma unique constraints on nulls: 
          // @@unique([organizationId, name]) doesn't work well for finding if orgId is null in upsert depending on Prisma version.
          // Let's use findFirst instead for safety.
        } as any // we'll use findFirst/create pattern below
      },
      update: {},
      create: {
        name: roleData.name,
        description: roleData.description,
        isSystem: true,
      },
    });
  }
}

async function safeSeed() {
  for (const action of SYSTEM_PERMISSIONS) {
    const exists = await prisma.permission.findUnique({ where: { action } });
    if (!exists) {
      await prisma.permission.create({ data: { action, description: `System permission: ${action}` } });
    }
  }

  for (const roleDef of SYSTEM_ROLES) {
    let role = await prisma.role.findFirst({ where: { name: roleDef.name, organizationId: null } });
    if (!role) {
      role = await prisma.role.create({
        data: {
          name: roleDef.name,
          description: roleDef.description,
          isSystem: true,
        }
      });
    }

    // Assign permissions
    const perms = await prisma.permission.findMany({
      where: { action: { in: roleDef.permissions } }
    });

    for (const p of perms) {
      const rpExists = await prisma.rolePermission.findUnique({
        where: { roleId_permissionId: { roleId: role.id, permissionId: p.id } }
      });
      if (!rpExists) {
        await prisma.rolePermission.create({
          data: { roleId: role.id, permissionId: p.id }
        });
      }
    }
  }
}

safeSeed()
  .then(async () => {
    console.log('Seeding finished.');
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
