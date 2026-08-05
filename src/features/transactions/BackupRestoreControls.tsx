import { Download, Upload } from "lucide-react";
import { useRef, useState } from "react";
import type {
  ExportStorageDocumentResult,
  ImportPreview
} from "@application/use-cases";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  ErrorAlert
} from "@shared/ui";

interface BackupRestoreControlsProps {
  mode?: "normal" | "recovery";
  exportStorageDocumentUseCase: {
    execute(this: void): Promise<ExportStorageDocumentResult>;
  };
  previewImportStorageDocumentUseCase: {
    execute(this: void, contents: string): ImportPreview;
  };
  importStorageDocumentUseCase: {
    execute(this: void, contents: string): Promise<unknown>;
  };
  downloadFile: {
    download(
      this: void,
      file: { fileName: string; contents: string; mimeType?: string }
    ): void;
  };
  mapError(this: void, error: unknown): { title: string; message: string };
  onImported(this: void): Promise<void> | void;
}

type ImportState =
  | { status: "idle" }
  | { status: "preview"; contents: string; preview: ImportPreview }
  | { status: "error"; title: string; message: string }
  | { status: "importing"; contents: string; preview: ImportPreview };

export function BackupRestoreControls({
  mode = "normal",
  exportStorageDocumentUseCase,
  previewImportStorageDocumentUseCase,
  importStorageDocumentUseCase,
  downloadFile,
  mapError,
  onImported
}: BackupRestoreControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importState, setImportState] = useState<ImportState>({ status: "idle" });
  const [isExporting, setIsExporting] = useState(false);

  const exportCurrentData = async () => {
    setIsExporting(true);

    try {
      const backup = await exportStorageDocumentUseCase.execute();
      downloadFile.download({
        fileName: backup.fileName,
        contents: backup.contents,
        mimeType: "text/csv;charset=utf-8"
      });
    } catch (error) {
      const message = mapError(error);
      setImportState({
        status: "error",
        title: message.title,
        message: message.message
      });
    } finally {
      setIsExporting(false);
    }
  };

  const selectImportFile = () => {
    fileInputRef.current?.click();
  };

  const readImportFile = async (file: File) => {
    try {
      const contents = await readTextFile(file);
      const preview = previewImportStorageDocumentUseCase.execute(contents);

      setImportState({ status: "preview", contents, preview });
    } catch (error) {
      const message = mapError(error);
      setImportState({
        status: "error",
        title: message.title,
        message: message.message
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const confirmImport = async () => {
    if (importState.status !== "preview") {
      return;
    }

    setImportState({
      status: "importing",
      contents: importState.contents,
      preview: importState.preview
    });

    try {
      if (mode === "normal") {
        const backup = await exportStorageDocumentUseCase.execute();
        downloadFile.download({
          fileName: backup.fileName,
          contents: backup.contents,
          mimeType: "text/csv;charset=utf-8"
        });
      }

      await importStorageDocumentUseCase.execute(importState.contents);
      await onImported();
      setImportState({ status: "idle" });
    } catch (error) {
      const message = mapError(error);
      setImportState({
        status: "error",
        title: message.title,
        message: message.message
      });
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {mode === "normal" ? (
          <Button
            disabled={isExporting}
            type="button"
            variant="outline"
            onClick={() => void exportCurrentData()}
          >
            <Download aria-hidden="true" className="mr-2 h-4 w-4" />
            Exportar Excel
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={selectImportFile}>
          <Upload aria-hidden="true" className="mr-2 h-4 w-4" />
          Importar Excel
        </Button>
      </div>

      <input
        ref={fileInputRef}
        accept=".csv,text/csv,application/vnd.ms-excel"
        className="sr-only"
        type="file"
        aria-label="Seleccionar respaldo Excel"
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (file) {
            void readImportFile(file);
          }
        }}
      />

      <Dialog
        open={importState.status === "preview" || importState.status === "importing"}
        onOpenChange={(open) => {
          if (!open && importState.status !== "importing") {
            setImportState({ status: "idle" });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar importacion</DialogTitle>
            <DialogDescription>
              Los movimientos del archivo se agregaran a los datos actuales.
            </DialogDescription>
          </DialogHeader>
          {importState.status === "preview" || importState.status === "importing" ? (
            <div className="grid gap-4">
              <dl className="grid gap-3 rounded-md border border-border bg-muted/40 p-4 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Version</dt>
                  <dd className="font-medium">{importState.preview.schemaVersion}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Movimientos</dt>
                  <dd className="font-medium">
                    {importState.preview.transactionCount}
                  </dd>
                </div>
              </dl>
              <p className="text-sm text-muted-foreground">
                La importacion conserva los datos guardados y agrega filas nuevas.
                Si un identificador ya existe, se omitira para evitar duplicados.
              </p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  disabled={importState.status === "importing"}
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setImportState({ status: "idle" });
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  disabled={importState.status === "importing"}
                  type="button"
                  onClick={() => void confirmImport()}
                >
                  {mode === "normal"
                    ? "Descargar respaldo y agregar"
                    : "Agregar respaldo importado"}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {importState.status === "error" ? (
        <ErrorAlert title={importState.title} message={importState.message} />
      ) : null}
    </>
  );
}

function readTextFile(file: File) {
  if ("text" in file && typeof file.text === "function") {
    return file.text();
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    });
    reader.addEventListener("error", () => {
      reject(reader.error ?? new Error("File could not be read."));
    });
    reader.readAsText(file);
  });
}
