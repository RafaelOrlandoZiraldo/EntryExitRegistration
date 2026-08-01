import type { IdGenerator } from "@application/ports";

export class BrowserIdGenerator implements IdGenerator {
  generate() {
    return crypto.randomUUID();
  }
}
