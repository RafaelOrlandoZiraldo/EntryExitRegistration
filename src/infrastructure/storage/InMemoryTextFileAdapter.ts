import type { TextFileAdapter } from "./TextFileAdapter";

export class InMemoryTextFileAdapter implements TextFileAdapter {
  private readonly files = new Map<string, string>();

  constructor(initialFiles: ReadonlyMap<string, string> = new Map()) {
    for (const [fileName, contents] of initialFiles) {
      this.files.set(fileName, contents);
    }
  }

  readText(fileName: string) {
    return Promise.resolve(this.files.get(fileName) ?? null);
  }

  writeText(fileName: string, contents: string) {
    this.files.set(fileName, contents);
    return Promise.resolve();
  }

  peek(fileName: string) {
    return this.files.get(fileName) ?? null;
  }
}
