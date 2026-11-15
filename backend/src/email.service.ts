import { Injectable, ServiceUnavailableException } from '@nestjs/common';

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character] || character);

@Injectable()
export class EmailService {
  isConfigured(): boolean {
    return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
  }
  assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('Email delivery must be configured before onboarding or recovery can continue');
    }
  }
  private endpoint(): string {
    const url = new URL(process.env.MAIL_API_URL || 'https://api.resend.com/emails');
    if (url.protocol !== 'https:' &&
      !(process.env.NODE_ENV === 'test' && url.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(url.hostname))) {
      throw new ServiceUnavailableException('Insecure email delivery endpoint is not permitted');
    }
    return url.toString();
  }
  async sendLink(to: string, name: string, purpose: 'VERIFY' | 'RESET', token: string): Promise<void> {
    this.assertConfigured();
    const base = process.env.FRONTEND_ORIGIN || 'http://localhost:5174';
    const target = new URL(base);
    if (!['http:', 'https:'].includes(target.protocol) ||
      (process.env.NODE_ENV === 'production' && target.protocol !== 'https:')) {
      throw new ServiceUnavailableException('A valid HTTPS FRONTEND_ORIGIN is required for verification links');
    }
    const path = purpose === 'VERIFY' ? 'verify-email' : 'reset-password';
    const link = target.origin + '/#/' + path + '?token=' + encodeURIComponent(token);
    const subject = purpose === 'VERIFY' ? 'Verify your PMO Portal email' : 'Reset your PMO Portal password';
    const text = 'Hello ' + name + ',\n\nUse this one-time link to ' +
      (purpose === 'VERIFY' ? 'verify your account' : 'reset your password') +
      ':\n' + link + '\n\nIf you did not request this, you may ignore this message.';
    const html = '<p>Hello ' + escapeHtml(name) + ',</p><p>' +
      (purpose === 'VERIFY' ? 'Verify your PMO Portal account:' : 'Reset your PMO Portal password:') +
      '</p><p><a href="' + escapeHtml(link) + '">Open secure link</a></p>' +
      '<p>If you did not request this, you may ignore this email.</p>';
    let response: Response;
    try {
      response = await fetch(this.endpoint(), {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + process.env.RESEND_API_KEY!,
          'Content-Type': 'application/json',
          'User-Agent': 'PMO-Portal/1.0'
        },
        body: JSON.stringify({
          from: process.env.MAIL_FROM, to: [to], subject, text, html
        }),
        signal: AbortSignal.timeout(8000)
      });
    } catch {
      throw new ServiceUnavailableException('Email delivery failed. Please retry later');
    }
    if (!response.ok) {
      throw new ServiceUnavailableException('Email provider rejected delivery. Please contact the administrator');
    }
  }
}
