import { describe, expect, it } from "vitest";
import { createErrorDiagnostic } from "./diagnostics";

describe("createErrorDiagnostic", () => {
  it("createErrorDiagnostic_WhenErrorContainsSensitiveValues_ShouldRedactMessage", () => {
    const diagnostic = createErrorDiagnostic(
      new Error("password=plain hash=abc salt=def")
    );

    expect(diagnostic).toEqual({
      name: "Error",
      message: "[redacted]"
    });
  });

  it("createErrorDiagnostic_WhenComponentStackReferencesFullDocument_ShouldRedactStack", () => {
    const diagnostic = createErrorDiagnostic(
      new Error("Render failed"),
      "transactions: [{ amount: 1000 }]"
    );

    expect(diagnostic).toEqual({
      name: "Error",
      message: "Render failed",
      componentStack: "[redacted]"
    });
  });
});
