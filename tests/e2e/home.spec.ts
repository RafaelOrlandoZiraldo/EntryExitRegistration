import { expect, test } from "@playwright/test";

test("home route redirects to login when there is no valid session", async ({
  page
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /registro domestico/i })
  ).toBeVisible();
  await expect(page.getByLabel("Usuario")).toBeVisible();
});

test("direct navigation and refresh keep login and protected routes usable", async ({
  page
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: /registro domestico/i })
  ).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Usuario")).toBeVisible();

  await page.goto("/transactions");
  await expect(page).toHaveURL(/\/login\?redirectTo=%2Ftransactions$/);
  await page.getByLabel("Usuario").fill("admin");
  await page.getByLabel("Contrasena").fill("correct-password");
  await page.getByRole("button", { name: "Ingresar" }).click();

  await expect(
    page.getByRole("heading", { name: "Listado de movimientos" })
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Listado de movimientos" })
  ).toBeVisible();
});

test("valid login without redirect opens the protected dashboard route", async ({
  page
}) => {
  await page.goto("/login");

  await page.getByLabel("Usuario").fill("admin");
  await page.getByLabel("Contrasena").fill("correct-password");
  await page.getByRole("button", { name: "Ingresar" }).click();

  await expect(page).toHaveURL(/\/transactions$/);
  await expect(
    page.getByRole("heading", { name: "Listado de movimientos" })
  ).toBeVisible();
});
