import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "./dialog";

describe("Dialog", () => {
  it("Dialog_WhenOpened_ShouldExposeTitleDescriptionAndCloseAction", async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger>Abrir modal</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar accion</DialogTitle>
            <DialogDescription>Detalle de la confirmacion.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );

    await user.click(screen.getByRole("button", { name: "Abrir modal" }));

    expect(screen.getByRole("dialog")).toHaveAccessibleName(
      "Confirmar accion"
    );
    expect(screen.getByText("Detalle de la confirmacion.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
