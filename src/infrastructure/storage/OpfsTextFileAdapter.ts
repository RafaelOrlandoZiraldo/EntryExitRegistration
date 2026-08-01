import { StorageUnavailableError, StorageWriteError } from "./errors";
import type { TextFileAdapter } from "./TextFileAdapter";

export class OpfsTextFileAdapter implements TextFileAdapter {
  async readText(fileName: string) {
    const root = await this.getRootDirectory();

    try {
      const fileHandle = await root.getFileHandle(fileName);
      const file = await fileHandle.getFile();

      return file.text();
    } catch (error) {
      if (isDomException(error, "NotFoundError")) {
        return null;
      }

      throw new StorageUnavailableError({ cause: error });
    }
  }

  async writeText(fileName: string, contents: string) {
    const root = await this.getRootDirectory();
    const temporaryFileName = `${fileName}.tmp`;

    try {
      await this.writeFile(root, temporaryFileName, contents);
      await this.writeFile(root, fileName, contents);
      await root.removeEntry(temporaryFileName);
    } catch (error) {
      throw new StorageWriteError({ cause: error });
    }
  }

  private async getRootDirectory() {
    if (!("storage" in navigator) || !navigator.storage.getDirectory) {
      throw new StorageUnavailableError();
    }

    try {
      return await navigator.storage.getDirectory();
    } catch (error) {
      throw new StorageUnavailableError({ cause: error });
    }
  }

  private async writeFile(
    root: FileSystemDirectoryHandle,
    fileName: string,
    contents: string
  ) {
    const fileHandle = await root.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();

    await writable.write(contents);
    await writable.close();
  }
}

function isDomException(error: unknown, name: string) {
  return error instanceof DOMException && error.name === name;
}
