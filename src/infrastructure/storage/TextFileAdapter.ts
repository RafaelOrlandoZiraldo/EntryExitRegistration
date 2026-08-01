export interface TextFileAdapter {
  readText(fileName: string): Promise<string | null>;
  writeText(fileName: string, contents: string): Promise<void>;
}
