import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { AuthGuard, AuthenticatedRequest } from './auth.guard';
import { ThrottleService } from './throttle.service';
import { EmailTokenService } from './email-token.service';
import { MfaService } from './mfa.service';
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
class MfaSetupDto {
  @IsString() @MinLength(1) password!: string;
}
class MfaCodeDto {
  @IsString() @MinLength(6) @MaxLength(32) code!: string;
}
class MfaDisableDto extends MfaCodeDto {
  @IsString() @MinLength(1) password!: string;
}
class MfaCompleteDto extends MfaCodeDto {
  @IsString() @MinLength(32) @MaxLength(128) challengeToken!: string;
}
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly throttle: ThrottleService,
    private readonly tokens: EmailTokenService, private readonly mfa: MfaService) {}
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

  @Post('mfa/complete')
  async completeMfa(@Body() body: MfaCompleteDto, @Req() req: Request) {
    this.throttle.limit('mfa-complete:' + req.ip, 30, 15 * 60_000);
    const userId = await this.mfa.completeChallenge(body.challengeToken, body.code);
    return this.auth.issueAccessToken(userId);
  }

  @Get('mfa/status')
  @UseGuards(AuthGuard)
  status(@Req() req: AuthenticatedRequest) {
    return this.mfa.status(req.principal.userId);
  }

  @Post('mfa/setup')
  @UseGuards(AuthGuard)
  setupMfa(@Req() req: AuthenticatedRequest, @Body() body: MfaSetupDto) {
    this.throttle.limit('mfa-setup:' + req.principal.userId, 10, 15 * 60_000);
    return this.mfa.beginEnrollment(req.principal.userId, body.password);
  }

  @Post('mfa/confirm')
  @UseGuards(AuthGuard)
  confirmMfa(@Req() req: AuthenticatedRequest, @Body() body: MfaCodeDto) {
    this.throttle.limit('mfa-confirm:' + req.principal.userId, 15, 15 * 60_000);
    return this.mfa.confirmEnrollment(req.principal.userId, body.code);
  }

  @Post('mfa/disable')
  @UseGuards(AuthGuard)
  disableMfa(@Req() req: AuthenticatedRequest, @Body() body: MfaDisableDto) {
    this.throttle.limit('mfa-disable:' + req.principal.userId, 10, 15 * 60_000);
    return this.mfa.disable(req.principal.userId, body.password, body.code);
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  logout(@Req() req: AuthenticatedRequest) { return this.auth.logout(req.principal.userId); }
}
