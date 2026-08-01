import { describe, expect, it } from "vitest";
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
import { mapErrorToUserMessage } from "./errorMessages";

describe("mapErrorToUserMessage", () => {
  it("mapErrorToUserMessage_WhenStorageIsUnavailable_ShouldReturnRecoveryMessage", () => {
    expect(mapErrorToUserMessage(new StorageUnavailableError())).toEqual({
      title: "No se pudo abrir el almacenamiento",
      message:
        "El navegador no permite acceder al archivo local de la aplicacion.",
      recoveryAction: "Revisar permisos del sitio o usar un navegador compatible."
    });
  });

  it("mapErrorToUserMessage_WhenDataIsCorrupted_ShouldAvoidSilentOverwrite", () => {
    expect(mapErrorToUserMessage(new CorruptedDataFileError())).toMatchObject({
      title: "El archivo de datos esta corrupto",
      recoveryAction: "Importar un respaldo valido o revisar el archivo manualmente."
    });
  });

  it("mapErrorToUserMessage_WhenStorageWriteFails_ShouldReturnRetryMessage", () => {
    expect(mapErrorToUserMessage(new StorageWriteError())).toMatchObject({
      title: "No se pudieron guardar los cambios",
      message: "La operacion no fue confirmada en el almacenamiento local."
    });
  });

  it("mapErrorToUserMessage_WhenConcurrentWriteFails_ShouldReturnConcurrencyMessage", () => {
    expect(mapErrorToUserMessage(new ConcurrentWriteError())).toMatchObject({
      title: "Operacion en curso",
      recoveryAction: "Esperar unos segundos antes de repetir la operacion."
    });
  });

  it("mapErrorToUserMessage_WhenStoredDataIsInvalid_ShouldReturnRecoveryMessage", () => {
    expect(mapErrorToUserMessage(new DataValidationError())).toMatchObject({
      title: "Los datos guardados no son validos",
      recoveryAction: "Importar un respaldo valido."
    });
  });

  it("mapErrorToUserMessage_WhenStoredVersionIsUnsupported_ShouldReturnUpgradeMessage", () => {
    expect(
      mapErrorToUserMessage(new UnsupportedSchemaVersionError(99))
    ).toMatchObject({
      title: "Version de datos no compatible",
      recoveryAction: "Actualizar la aplicacion antes de continuar."
    });
  });

  it("mapErrorToUserMessage_WhenImportIsInvalid_ShouldReturnImportMessage", () => {
    expect(mapErrorToUserMessage(new ImportValidationError())).toMatchObject({
      title: "Importacion invalida",
      message: "El archivo seleccionado no coincide con el formato esperado."
    });
  });

  it("mapErrorToUserMessage_WhenImportVersionIsUnsupported_ShouldReturnImportVersionMessage", () => {
    expect(
      mapErrorToUserMessage(new UnsupportedImportVersionError(99))
    ).toMatchObject({
      title: "Respaldo no compatible"
    });
  });

  it("mapErrorToUserMessage_WhenAuthenticationConfigurationFails_ShouldReturnConfigurationMessage", () => {
    expect(
      mapErrorToUserMessage(new AuthenticationConfigurationError())
    ).toMatchObject({
      title: "Autenticacion no configurada",
      message: "La configuracion local de acceso no es valida."
    });
  });

  it("mapErrorToUserMessage_WhenCredentialsAreInvalid_ShouldReturnGenericAuthenticationMessage", () => {
    expect(mapErrorToUserMessage(new InvalidCredentialsError())).toMatchObject({
      title: "Credenciales invalidas",
      message: "Usuario o contrasena invalidos."
    });
  });

  it("mapErrorToUserMessage_WhenDomainValidationFails_ShouldReturnValidationMessage", () => {
    expect(
      mapErrorToUserMessage(new DomainValidationError("Amount is invalid."))
    ).toMatchObject({
      title: "Datos invalidos",
      message: "Revisar los campos ingresados antes de guardar."
    });
  });

  it("mapErrorToUserMessage_WhenTransactionIsMissing_ShouldReturnNotFoundMessage", () => {
    expect(
      mapErrorToUserMessage(new TransactionNotFoundError("transaction-1"))
    ).toMatchObject({
      title: "Movimiento no encontrado",
      message: "El movimiento solicitado ya no esta disponible."
    });
  });

  it("mapErrorToUserMessage_WhenErrorIsUnexpected_ShouldReturnGenericMessage", () => {
    expect(mapErrorToUserMessage(new Error("password=secret"))).toEqual({
      title: "Error inesperado",
      message: "No se pudo completar la operacion."
    });
  });
});
