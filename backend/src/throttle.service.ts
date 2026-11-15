import { HttpException, Injectable } from '@nestjs/common';

type Counter = { count: number; expires: number };
@Injectable()
export class ThrottleService {
  private readonly attempts = new Map<string, Counter>();

  limit(key: string, maximum: number, windowMs: number) {
    const now = Date.now();
    if (this.attempts.size > 10000) {
      for (const [name, entry] of this.attempts) {
        if (entry.expires <= now) this.attempts.delete(name);
      }
    }
    const current = this.attempts.get(key);
    if (!current || current.expires <= now) {
      this.attempts.set(key, { count: 1, expires: now + windowMs });
      return;
    }
    if (current.count >= maximum) {
      throw new HttpException('Too many requests. Please retry later.', 429);
    }
    current.count++;
  }
}
