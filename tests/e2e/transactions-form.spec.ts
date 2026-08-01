import { expect, test } from "@playwright/test";

test("user can create edit and delete a transaction", async ({ page }) => {
  await page.goto("/login");
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry("domestic-finance.json").catch(() => undefined);
    await root.removeEntry("domestic-finance.json.tmp").catch(() => undefined);
  });
  await page.reload();

  await page.getByLabel("Usuario").fill("admin");
  await page.getByLabel("Contrasena").fill("correct-password");
  await page.getByRole("button", { name: "Ingresar" }).click();

  await page.getByRole("link", { name: "Movimientos", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Listado de movimientos" })
  ).toBeVisible();
  await expect(page.getByText("Sin movimientos registrados")).toBeVisible();

  await page.getByRole("button", { name: "Nuevo movimiento" }).first().click();
  const createDialog = page.getByRole("dialog", { name: "Nuevo movimiento" });
  await createDialog.getByLabel("Tipo").selectOption("income");
  await createDialog.getByLabel("Fecha").fill("2026-08-15");
  await createDialog.getByLabel("Importe").fill("1250.50");
  await createDialog.getByLabel("Categoria").selectOption("sale");
  await createDialog.getByLabel("Descripcion").fill("Venta de escritorio");
  await createDialog.getByLabel("Medio de pago").selectOption("bank_transfer");
  await createDialog.getByLabel("Observaciones").fill("Pago confirmado");
  await createDialog.getByRole("button", { name: "Guardar" }).click();

  const createdRow = page
    .getByRole("row")
    .filter({ hasText: "Venta de escritorio" })
    .first();
  await expect(createdRow).toBeVisible();
  await expect(createdRow).toContainText("Venta");
  await expect(createdRow).toContainText(/\$\s1\.250,50/);

  await page
    .getByRole("button", { name: "Editar movimiento Venta de escritorio" })
    .first()
    .click();
  const editDialog = page.getByRole("dialog", { name: "Editar movimiento" });
  await editDialog.getByLabel("Descripcion").fill("Venta de escritorio editada");
  await editDialog.getByLabel("Importe").fill("1300");
  await editDialog.getByRole("button", { name: "Guardar" }).click();

  const editedRow = page
    .getByRole("row")
    .filter({ hasText: "Venta de escritorio editada" })
    .first();
  await expect(editedRow).toBeVisible();
  await expect(editedRow).toContainText(/\$\s1\.300,00/);

  await page.getByRole("button", { name: "Mostrar filtros" }).click();
  await page.getByLabel("Texto").fill("editada");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(editedRow).toBeVisible();

  await page.getByLabel("Texto").fill("sin coincidencias");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page.getByText("Sin resultados para los filtros")).toBeVisible();

  await page.getByRole("button", { name: "Limpiar filtros" }).first().click();
  await expect(editedRow).toBeVisible();

  const exportDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar JSON" }).click();
  expect((await exportDownload).suggestedFilename()).toMatch(
    /^domestic-finance-\d{4}-\d{2}-\d{2}\.json$/
  );

  await page
    .getByLabel("Seleccionar respaldo JSON")
    .setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from("{bad-json")
    });
  await expect(page.getByRole("alert")).toContainText("Importacion invalida");
  await expect(editedRow).toBeVisible();

  const importedDocument = {
    schemaVersion: 1,
    lastUpdatedAt: "2026-08-20T12:00:00.000Z",
    transactions: [
      {
        id: "restored-id",
        type: "expense",
        date: "2026-08-20",
        amount: 777,
        category: "groceries",
        description: "Movimiento restaurado",
        paymentMethod: "debit_card",
        createdAt: "2026-08-20T12:00:00.000Z",
        updatedAt: "2026-08-20T12:00:00.000Z"
      }
    ]
  };
  await page
    .getByLabel("Seleccionar respaldo JSON")
    .setInputFiles({
      name: "valid.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(importedDocument))
    });
  const importDialog = page.getByRole("dialog", {
    name: "Confirmar importacion"
  });
  await expect(importDialog).toBeVisible();
  await expect(importDialog.getByText("Version")).toBeVisible();
  await expect(importDialog.getByText("Movimientos", { exact: true })).toBeVisible();
  const backupDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Descargar respaldo y reemplazar" })
    .click();
  await backupDownload;

  const restoredRow = page
    .getByRole("row")
    .filter({ hasText: "Movimiento restaurado" })
    .first();
  await expect(restoredRow).toBeVisible();
  await expect(restoredRow).toContainText(/\$\s777,00/);

  await page.getByRole("button", { name: "Eliminar todos" }).click();
  const deleteAllDialog = page.getByRole("dialog", {
    name: "Eliminar todos los movimientos"
  });
  await expect(deleteAllDialog).toBeVisible();
  await expect(deleteAllDialog.getByText("Se eliminaran 1 movimientos")).toBeVisible();
  await deleteAllDialog.getByLabel("Contrasena").fill("wrong-password");
  await deleteAllDialog.getByRole("button", { name: "Eliminar todos" }).click();
  await expect(deleteAllDialog.getByRole("alert")).toContainText(
    "Usuario o contrasena invalidos."
  );
  await deleteAllDialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(restoredRow).toBeVisible();

  await page.getByRole("button", { name: "Eliminar todos" }).click();
  await expect(deleteAllDialog).toBeVisible();
  await deleteAllDialog.getByLabel("Contrasena").fill("correct-password");
  await deleteAllDialog.getByRole("button", { name: "Eliminar todos" }).click();

  await expect(page.getByText("Sin movimientos registrados")).toBeVisible();
});
