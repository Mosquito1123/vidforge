import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

interface ProfileExtras {
  avatarUrl?: string | null;
  bio?: string | null;
  locale?: string;
}

@Injectable()
export class UsersService {
  private extras = new Map<string, ProfileExtras>();

  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: { id: true, email: true, name: true, createdAt: true },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, createdAt: true, creditAccount: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const ex = this.extras.get(id) || {};
    return {
      ...user,
      avatarUrl: ex.avatarUrl ?? null,
      bio: ex.bio ?? null,
      locale: ex.locale ?? 'en',
    };
  }

  async update(id: string, data: { name?: string; avatarUrl?: string | null; bio?: string | null; locale?: string }) {
    if (data.name !== undefined) {
      await this.prisma.user.update({
        where: { id },
        data: { name: data.name },
      });
    }
    const ex = this.extras.get(id) || {};
    if (data.avatarUrl !== undefined) ex.avatarUrl = data.avatarUrl;
    if (data.bio !== undefined) ex.bio = data.bio;
    if (data.locale !== undefined) ex.locale = data.locale;
    this.extras.set(id, ex);
    return this.findOne(id);
  }
}
