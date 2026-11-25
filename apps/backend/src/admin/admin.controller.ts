import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminService } from './admin.service';
import { Cursor } from '../common/decorators/cursor.decorator';

type AuthedRequest = FastifyRequest & { user?: { id: string; username: string } };

@Controller('api/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  getUsers(
    @Cursor(1) cursor: number,
    @Query('q') q?: string,
  ) {
    return this.adminService.getUsers(cursor, q);
  }

  @Post('users/:id/ban')
  @HttpCode(HttpStatus.OK)
  banUser(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.adminService.setBanStatus(req.user!.id, id, true);
  }

  @Post('users/:id/unban')
  @HttpCode(HttpStatus.OK)
  unbanUser(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.adminService.setBanStatus(req.user!.id, id, false);
  }

  @Get('reports')
  getReports(@Cursor(1) cursor: number) {
    return this.adminService.getReports(cursor);
  }

  @Post('reports/:id/dismiss')
  @HttpCode(HttpStatus.OK)
  dismissReport(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.dismissReport(id);
  }

  @Delete('reports/:id/delete-post')
  @HttpCode(HttpStatus.OK)
  deleteReportedPost(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteReportedPost(id);
  }
}
