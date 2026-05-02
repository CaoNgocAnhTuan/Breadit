import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CommunitiesService } from './communities.service';
import { AddRuleDto, CreateCommunityDto, UpdateCommunityDto } from './dto/community.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { BannedUserGuard } from '../auth/banned-user.guard';
import { EmailVerifiedGuard } from '../auth/email-verified.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt.guard';
import type { FastifyRequest } from 'fastify';

type AuthedRequest = FastifyRequest & {
  user?: { id: string; username: string };
};

@Controller('api/communities')
export class CommunitiesController {
  constructor(private readonly communitiesService: CommunitiesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  create(@Req() req: AuthedRequest, @Body() dto: CreateCommunityDto) {
    return this.communitiesService.create(req.user!.id, dto);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  findAll(@Query('q') q: string | undefined, @Req() req: AuthedRequest) {
    return this.communitiesService.findAll(q, req.user?.id);
  }

  @Get(':slug')
  @UseGuards(OptionalJwtAuthGuard)
  findBySlug(@Param('slug') slug: string, @Req() req: AuthedRequest) {
    return this.communitiesService.findBySlug(slug, req.user?.id);
  }

  @Post(':id/join')
  @UseGuards(JwtAuthGuard, BannedUserGuard)
  join(@Req() req: AuthedRequest, @Param('id', ParseIntPipe) id: number) {
    return this.communitiesService.join(req.user!.id, id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, BannedUserGuard)
  update(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCommunityDto,
  ) {
    return this.communitiesService.update(req.user!.id, id, dto);
  }

  @Post(':id/rules')
  @UseGuards(JwtAuthGuard, BannedUserGuard)
  addRule(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddRuleDto,
  ) {
    return this.communitiesService.addRule(req.user!.id, id, dto.title, dto.description);
  }

  @Delete(':id/rules/:ruleId')
  @UseGuards(JwtAuthGuard, BannedUserGuard)
  removeRule(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Param('ruleId', ParseIntPipe) ruleId: number,
  ) {
    return this.communitiesService.removeRule(req.user!.id, id, ruleId);
  }

  @Post(':id/ban/:targetUserId')
  @UseGuards(JwtAuthGuard, BannedUserGuard)
  banUser(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Param('targetUserId') targetUserId: string,
    @Body('reason') reason?: string,
  ) {
    return this.communitiesService.banUser(req.user!.id, id, targetUserId, reason);
  }

  @Get(':id/bans')
  @UseGuards(JwtAuthGuard)
  getBannedUsers(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.communitiesService.getBannedUsers(req.user!.id, id);
  }

  @Delete(':id/ban/:targetUserId')
  @UseGuards(JwtAuthGuard, BannedUserGuard)
  unbanUser(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.communitiesService.unbanUser(req.user!.id, id, targetUserId);
  }

  @Post(':id/promote/:targetUserId')
  @UseGuards(JwtAuthGuard, BannedUserGuard)
  promoteMember(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Param('targetUserId') targetUserId: string,
    @Body('role') role: any,
  ) {
    return this.communitiesService.promoteMember(req.user!.id, id, targetUserId, role);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, BannedUserGuard)
  deleteCommunity(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.communitiesService.deleteCommunity(req.user!.id, id);
  }

  @Post(':id/transfer/:newOwnerId')
  @UseGuards(JwtAuthGuard, BannedUserGuard)
  transferOwnership(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Param('newOwnerId') newOwnerId: string,
  ) {
    return this.communitiesService.transferOwnership(req.user!.id, id, newOwnerId);
  }

  @Get(':id/posts/pending')
  @UseGuards(JwtAuthGuard)
  getPendingPosts(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.communitiesService.getPendingPosts(req.user!.id, id);
  }

  @Post(':id/posts/:postId/moderate')
  @UseGuards(JwtAuthGuard, BannedUserGuard)
  moderatePost(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Param('postId', ParseIntPipe) postId: number,
    @Body('action') action: 'APPROVE' | 'REMOVE',
  ) {
    return this.communitiesService.moderatePost(req.user!.id, id, postId, action);
  }
}
