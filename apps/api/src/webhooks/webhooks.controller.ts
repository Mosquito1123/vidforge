import { Body, Controller, Headers, Param, Post, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service.js';
import { WebhookDto } from './dto/webhook.dto.js';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private webhooks: WebhooksService) {}

  @Post('task')
  @ApiOperation({ summary: 'Task completion callback' })
  task(
    @Req() req: any,
    @Headers('x-webhook-signature') signature: string | undefined,
    @Headers('x-signature') altSignature: string | undefined,
    @Body() body: WebhookDto & Record<string, any>,
  ) {
    return this.webhooks.handleTaskEvent(body, req.rawBody, signature ?? altSignature);
  }

  @Post(':provider')
  @ApiOperation({ summary: 'Generic provider webhook' })
  generic(
    @Param('provider') provider: string,
    @Req() req: any,
    @Headers('x-webhook-signature') signature: string | undefined,
    @Headers('x-signature') altSignature: string | undefined,
    @Body() body: WebhookDto & Record<string, any>,
  ) {
    const event = body?.event || body?.type || 'webhook.received';
    return this.webhooks.handleProvider(provider, event, body, req.rawBody, signature ?? altSignature);
  }
}
