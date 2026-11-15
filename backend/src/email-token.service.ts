import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';
import { hash } from 'bcryptjs';
import { PrismaService } from './prisma.service';
import { EmailService } from './email.service';

type Purpose = 'VERIFY' | 'RESET';

@Injectable()
export class EmailTokenService {
  constructor(private readonly prisma: PrismaService, private readonly email: EmailService) {}
  assertConfigured(): void { this.email.assertConfigured(); }

  private digest(token: string): string { return createHash('sha256').update(token).digest('hex'); }

  async issue(userId: string, to: string, name: string, purpose: Purpose): Promise<void> {
    this.email.assertConfigured();
    const rawToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + (purpose === 'VERIFY' ? 24 * 60 : 30) * 60 * 1000);
    const stored = await this.prisma.$transaction(async tx => {
      await tx.emailToken.deleteMany({ where: { userId, purpose, consumedAt: null } });
      return tx.emailToken.create({ data: { userId, purpose, tokenHash: this.digest(rawToken), expiresAt } });
    });
    try {
      await this.email.sendLink(to, name, purpose, rawToken);
    } catch (error) {
      await this.prisma.emailToken.deleteMany({ where: { id: stored.id, consumedAt: null } });
      throw error;
    }
  }

  async verifyEmail(token: string) {
    const tokenHash = this.digest(token);
    const result = await this.prisma.$transaction(async tx => {
      const record = await tx.emailToken.findUnique({ where: { tokenHash } });
      if (!record || record.purpose !== 'VERIFY' || record.consumedAt ||
        record.expiresAt <= new Date()) throw new BadRequestException('Verification link is invalid or expired');
      const consumed = await tx.emailToken.updateMany({
        where: { id: record.id, consumedAt: null, expiresAt: { gt: new Date() } },
        data: { consumedAt: new Date() }
      });
      if (consumed.count !== 1) throw new BadRequestException('Verification link has already been used');
      await tx.user.update({ where: { id: record.userId },
        data: { emailVerifiedAt: new Date(), failedLogins: 0, lockedUntil: null } });
      return record.userId;
    });
    return { success: true, data: { verified: true, userId: result } };
  }

  async resetPassword(token: string, password: string) {
    const tokenHash = this.digest(token);
    const passwordHash = await hash(password, 12);
    await this.prisma.$transaction(async tx => {
      const record = await tx.emailToken.findUnique({ where: { tokenHash } });
      if (!record || record.purpose !== 'RESET' || record.consumedAt ||
        record.expiresAt <= new Date()) throw new BadRequestException('Reset link is invalid or expired');
      const consumed = await tx.emailToken.updateMany({
        where: { id: record.id, consumedAt: null, expiresAt: { gt: new Date() } },
        data: { consumedAt: new Date() }
      });
      if (consumed.count !== 1) throw new BadRequestException('Reset link has already been used');
      await tx.user.update({ where: { id: record.userId },
        data: { passwordHash, sessionVersion: { increment: 1 }, failedLogins: 0, lockedUntil: null } });
      await tx.emailToken.updateMany({ where: { userId: record.userId, purpose: 'RESET',
        consumedAt: null }, data: { consumedAt: new Date() } });
    });
    return { success: true, data: { reset: true } };
  }

  async resendVerification(email: string) {
    this.email.assertConfigured();
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() }, include: { memberships: true }
    });
    if (user && !user.emailVerifiedAt && user.memberships.length) {
      try { await this.issue(user.id, user.email, user.name, 'VERIFY'); }
      catch { /* Generic outcome prevents discovering which mailbox exists. */ }
    }
    return { success: true, data: { message: 'If the account is eligible, a verification email will be sent.' } };
  }

  async requestReset(email: string) {
    this.email.assertConfigured();
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() }, include: { memberships: true }
    });
    if (user?.emailVerifiedAt && user.memberships.length) {
      try { await this.issue(user.id, user.email, user.name, 'RESET'); }
      catch { /* Generic outcome prevents account enumeration. */ }
    }
    return { success: true, data: { message: 'If this address is registered, a password reset link will be sent.' } };
  }
}
