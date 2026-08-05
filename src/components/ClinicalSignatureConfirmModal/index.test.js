import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import ClinicalSignatureConfirmModal, {
  CLINICAL_SIGNATURE_WARNING,
} from ".";

describe("ClinicalSignatureConfirmModal", () => {
  test("abre no padrão visual com texto e ações corretos", () => {
    render(
      <ClinicalSignatureConfirmModal
        open
        loading={false}
        error=""
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Salvar e assinar?" })).toBeTruthy();
    expect(screen.getByText(CLINICAL_SIGNATURE_WARNING)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("button", { name: "Salvar e assinar" })).toBeTruthy();
  });

  test("cancelar fecha sem executar a assinatura", () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    render(
      <ClinicalSignatureConfirmModal
        open
        loading={false}
        error=""
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test("cliques repetidos confirmam uma única vez", async () => {
    let resolveConfirmation;
    const onConfirm = jest.fn(() => new Promise((resolve) => {
      resolveConfirmation = resolve;
    }));
    render(
      <ClinicalSignatureConfirmModal
        open
        loading={false}
        error=""
        onCancel={jest.fn()}
        onConfirm={onConfirm}
      />,
    );

    const button = screen.getByRole("button", { name: "Salvar e assinar" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    resolveConfirmation();
  });

  test("bloqueia fechamento, mostra carregamento e apresenta erro", () => {
    const onCancel = jest.fn();
    render(
      <ClinicalSignatureConfirmModal
        open
        loading
        error="Conflito real de versão."
        onCancel={onCancel}
        onConfirm={jest.fn()}
      />,
    );

    expect(screen.getByRole("alert").textContent).toContain("Conflito real de versão.");
    expect(screen.getByRole("button", { name: "Salvando e assinando..." }).disabled).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).not.toHaveBeenCalled();
  });
});
