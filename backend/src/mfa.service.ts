import { BadRequestException, ConflictException, ForbiddenException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { compare } from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
function base32(secret: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0, out = '';
  for (const octet of secret) {
    value = (value << 8) | octet;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31];
  return out;
}
function totp(secret: Buffer, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const h = createHmac('sha1', secret).update(counter).digest();
  const offset = h[h.length - 1] & 15;
  const num = ((h[offset] & 0x7f) << 24) | ((h[offset + 1] & 0xff) << 16) |
    ((h[offset + 2] & 0xff) << 8) | (h[offset + 3] & 0xff);
  return String(num % 1000000).padStart(6, '0');
}
function matchingStep(secret: Buffer, input: string, lastStep: number | null = null): number | null {
  if (!/^\d{6}$/.test(input)) return null;
  const now = Math.floor(Date.now() / 30000);
  for (let step = now - 1; step <= now + 1; step++) {
    if (lastStep != null && step <= lastStep) continue;
    const expected = Buffer.from(totp(secret, step));
    if (timingSafeEqual(expected, Buffer.from(input))) return step;
  }
  return null;
}

@Injectable()
export class MfaService {
  constructor(private readonly prisma: PrismaService) {}

  private key(): Buffer {
    const raw = process.env.MFA_ENCRYPTION_KEY || '';
    if (!/^[a-fA-F0-9]{64}$/.test(raw)) {
      throw new ServiceUnavailableException('MFA_ENCRYPTION_KEY must be a securely stored 32-byte hex key');
    }
    return Buffer.from(raw, 'hex');
  }
  private encrypt(secret: Buffer): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const encrypted = Buffer.concat([cipher.update(secret), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
  }
  private decrypt(payload: string): Buffer {
    try {
      const bytes = Buffer.from(payload, 'base64url');
      if (bytes.length < 29) throw new Error('Invalid encrypted secret');
      const decipher = createDecipheriv('aes-256-gcm', this.key(), bytes.subarray(0, 12));
      decipher.setAuthTag(bytes.subarray(12, 28));
      return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]);
    } catch {
      throw new ServiceUnavailableException('Unable to decrypt MFA secret; contact your administrator');
    }
  }
  async status(userId: string) {
    const [user, remaining] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId },
        select: { mfaEnabledAt: true, mfaPendingCreatedAt: true } }),
      this.prisma.mfaRecoveryCode.count({ where: { userId, consumedAt: null } })
    ]);
    if (!user) throw new UnauthorizedException('Account not found');
    return { success: true, data: {
      enabled: Boolean(user.mfaEnabledAt), enabledAt: user.mfaEnabledAt,
      enrollmentPending: Boolean(user.mfaPendingCreatedAt &&
        user.mfaPendingCreatedAt.getTime() > Date.now() - 10 * 60 * 1000),
      recoveryCodesRemaining: remaining
    } };
  }
  async beginEnrollment(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash || !(await compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Password confirmation required');
    }
    if (!user.emailVerifiedAt) throw new ForbiddenException('Verify email before enabling MFA');
    if (user.mfaEnabledAt) throw new ConflictException('MFA already enabled');
    const secret = randomBytes(20);
    const printable = base32(secret);
    await this.prisma.user.update({ where: { id: user.id }, data: {
      mfaPendingCiphertext: this.encrypt(secret), mfaPendingCreatedAt: new Date()
    } });
    const label = encodeURIComponent('PMO Portal:' + user.email);
    const issuer = encodeURIComponent('PMO Portal');
    return { success: true, data: { secret: printable,
      otpauthUri: 'otpauth://totp/' + label + '?secret=' + printable +
        '&issuer=' + issuer + '&algorithm=SHA1&digits=6&period=30',
      expiresInSeconds: 600
    } };
  }
  async confirmEnrollment(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.mfaEnabledAt) throw new ConflictException('MFA already enabled or account unavailable');
    if (!user.mfaPendingCiphertext || !user.mfaPendingCreatedAt ||
      user.mfaPendingCreatedAt.getTime() <= Date.now() - 10 * 60 * 1000) {
      throw new BadRequestException('MFA setup expired; start again');
    }
    if (matchingStep(this.decrypt(user.mfaPendingCiphertext), code) === null) {
      throw new UnauthorizedException('Invalid authenticator code');
    }
    const recovery = Array.from({ length: 8 }, () => randomBytes(10).toString('hex').toUpperCase());
    await this.prisma.$transaction(async tx => {
      const claimed = await tx.user.updateMany({
        where: { id: user.id, mfaEnabledAt: null,
          mfaPendingCiphertext: user.mfaPendingCiphertext },
        data: {
          mfaCiphertext: user.mfaPendingCiphertext,
          mfaPendingCiphertext: null, mfaPendingCreatedAt: null,
          mfaEnabledAt: new Date(), mfaLastStep: null,
          sessionVersion: { increment: 1 }
        }
      });
      if (claimed.count !== 1) throw new ConflictException('MFA enrollment changed; retry');
      await tx.mfaRecoveryCode.deleteMany({ where: { userId: user.id } });
      await tx.mfaRecoveryCode.createMany({
        data: recovery.map(value => ({ userId: user.id, codeHash: digest(value) }))
      });
    });
    return { success: true, data: {
      enabled: true, recoveryCodes: recovery,
      message: 'MFA enabled. Save recovery codes securely; they will not be displayed again.'
    } };
  }
  async createChallenge(userId: string) {
    this.key();
    const raw = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await this.prisma.mfaChallenge.create({
      data: { userId, tokenHash: digest(raw), expiresAt }
    });
    return { success: true, data: {
      requiresMfa: true, challengeToken: raw, expiresInSeconds: 300
    } };
  }
  private async validCode(
    tx: Prisma.TransactionClient,
    user: { id: string; mfaCiphertext: string | null; mfaLastStep: number | null },
    input: string
  ): Promise<boolean> {
    if (!user.mfaCiphertext) return false;
    if (/^[0-9]{6}$/.test(input)) {
      const step = matchingStep(this.decrypt(user.mfaCiphertext), input, user.mfaLastStep);
      if (step === null) return false;
      const changed = await tx.user.updateMany({
        where: { id: user.id, OR: [{ mfaLastStep: null }, { mfaLastStep: { lt: step } }] },
        data: { mfaLastStep: step }
      });
      return changed.count === 1;
    }
    const normalized = input.replace(/-/g, '').toUpperCase();
    if (!/^[0-9A-F]{20}$/.test(normalized)) return false;
    const recovery = await tx.mfaRecoveryCode.updateMany({
      where: { userId: user.id, codeHash: digest(normalized), consumedAt: null },
      data: { consumedAt: new Date() }
    });
    return recovery.count === 1;
  }
  async completeChallenge(token: string, code: string): Promise<string> {
    const tokenHash = digest(token);
    const userId = await this.prisma.$transaction(async tx => {
      const challenge = await tx.mfaChallenge.findUnique({ where: { tokenHash } });
      if (!challenge || challenge.consumedAt || challenge.expiresAt <= new Date() ||
        challenge.attempts >= 5) throw new UnauthorizedException('MFA challenge expired or invalid');
      const user = await tx.user.findUnique({ where: { id: challenge.userId },
        select: { id: true, mfaCiphertext: true, mfaLastStep: true, mfaEnabledAt: true } });
      if (!user?.mfaEnabledAt) throw new UnauthorizedException('MFA no longer enabled');
      const valid = await this.validCode(tx, user, code);
      if (!valid) {
        await tx.mfaChallenge.update({ where: { id: challenge.id },
          data: { attempts: { increment: 1 } } });
        return null;
      }
      const claimed = await tx.mfaChallenge.updateMany({
        where: { id: challenge.id, consumedAt: null,
          expiresAt: { gt: new Date() }, attempts: { lt: 5 } },
        data: { consumedAt: new Date() }
      });
      if (claimed.count !== 1) throw new UnauthorizedException('MFA challenge already completed');
      await tx.mfaChallenge.deleteMany({ where: { userId: user.id,
        id: { not: challenge.id }, consumedAt: null } });
      return user.id;
    });
    if (!userId) throw new UnauthorizedException('Authenticator or recovery code incorrect');
    return userId;
  }
  async disable(userId: string, password: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaEnabledAt || !user.passwordHash ||
      !(await compare(password, user.passwordHash))) {
      throw new UnauthorizedException('MFA and password confirmation required');
    }
    const success = await this.prisma.$transaction(async tx => {
      const valid = await this.validCode(tx, user, code);
      if (!valid) return false;
      await tx.user.update({ where: { id: user.id }, data: {
        mfaCiphertext: null, mfaPendingCiphertext: null, mfaPendingCreatedAt: null,
        mfaEnabledAt: null, mfaLastStep: null, sessionVersion: { increment: 1 }
      } });
      await tx.mfaRecoveryCode.deleteMany({ where: { userId: user.id } });
      await tx.mfaChallenge.deleteMany({ where: { userId: user.id } });
      return true;
    });
    if (!success) throw new UnauthorizedException('Invalid MFA code');
    return { success: true, data: { disabled: true, message: 'MFA disabled and old sessions revoked' } };
  }
}
