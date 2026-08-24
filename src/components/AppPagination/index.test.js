import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

import AppPagination from ".";

const defaultProps = {
  page: 2,
  pageSize: 10,
  total: 43,
  totalPages: 5,
  loading: false,
  onPageChange: jest.fn(),
  ariaLabel: "Paginação de teste",
};

beforeEach(() => {
  defaultProps.onPageChange.mockClear();
});

it("expõe resumo, página e navegação sem conhecer a fonte dos dados", () => {
  render(<AppPagination {...defaultProps} />);

  expect(screen.getByRole("navigation", { name: "Paginação de teste" }))
    .toBeInTheDocument();
  expect(screen.getByText("Mostrando 11-20 de 43")).toBeInTheDocument();
  expect(screen.getByText("Página 2 de 5")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
  fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
  expect(defaultProps.onPageChange).toHaveBeenNthCalledWith(1, 1);
  expect(defaultProps.onPageChange).toHaveBeenNthCalledWith(2, 3);
});

it("desabilita os limites e todas as ações durante loading", () => {
  const { rerender } = render(<AppPagination {...defaultProps} page={1} />);
  expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Próxima" })).toBeEnabled();

  rerender(<AppPagination {...defaultProps} page={5} />);
  expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();

  rerender(<AppPagination {...defaultProps} loading />);
  expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();
});

it("não ocupa espaço sem resultados e limita o intervalo em páginas excedentes", () => {
  const { rerender } = render(<AppPagination {...defaultProps} total={0} totalPages={0} />);
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument();

  rerender(<AppPagination {...defaultProps} page={9} />);
  expect(screen.getByText("Mostrando 43-43 de 43")).toBeInTheDocument();
});
