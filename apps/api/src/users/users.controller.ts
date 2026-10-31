import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users' })
  findAll() {
    return this.users.findAll();
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user' })
  me(@CurrentUser() user: { id: string }) {
    return this.users.findOne(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by id' })
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user' })
  updateMe(@CurrentUser() user: { id: string }, @Body() body: UpdateUserDto) {
    return this.users.update(user.id, body);
  }
}
