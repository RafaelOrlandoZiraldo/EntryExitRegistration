import type { Clock } from "@application/ports";

export class SystemIsoClock implements Clock {
  now() {
    return new Date().toISOString();
  }
}
