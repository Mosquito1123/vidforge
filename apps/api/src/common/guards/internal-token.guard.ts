import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

/**
 * Guards internal service-to-service endpoints (worker progress callbacks).
 *
 * The token is configured through `API_INTERNAL_TOKEN`. When it is not set the
 * guard allows requests only outside production, so local development keeps
 * working without extra configuration while production fails closed.
 */
@Injectable()
export class InternalTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.API_INTERNAL_TOKEN || '';
    if (!expected) {
      if (process.env.NODE_ENV === 'production') {
        throw new UnauthorizedException('Internal token is not configured');
      }
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const header: string = request?.headers?.authorization || request?.headers?.['x-internal-token'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : header;

    if (!token || token !== expected) {
      throw new UnauthorizedException('Invalid internal token');
    }
    return true;
  }
}
