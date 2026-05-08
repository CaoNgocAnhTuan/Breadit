import { Injectable, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UploadsService, type BufferedFile } from '../uploads/uploads.service';
import { CacheService } from '../cache/cache.service';
import { CreateCommunityDto, UpdateCommunityDto } from './dto/community.dto';
import { CommunityRole } from '@prisma/client';

@Injectable()
export class CommunitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly uploadsService: UploadsService,
    private readonly cache: CacheService,
  ) {}

  async create(userId: string, dto: CreateCommunityDto) {
    const existing = await this.prisma.community.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) throw new ConflictException('Community slug already exists');

    return this.prisma.community.create({
      data: {
        ...dto,
        members: {
          create: {
            userId,
            role: CommunityRole.OWNER,
          },
        },
      },
    });
  }

  async findAll(q?: string, userId?: string) {
    let bannedCommunityIds: number[] = [];
    if (userId) {
      const bans = await this.prisma.communityBannedUser.findMany({
        where: { userId },
        select: { communityId: true },
      });
      bannedCommunityIds = bans.map((b) => b.communityId);
    }

    return this.prisma.community.findMany({
      where: {
        ...(bannedCommunityIds.length ? { id: { notIn: bannedCommunityIds } } : {}),
        ...(q ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { slug: { contains: q, mode: 'insensitive' } },
          ],
        } : {}),
      },
      include: {
        _count: { select: { members: true } },
      },
      take: 20,
    });
  }

  async findBySlug(slug: string, userId?: string) {
    const community = await this.prisma.community.findUnique({
      where: { slug },
      include: {
        rules: true,
        members: {
          include: {
            user: { select: { id: true, username: true, displayName: true, img: true } },
          },
          orderBy: { role: 'asc' },
        },
        _count: {
          select: {
            members: true,
            posts: { where: { isApproved: true, deletedAt: null } },
          },
        },
      },
    });

    if (!community) throw new NotFoundException('Community not found');

    let membership: any = null;
    let isBanned = false;
    if (userId) {
      [membership] = await Promise.all([
        this.prisma.communityMember.findUnique({
          where: { userId_communityId: { userId, communityId: community.id } },
        }),
      ]);
      const ban = await this.prisma.communityBannedUser.findUnique({
        where: { userId_communityId: { userId, communityId: community.id } },
      });
      isBanned = !!ban;
    }

    return { ...community, membership, isBanned };
  }

  async deleteCommunity(userId: string, communityId: number) {
    const member = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId, communityId } },
    });
    if (!member || member.role !== CommunityRole.OWNER) {
      throw new ForbiddenException('Only the community owner can delete it');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.post.updateMany({
        where: { communityId },
        data: { communityId: null, deletedAt: new Date() },
      });
      await tx.communityBannedUser.deleteMany({ where: { communityId } });
      await tx.communityRule.deleteMany({ where: { communityId } });
      await tx.communityMember.deleteMany({ where: { communityId } });
      await tx.community.delete({ where: { id: communityId } });
    });

    return { success: true };
  }

  async join(userId: string, communityId: number) {
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (!community) throw new NotFoundException('Community not found');

    const ban = await this.prisma.communityBannedUser.findUnique({
      where: { userId_communityId: { userId, communityId } },
    });
    if (ban) throw new ForbiddenException('You are banned from this community');

    const existing = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId, communityId } },
    });

    if (existing) {
      if (existing.role === CommunityRole.OWNER) {
        throw new ForbiddenException('Owners cannot leave their community');
      }
      await this.prisma.communityMember.delete({
        where: { userId_communityId: { userId, communityId } },
      });
      // Community membership graph changed.
      await this.cache.del('graph:communities', [userId]);
      await this.cache.incrNumber('v:user', [userId]);
      return { joined: false };
    }

    await this.prisma.communityMember.create({
      data: { userId, communityId, role: CommunityRole.MEMBER },
    });
    // Community membership graph changed.
    await this.cache.del('graph:communities', [userId]);
    await this.cache.incrNumber('v:user', [userId]);
    return { joined: true };
  }

  async update(userId: string, communityId: number, dto: UpdateCommunityDto) {
    const member = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId, communityId } },
    });

    if (!member || (member.role !== CommunityRole.OWNER && member.role !== CommunityRole.MOD)) {
      throw new ForbiddenException('Only owners and mods can update community settings');
    }

    return this.prisma.community.update({
      where: { id: communityId },
      data: dto,
    });
  }

  async updateImages(
    userId: string,
    communityId: number,
    files: { avatar?: BufferedFile; cover?: BufferedFile },
  ) {
    const member = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId, communityId } },
    });

    if (!member || (member.role !== CommunityRole.OWNER && member.role !== CommunityRole.MOD)) {
      throw new ForbiddenException('Only owners and mods can update community images');
    }

    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
    });
    if (!community) throw new NotFoundException('Community not found');

    const updateData: { img?: string; cover?: string } = {};

    if (files.avatar) {
      // Delete old avatar if exists
      if (community.img) {
        await this.uploadsService.deleteFile(community.img);
      }
      updateData.img = await this.uploadsService.saveFile(files.avatar, 'square');
    }

    if (files.cover) {
      // Delete old cover if exists
      if (community.cover) {
        await this.uploadsService.deleteFile(community.cover);
      }
      updateData.cover = await this.uploadsService.saveFile(files.cover, 'wide');
    }

    if (Object.keys(updateData).length === 0) {
      return community;
    }

    return this.prisma.community.update({
      where: { id: communityId },
      data: updateData,
    });
  }

  async addRule(userId: string, communityId: number, title: string, description?: string) {
    const member = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId, communityId } },
    });

    if (!member || (member.role !== CommunityRole.OWNER && member.role !== CommunityRole.MOD)) {
      throw new ForbiddenException('Only owners and mods can manage rules');
    }

    return this.prisma.communityRule.create({
      data: { communityId, title, description },
    });
  }

  async removeRule(userId: string, communityId: number, ruleId: number) {
    const member = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId, communityId } },
    });

    if (!member || (member.role !== CommunityRole.OWNER && member.role !== CommunityRole.MOD)) {
      throw new ForbiddenException('Only owners and mods can manage rules');
    }

    const rule = await this.prisma.communityRule.findUnique({ where: { id: ruleId } });
    if (!rule || rule.communityId !== communityId) throw new NotFoundException('Rule not found');

    await this.prisma.communityRule.delete({ where: { id: ruleId } });
    return { success: true };
  }

  async banUser(userId: string, communityId: number, targetUserId: string, reason?: string) {
    const member = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId, communityId } },
    });

    if (!member || (member.role !== CommunityRole.OWNER && member.role !== CommunityRole.MOD)) {
      throw new ForbiddenException('Only owners and mods can ban users');
    }

    // Check if target is owner
    const targetMember = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId: targetUserId, communityId } },
    });
    if (targetMember?.role === CommunityRole.OWNER) {
      throw new ForbiddenException('Cannot ban the community owner');
    }

    await this.prisma.$transaction([
      this.prisma.communityBannedUser.upsert({
        where: { userId_communityId: { userId: targetUserId, communityId } },
        create: { userId: targetUserId, communityId, reason },
        update: { reason },
      }),
      this.prisma.communityMember.deleteMany({
        where: { userId: targetUserId, communityId },
      }),
    ]);

    return { success: true };
  }

  async getBannedUsers(userId: string, communityId: number) {
    const member = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId, communityId } },
    });
    if (!member || (member.role !== CommunityRole.OWNER && member.role !== CommunityRole.MOD)) {
      throw new ForbiddenException('Only owners and mods can view banned users');
    }

    return this.prisma.communityBannedUser.findMany({
      where: { communityId },
      include: {
        user: { select: { id: true, username: true, displayName: true, img: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async unbanUser(userId: string, communityId: number, targetUserId: string) {
    const member = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId, communityId } },
    });

    if (!member || (member.role !== CommunityRole.OWNER && member.role !== CommunityRole.MOD)) {
      throw new ForbiddenException('Only owners and mods can unban users');
    }

    await this.prisma.communityBannedUser.delete({
      where: { userId_communityId: { userId: targetUserId, communityId } },
    });
    return { success: true };
  }

  async promoteMember(userId: string, communityId: number, targetUserId: string, role: CommunityRole) {
    const member = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId, communityId } },
    });

    if (!member || member.role !== CommunityRole.OWNER) {
      throw new ForbiddenException('Only owners can promote members');
    }

    if (role === CommunityRole.OWNER) {
      throw new ForbiddenException('Use transferOwnership to change owner');
    }

    const targetMember = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId: targetUserId, communityId } },
    });
    if (!targetMember) throw new NotFoundException('User is not a member of this community');

    await this.prisma.communityMember.update({
      where: { userId_communityId: { userId: targetUserId, communityId } },
      data: { role },
    });

    return { success: true };
  }

  async transferOwnership(userId: string, communityId: number, newOwnerId: string) {
    const member = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId, communityId } },
    });

    if (!member || member.role !== CommunityRole.OWNER) {
      throw new ForbiddenException('Only owners can transfer ownership');
    }

    const newOwnerMember = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId: newOwnerId, communityId } },
    });
    if (!newOwnerMember) throw new NotFoundException('New owner is not a member of this community');

    await this.prisma.$transaction([
      this.prisma.communityMember.update({
        where: { userId_communityId: { userId, communityId } },
        data: { role: CommunityRole.MOD },
      }),
      this.prisma.communityMember.update({
        where: { userId_communityId: { userId: newOwnerId, communityId } },
        data: { role: CommunityRole.OWNER },
      }),
    ]);

    return { success: true };
  }

  async moderatePost(userId: string, communityId: number, postId: number, action: 'APPROVE' | 'REMOVE') {
    const member = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId, communityId } },
    });

    if (!member || (member.role !== CommunityRole.OWNER && member.role !== CommunityRole.MOD)) {
      throw new ForbiddenException('Only owners and mods can moderate posts');
    }

    const post = await this.prisma.post.findFirst({ where: { id: postId, communityId } });
    if (!post) throw new NotFoundException('Post not found in this community');

    if (action === 'APPROVE') {
      await this.prisma.post.update({ where: { id: postId }, data: { isApproved: true } });

      // Notify all community members (except the post author) about the new post
      const communityMembers = await this.prisma.communityMember.findMany({
        where: { communityId },
        select: { userId: true },
      });
      void Promise.all(
        communityMembers
          .filter((m) => m.userId !== post.userId)
          .map((m) => this.notificationsService.emit('COMMUNITY_NEW_POST', post.userId, m.userId, postId)),
      );
    } else {
      await this.prisma.post.update({ where: { id: postId }, data: { deletedAt: new Date() } });
    }

    return { success: true };
  }

  async getPendingPosts(userId: string, communityId: number) {
    const member = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId, communityId } },
    });
    if (!member || (member.role !== CommunityRole.OWNER && member.role !== CommunityRole.MOD)) {
      throw new ForbiddenException('Only owners and mods can view pending posts');
    }

    return this.prisma.post.findMany({
      where: { communityId, isApproved: false, deletedAt: null },
      include: {
        user: { select: { username: true, displayName: true, img: true } },
        media: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
