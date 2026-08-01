import type { AuthSession, SessionService } from "@application/auth";

export interface EpochClock {
  now(): number;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const authSessionStorageKey = "domestic-finance.auth-session";

export class SystemEpochClock implements EpochClock {
  now() {
    return Date.now();
  }
}

export class SessionStorageSessionService implements SessionService {
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly clock: EpochClock,
    private readonly key = authSessionStorageKey
  ) {}

  create(username: string, timeoutMinutes: number) {
    const session = this.createSession(username, timeoutMinutes);
    this.storage.setItem(this.key, JSON.stringify(session));

    return session;
  }

  getCurrent() {
    const session = this.readSession();

    if (session === null) {
      return null;
    }

    if (this.isExpired(session)) {
      this.clear();
      return null;
    }

    return session;
  }

  touch(timeoutMinutes: number) {
    const session = this.getCurrent();

    if (session === null) {
      return null;
    }

    return this.create(session.username, timeoutMinutes);
  }

  clear() {
    this.storage.removeItem(this.key);
  }

  private createSession(username: string, timeoutMinutes: number): AuthSession {
    return {
      username,
      expiresAt: this.clock.now() + timeoutMinutes * 60_000
    };
  }

  private readSession() {
    const rawSession = this.storage.getItem(this.key);

    if (rawSession === null) {
      return null;
    }

    try {
      const parsed = JSON.parse(rawSession) as unknown;

      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "username" in parsed &&
        typeof parsed.username === "string" &&
        "expiresAt" in parsed &&
        typeof parsed.expiresAt === "number"
      ) {
        return parsed;
      }
    } catch {
      this.clear();
    }

    this.clear();
    return null;
  }

  private isExpired(session: AuthSession) {
    return session.expiresAt <= this.clock.now();
  }
}
