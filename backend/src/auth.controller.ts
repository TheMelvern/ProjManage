import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { AuthGuard, AuthenticatedRequest } from './auth.guard';
import { ThrottleService } from './throttle.service';
import type { Request } from 'express';

class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(1) password!: string;
}
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly throttle: ThrottleService) {}
  @Post('login')
  login(@Body() body: LoginDto, @Req() req: Request) {
    this.throttle.limit('login:' + req.ip, 100, 60_000);
    return this.auth.login(body.email, body.password);
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  logout(@Req() req: AuthenticatedRequest) { return this.auth.logout(req.principal.userId); }
}
