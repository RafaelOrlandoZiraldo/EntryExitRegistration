export interface DownloadableTextFile {
  fileName: string;
  contents: string;
  mimeType?: string;
}

export class BrowserFileDownloadAdapter {
  download({ fileName, contents, mimeType = "application/json" }: DownloadableTextFile) {
    const blob = new Blob([contents], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }
}
