import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TOOL_CATALOG } from './tool-catalog.js';

@ApiTags('tools')
@Controller('tools')
export class ToolsController {
  @Get()
  @ApiOperation({ summary: 'List available media tools and their credit price' })
  list() {
    return Object.values(TOOL_CATALOG).map((tool) => ({
      slug: tool.slug,
      credits: tool.credits,
    }));
  }
}
