import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { ModelsService } from './models.service.js';
import { CreateModelDto } from './dto/create-model.dto.js';
import { UpdateModelDto } from './dto/update-model.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';

@ApiTags('models')
@Controller('models')
export class ModelsController {
  constructor(private models: ModelsService) {}

  @Get()
  @ApiOperation({ summary: 'List available AI models' })
  findAll(@Query('all') all?: string) {
    return this.models.findAll(all !== 'true');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get model by id or slug' })
  findOne(@Param('id') id: string) {
    return this.models.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a model (admin)' })
  create(@Body() body: CreateModelDto) {
    return this.models.create(body);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a model' })
  update(@Param('id') id: string, @Body() body: UpdateModelDto) {
    return this.models.update(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a model' })
  remove(@Param('id') id: string) {
    return this.models.remove(id);
  }
}
