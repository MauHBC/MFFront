import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import Dashboard from ".";
import axios from "../../services/axios";
import {
  listFinancialEntries,
  listFinancialPayments,
} from "../../services/financial";

jest.mock("../../components/AppShell", () => function AppShellMock({ children }) {
  return <div data-testid="app-shell">{children}</div>;
});

jest.mock("../../services/axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

jest.mock("../../services/financial", () => ({
  listFinancialEntries: jest.fn(),
  listFinancialPayments: jest.fn(),
}));

const mockCanAccessModule = jest.fn(() => true);
jest.mock("../../contexts/AuthorizationContext", () => ({
  useAuthorization: () => ({ canAccessModule: mockCanAccessModule }),
}));

describe("Dashboard", () => {
  beforeEach(() => {
    mockCanAccessModule.mockImplementation(() => true);
    axios.get.mockImplementation((url) => {
      if (url === "/operational-alerts") return Promise.resolve({ data: { alerts: [] } });
      return Promise.resolve({ data: [] });
    });
    listFinancialEntries.mockResolvedValue({ data: [] });
    listFinancialPayments.mockResolvedValue({ data: [] });
  });

  it("nao consulta APIs amplas de usuarios nem modulos sem permissao oficial", async () => {
    mockCanAccessModule.mockImplementation((moduleKey) => moduleKey === "dashboard");

    render(<Dashboard />);

    expect(await screen.findByRole("heading", { name: "Agenda" })).toBeInTheDocument();
    expect(axios.get).not.toHaveBeenCalled();
    expect(listFinancialEntries).not.toHaveBeenCalled();
    expect(listFinancialPayments).not.toHaveBeenCalled();
  });

  it("preserva filtros e seções operacionais dentro do App Shell", async () => {
    render(<Dashboard />);

    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Painel" })).toBeInTheDocument();
    expect(screen.getByLabelText("Período mensal")).toBeInTheDocument();
    expect(screen.getByLabelText("Profissional")).toBeInTheDocument();
    expect(screen.getByLabelText("Serviço")).toBeInTheDocument();

    expect(await screen.findByRole("heading", { name: "Agenda" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Financeiro" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pendências" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Profissionais" })).toBeInTheDocument();
  });
});
