import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsOptional } from 'class-validator';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { BannedUserGuard } from '../auth/banned-user.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt.guard';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';

class ToggleFollowDto {
  @IsOptional()
  @IsBoolean()
  notify?: boolean;
}

type AuthedRequest = FastifyRequest & {
  user?: { id: string; username: string };
};

@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post(':id/block')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, BannedUserGuard)
  toggleBlock(@Param('id') targetId: string, @Req() req: AuthedRequest) {
    return this.usersService.toggleBlock(req.user!.id, targetId);
  }

  @Post(':id/follow')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, BannedUserGuard)
  toggleFollow(
    @Param('id') targetId: string,
    @Body() body: ToggleFollowDto,
    @Req() req: AuthedRequest,
  ) {
    return this.usersService.toggleFollow(req.user!.id, targetId, body.notify);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard, BannedUserGuard)
  updateProfile(@Req() req: AuthedRequest, @Body() dto: UpdateUserDto) {
    return this.usersService.updateProfile(req.user!.id, dto);
  }

  @Get('me/following/search')
  @UseGuards(JwtAuthGuard)
  searchFollowing(
    @Req() req: AuthedRequest,
    @Query('q') q: string,
  ) {
    return this.usersService.searchFollowing(req.user!.id, q ?? '');
  }

  @Get('recommendations')
  @UseGuards(JwtAuthGuard)
  getRecommendations(@Req() req: AuthedRequest) {
    return this.usersService.getRecommendations(req.user!.id);
  }

  @Get('connect')
  @UseGuards(JwtAuthGuard)
  getConnectUsers(
    @Req() req: AuthedRequest,
    @Query('cursor') cursor: string,
  ) {
    return this.usersService.getConnectUsers(req.user!.id, parseInt(cursor ?? '1', 10));
  }

  @Get('me/blocked')
  @UseGuards(JwtAuthGuard, BannedUserGuard)
  listBlocked(@Req() req: AuthedRequest) {
    return this.usersService.listBlockedAccounts(req.user!.id);
  }

  @Get(':username/posts')
  @UseGuards(OptionalJwtAuthGuard)
  getProfilePosts(
    @Param('username') username: string,
    @Query('tab') tab: string,
    @Query('cursor') cursor: string,
    @Query('q') q: string,
    @Req() req: AuthedRequest,
  ) {
    return this.usersService.getPostsByTab(
      username,
      tab ?? 'posts',
      parseInt(cursor ?? '1', 10),
      req.user?.id,
      q ?? '',
    );
  }

  @Get(':username/followers')
  @UseGuards(OptionalJwtAuthGuard)
  getFollowers(
    @Param('username') username: string,
    @Query('cursor') cursor: string,
    @Req() req: AuthedRequest,
  ) {
    return this.usersService.getFollowers(
      username,
      parseInt(cursor ?? '1', 10),
      req.user?.id,
    );
  }

  @Get(':username/following')
  @UseGuards(OptionalJwtAuthGuard)
  getFollowing(
    @Param('username') username: string,
    @Query('cursor') cursor: string,
    @Req() req: AuthedRequest,
  ) {
    return this.usersService.getFollowing(
      username,
      parseInt(cursor ?? '1', 10),
      req.user?.id,
    );
  }

  @Get('me/saved')
  @UseGuards(JwtAuthGuard)
  getSavedPosts(
    @Req() req: AuthedRequest,
    @Query('cursor') cursor: string,
  ) {
    return this.usersService.getSavedPosts(req.user!.id, parseInt(cursor ?? '1', 10));
  }

  @Get(':username')
  @UseGuards(OptionalJwtAuthGuard)
  async findByUsername(
    @Param('username') username: string,
    @Req() req: AuthedRequest,
  ) {
    const user = await this.usersService.findByUsername(
      username,
      req.user?.id,
    );
    if (!user) throw new NotFoundException();
    return user;
  }
}
