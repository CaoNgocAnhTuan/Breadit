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
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminService } from './admin.service';
import { Cursor } from '../common/decorators/cursor.decorator';

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
  banUser(@Param('id') id: string) {
    return this.adminService.setBanStatus(id, true);
  }

  @Post('users/:id/unban')
  @HttpCode(HttpStatus.OK)
  unbanUser(@Param('id') id: string) {
    return this.adminService.setBanStatus(id, false);
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
