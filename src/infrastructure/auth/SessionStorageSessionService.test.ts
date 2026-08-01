import { describe, expect, it } from "vitest";
import {
  authSessionStorageKey,
  type EpochClock,
  type KeyValueStorage,
  SessionStorageSessionService
} from "./SessionStorageSessionService";

class MemoryStorage implements KeyValueStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

class MutableClock implements EpochClock {
  constructor(private currentTime: number) {}

  now() {
    return this.currentTime;
  }

  advance(milliseconds: number) {
    this.currentTime += milliseconds;
  }
}

describe("SessionStorageSessionService", () => {
  it("getCurrent_WhenSessionExists_ShouldReturnSession", () => {
    const clock = new MutableClock(1000);
    const service = new SessionStorageSessionService(new MemoryStorage(), clock);

    const session = service.create("admin", 30);

    expect(service.getCurrent()).toEqual(session);
  });

  it("getCurrent_WhenSessionExpired_ShouldClearAndReturnNull", () => {
    const clock = new MutableClock(1000);
    const storage = new MemoryStorage();
    const service = new SessionStorageSessionService(storage, clock);

    service.create("admin", 1);
    clock.advance(60_001);

    expect(service.getCurrent()).toBeNull();
    expect(storage.getItem(authSessionStorageKey)).toBeNull();
  });

  it("touch_WhenSessionIsActive_ShouldExtendExpiration", () => {
    const clock = new MutableClock(1000);
    const service = new SessionStorageSessionService(new MemoryStorage(), clock);

    service.create("admin", 1);
    clock.advance(30_000);

    expect(service.touch(1)).toEqual({
      username: "admin",
      expiresAt: 91_000
    });
  });

  it("clear_WhenCalled_ShouldLogout", () => {
    const service = new SessionStorageSessionService(
      new MemoryStorage(),
      new MutableClock(1000)
    );

    service.create("admin", 30);
    service.clear();

    expect(service.getCurrent()).toBeNull();
  });
});
