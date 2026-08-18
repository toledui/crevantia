import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { AuthenticatedUser } from './auth.types';

@Injectable()
export class OptionalAccessTokenGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type === 'Bearer' && token) {
      try {
        request.user = await this.jwt.verifyAsync<AuthenticatedUser>(token, {
          secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        });
      } catch {
        // Optional auth: ignore invalid token and continue as guest
      }
    }
    return true;
  }
}
