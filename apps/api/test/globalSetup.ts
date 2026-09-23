import { PrismaClient } from '@prisma/client';

export default async function setup() {
  const prisma = new PrismaClient();
  
  const SYSTEM_PERMISSIONS = [
    'organization.read', 'organization.update', 'member.read', 'member.invite',
    'member.update', 'member.remove', 'role.read', 'role.create', 'role.update',
    'role.delete', 'permission.read', 'assessment.create', 'assessment.read',
    'assessment.update', 'assessment.delete', 'assessment.publish',
    'interview.create', 'interview.read', 'interview.update', 'interview.delete',
    'interview.schedule', 'interview.reschedule', 'interview.cancel',
    'interview.scorecard.submit', 'interview.scorecard.read',
    'candidate.read', 'candidate.update',
  ];

  const SYSTEM_ROLES = [
    { name: 'OWNER', permissions: SYSTEM_PERMISSIONS },
    { name: 'ADMIN', permissions: SYSTEM_PERMISSIONS.filter(p => p !== 'role.delete') },
    { name: 'MEMBER', permissions: ['organization.read', 'member.read'] },
    { name: 'VIEWER', permissions: ['organization.read'] }
  ];

  try {
    for (const p of SYSTEM_PERMISSIONS) {
      await prisma.permission.upsert({
        where: { action: p },
        update: {},
        create: { action: p, description: `${p} permission` }
      });
    }

    for (const role of SYSTEM_ROLES) {
      const existing = await prisma.role.findFirst({ where: { name: role.name, isSystem: true } });
      if (!existing) {
        await prisma.role.create({
          data: {
            name: role.name,
            isSystem: true,
            permissions: {
              create: role.permissions.map(action => ({
                permission: { connect: { action } }
              }))
            }
          }
        });
      } else {
        // Ensure permissions are linked
        for (const action of role.permissions) {
          await prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: existing.id, permissionId: (await prisma.permission.findUnique({ where: { action } }))!.id } },
            update: {},
            create: { roleId: existing.id, permissionId: (await prisma.permission.findUnique({ where: { action } }))!.id }
          });
        }
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}
