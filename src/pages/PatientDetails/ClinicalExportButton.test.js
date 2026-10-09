import '@testing-library/jest-dom';
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ClinicalExportButton from "./ClinicalExportButton";
import api from "../../services/axios";
import { downloadPdfResponse } from "../../services/documents";

jest.mock("../../services/axios", () => ({
  __esModule: true, default: { get: jest.fn() },
  getUserFacingApiError: (error, fallback) => fallback,
}));
jest.mock("../../services/documents", () => ({ downloadPdfResponse: jest.fn() }));
const manifest = { count: 23, cases: 3, forms: 2, references: 1, period: "01/10/2026 a 09/10/2026", states: { draft: 2, legacy: 21 }, notice: "Arquivos externos não incorporados." };
beforeEach(() => jest.clearAllMocks());
test("consulta consolidado no servidor e mostra escopo antes de baixar", async () => {
  api.get.mockResolvedValueOnce({ data: manifest }).mockResolvedValueOnce({ data: new Blob(["synthetic"], { type: "application/pdf" }) });
  render(<ClinicalExportButton patientId={9001} />);
  fireEvent.click(screen.getByRole("button", { name: "Exportar prontuário" }));
  expect(await screen.findByText("23 registros")).toBeInTheDocument();
  expect(screen.getByText("Inclui rascunhos não assinados.")).toBeInTheDocument();
  expect(downloadPdfResponse).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Baixar PDF" }));
  await waitFor(() => expect(downloadPdfResponse).toHaveBeenCalledTimes(1));
  expect(api.get.mock.calls.map(([url]) => url)).toEqual(["/patients/9001/clinical-export/preview", "/patients/9001/clinical-export/pdf"]);
});
test("registro usa ID do registro e cancelamento não baixa", async () => {
  api.get.mockResolvedValueOnce({ data: { ...manifest, count: 1 } });
  render(<ClinicalExportButton recordId={11} />);
  fireEvent.click(screen.getByRole("button", { name: "Exportar PDF" }));
  await screen.findByText("1 registro");
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(api.get).toHaveBeenCalledWith("/evaluations/11/export/preview");
  expect(downloadPdfResponse).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
test("falha de prévia permite nova tentativa sem disparar download", async () => {
  api.get.mockRejectedValueOnce(new Error("failed"));
  render(<ClinicalExportButton patientId={9001} />);
  fireEvent.click(screen.getByRole("button", { name: "Exportar prontuário" }));
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  expect(downloadPdfResponse).not.toHaveBeenCalled();
});

test("período envia as mesmas datas inclusivas à prévia e ao download", async () => {
  api.get.mockResolvedValue({ data: manifest });
  render(<ClinicalExportButton patientId={9001} />);
  fireEvent.click(screen.getByRole("button", { name: "Exportar prontuário" }));
  await screen.findByText("23 registros");
  fireEvent.click(screen.getByRole("radio", { name: "Período" }));
  fireEvent.input(screen.getByLabelText("Data inicial"), { target: { value: "2026-09-10" } });
  fireEvent.input(screen.getByLabelText("Data final"), { target: { value: "2026-09-12" } });
  await screen.findByText("23 registros");
  expect(api.get).toHaveBeenCalledWith("/patients/9001/clinical-export/preview", { params: { date_mode: "period", start_date: "2026-09-10", end_date: "2026-09-12" } });
  fireEvent.click(screen.getByRole("button", { name: "Baixar PDF" }));
  await waitFor(() => expect(downloadPdfResponse).toHaveBeenCalledTimes(1));
  expect(api.get).toHaveBeenCalledWith("/patients/9001/clinical-export/pdf", { responseType: "blob", params: { date_mode: "period", start_date: "2026-09-10", end_date: "2026-09-12" } });
});
test("datas iguais representam um dia e período invertido não consulta", async () => {
  api.get.mockResolvedValue({ data: { ...manifest, count: 0, references: 0, empty: true } });
  render(<ClinicalExportButton patientId={9001} />);
  fireEvent.click(screen.getByRole("button", { name: "Exportar prontuário" }));
  await screen.findByText("Nenhum registro encontrado nas datas selecionadas.");
  expect(screen.getByLabelText("Data inicial")).toBeDisabled();
  expect(screen.getByLabelText("Data final")).toBeDisabled();
  expect(screen.getByRole("radio", { name: "Todo o prontuário" })).toBeChecked();
  expect(screen.getByLabelText("Data inicial")).toHaveValue("2026-10-01");
  expect(screen.getByLabelText("Data final")).toHaveValue("2026-10-09");
  fireEvent.click(screen.getByRole("radio", { name: "Período" }));
  fireEvent.input(screen.getByLabelText("Data inicial"), { target: { value: "2026-09-10" } });
  fireEvent.input(screen.getByLabelText("Data final"), { target: { value: "2026-09-10" } });
  await waitFor(() => expect(api.get).toHaveBeenCalledWith("/patients/9001/clinical-export/preview", { params: { date_mode: "period", start_date: "2026-09-10", end_date: "2026-09-10" } }));
  fireEvent.input(screen.getByLabelText("Data final"), { target: { value: "2026-09-09" } });
  await screen.findByText("O fim deve ser igual ou posterior ao início.");
  expect(screen.getByRole("button", { name: "Baixar PDF" })).toBeDisabled();
  expect(downloadPdfResponse).not.toHaveBeenCalled();
});