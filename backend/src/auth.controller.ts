import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { AuthGuard, AuthenticatedRequest } from './auth.guard';
import { ThrottleService } from './throttle.service';
import { EmailTokenService } from './email-token.service';
import type { Request } from 'express';

class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(1) password!: string;
}
class EmailDto {
  @IsEmail() email!: string;
}
class TokenDto {
  @IsString() @MinLength(32) @MaxLength(128) token!: string;
}
class ResetPasswordDto extends TokenDto {
  @IsString() @MinLength(12) @MaxLength(128) password!: string;
}
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly throttle: ThrottleService,
    private readonly tokens: EmailTokenService) {}
  @Post('login')
  login(@Body() body: LoginDto, @Req() req: Request) {
    this.throttle.limit('login:' + req.ip, 100, 60_000);
    return this.auth.login(body.email, body.password);
  }

  @Post('verify-email')
  verifyEmail(@Body() body: TokenDto) {
    return this.tokens.verifyEmail(body.token);
  }

  @Post('resend-verification')
  resendVerification(@Body() body: EmailDto, @Req() req: Request) {
    this.throttle.limit('resend:' + req.ip, 5, 15 * 60_000);
    return this.tokens.resendVerification(body.email);
  }

  @Post('request-password-reset')
  requestReset(@Body() body: EmailDto, @Req() req: Request) {
    this.throttle.limit('forgot:' + req.ip, 5, 15 * 60_000);
    return this.tokens.requestReset(body.email);
  }

  @Post('reset-password')
  resetPassword(@Body() body: ResetPasswordDto, @Req() req: Request) {
    this.throttle.limit('reset:' + req.ip, 10, 15 * 60_000);
    return this.tokens.resetPassword(body.token, body.password);
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  logout(@Req() req: AuthenticatedRequest) { return this.auth.logout(req.principal.userId); }
}
