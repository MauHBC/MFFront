import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import FinancialCancellationDetails from "./FinancialCancellationDetails";

const props = {
  pendingResolutions: [
    { entry_id: 51, series_id: 91, session_starts_at: "2026-10-28T13:00:00Z", can_resolve: true },
    { entry_id: 52, series_id: 92, can_resolve: true },
  ],
  resolutions: [{ id: 1, entry_id: 50, series_id: 91, release_amount_cents: 10000 }],
  packageItem: { kind: "series", sourceId: 91 },
  canResolve: true,
  onResolve: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

test("contrato sem série identifica pendência pela compra e oferece acerto sem sessão", () => {
  render(<FinancialCancellationDetails {...props} packageItem={{ kind: "series", sourceId: 91, package_id: 7 }}
    pendingResolutions={[
      { entry_id: 51, package_id: 7, package_unit_id: 80, session_id: null, can_resolve: true },
      { entry_id: 52, package_id: 8, series_id: 91, can_resolve: true },
    ]}/>);
  expect(screen.getByText("Direito encerrado: acerto financeiro pendente.")).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Resolver pendência" })).toHaveLength(1);
});

test("mostra apenas pendência explícita do pacote, sem aviso ou atalho de histórico", () => {
  const { rerender } = render(<FinancialCancellationDetails {...props} />);
  expect(screen.getByText("Sessão de 28/10/2026: acerto financeiro pendente.")).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Resolver pendência" })).toHaveLength(1);
  expect(screen.queryByText(/Cobrança #/)).not.toBeInTheDocument();
  expect(screen.queryByText("Cancelamento de cobrança")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Cancelar cobrança/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Resolver pendência" }));
  expect(props.onResolve).toHaveBeenCalledWith(props.pendingResolutions[0]);
  expect(screen.queryByText(/Há alterações financeiras registradas/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Ver histórico financeiro" })).not.toBeInTheDocument();
  rerender(<FinancialCancellationDetails {...props} canResolve={false} />);
  expect(screen.queryByRole("button", { name: "Resolver pendência" })).not.toBeInTheDocument();
  expect(screen.getByText(/acerto financeiro pendente/)).toBeInTheDocument();
  expect(screen.queryByText(/Há alterações financeiras registradas/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Ver histórico financeiro" })).not.toBeInTheDocument();
});

test("sem pendência não renderiza bloco nem reserva espaço, mesmo com alterações concluídas ou candidatos gerais", () => {
  const { container } = render(<FinancialCancellationDetails {...props} pendingResolutions={[]}
    candidates={[{ entry_id: 51, series_id: 91 }]} />);
  expect(container).toBeEmptyDOMElement();
});

test("sem autorização explícita do servidor não oferece resolução", () => {
  render(<FinancialCancellationDetails {...props} pendingResolutions={[
    { entry_id: 51, series_id: 91, can_resolve: false },
    { entry_id: 52, series_id: 91 },
  ]} />);
  expect(screen.queryByRole("button", { name: "Resolver pendência" })).not.toBeInTheDocument();
});

test("avulsa do DTO unificado identifica pendência pelo lançamento, sem confundir ID de sessão", () => {
  render(<FinancialCancellationDetails {...props} packageItem={{ kind: "entry", sourceId: 51 }}
    pendingResolutions={[
      { entry_id: 51, session_id: 701, can_resolve: true },
      { entry_id: 52, session_id: 51, can_resolve: true },
    ]} />);
  expect(screen.getAllByRole("button", { name: "Resolver pendência" })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Resolver pendência" }));
  expect(props.onResolve).toHaveBeenCalledWith(expect.objectContaining({ entry_id: 51, session_id: 701 }));
});
