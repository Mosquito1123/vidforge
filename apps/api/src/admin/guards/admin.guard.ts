import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req?.user;
    if (!user?.id) throw new UnauthorizedException('Authentication required');

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, role: true, adminRole: true, isAdmin: true, isBanned: true, banned: true },
    });
    if (!dbUser) throw new UnauthorizedException('User not found');

    const adminValues = new Set(['admin', 'ADMIN', 'Admin', true]);
    const admin =
      dbUser.isAdmin === true ||
      adminValues.has(dbUser.role as any) ||
      adminValues.has(dbUser.adminRole as any);

    if (!admin) throw new ForbiddenException('Admin access required');
    if (dbUser.isBanned || dbUser.banned) throw new ForbiddenException('Account is banned');

    req.adminUser = dbUser;
    return true;
  }
}
@Injectable()
export class AdminRoleGuard extends AdminGuard {}
