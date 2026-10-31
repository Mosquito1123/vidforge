import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PaymentsService } from './payments.service.js';

@ApiTags('plans')
@Controller('plans')
export class PlansController {
  constructor(private payments: PaymentsService) {}

  @Get()
  @ApiOperation({ summary: 'List subscription plans' })
  list() {
    return this.payments.listPlans();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get plan' })
  get(@Param('id') id: string) {
    return this.payments.getPlan(id);
  }
}