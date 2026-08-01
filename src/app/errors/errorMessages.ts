import {
  AuthenticationConfigurationError,
  InvalidCredentialsError
} from "@application/auth";
import {
  ImportValidationError,
  UnsupportedImportVersionError
} from "@application/use-cases";
import { DomainValidationError, TransactionNotFoundError } from "@domain/errors";
import {
  ConcurrentWriteError,
  CorruptedDataFileError,
  DataValidationError,
  StorageUnavailableError,
  StorageWriteError,
  UnsupportedSchemaVersionError
} from "@infrastructure/storage";

export interface UserFacingError {
  title: string;
  message: string;
  recoveryAction?: string;
}

export function mapErrorToUserMessage(error: unknown): UserFacingError {
  if (error instanceof StorageUnavailableError) {
    return {
      title: "No se pudo abrir el almacenamiento",
      message:
        "El navegador no permite acceder al archivo local de la aplicacion.",
      recoveryAction: "Revisar permisos del sitio o usar un navegador compatible."
    };
  }

  if (error instanceof CorruptedDataFileError) {
    return {
      title: "El archivo de datos esta corrupto",
      message:
        "La aplicacion no reemplazo el archivo para evitar perdida de datos.",
      recoveryAction: "Importar un respaldo valido o revisar el archivo manualmente."
    };
  }

  if (error instanceof UnsupportedSchemaVersionError) {
    return {
      title: "Version de datos no compatible",
      message:
        "El archivo fue creado con una version que esta aplicacion no puede leer.",
      recoveryAction: "Actualizar la aplicacion antes de continuar."
    };
  }

  if (error instanceof DataValidationError) {
    return {
      title: "Los datos guardados no son validos",
      message:
        "El contenido del archivo no coincide con el formato esperado.",
      recoveryAction: "Importar un respaldo valido."
    };
  }

  if (error instanceof StorageWriteError) {
    return {
      title: "No se pudieron guardar los cambios",
      message: "La operacion no fue confirmada en el almacenamiento local.",
      recoveryAction: "Intentar nuevamente y verificar el espacio disponible."
    };
  }

  if (error instanceof ConcurrentWriteError) {
    return {
      title: "Operacion en curso",
      message:
        "Otra escritura local no termino correctamente. Intentar nuevamente.",
      recoveryAction: "Esperar unos segundos antes de repetir la operacion."
    };
  }

  if (error instanceof TransactionNotFoundError) {
    return {
      title: "Movimiento no encontrado",
      message: "El movimiento solicitado ya no esta disponible."
    };
  }

  if (error instanceof AuthenticationConfigurationError) {
    return {
      title: "Autenticacion no configurada",
      message: "La configuracion local de acceso no es valida.",
      recoveryAction: "Revisar las variables VITE_AUTH_* del build."
    };
  }

  if (error instanceof InvalidCredentialsError) {
    return {
      title: "Credenciales invalidas",
      message: "Usuario o contrasena invalidos."
    };
  }

  if (error instanceof UnsupportedImportVersionError) {
    return {
      title: "Respaldo no compatible",
      message:
        "El archivo seleccionado fue creado con una version que esta aplicacion no puede importar."
    };
  }

  if (error instanceof ImportValidationError) {
    return {
      title: "Importacion invalida",
      message:
        "El archivo seleccionado no coincide con el formato esperado."
    };
  }

  if (error instanceof DomainValidationError) {
    return {
      title: "Datos invalidos",
      message: "Revisar los campos ingresados antes de guardar."
    };
  }

  return {
    title: "Error inesperado",
    message: "No se pudo completar la operacion."
  };
}
