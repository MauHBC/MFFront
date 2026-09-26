import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FinancialCreditUseModal from "./FinancialCreditUseModal";
import { getFinancialCreditDestinations, previewFinancialCreditApplication, confirmFinancialCreditApplication } from "../../../services/financialCredit";

jest.mock("../../../services/financialCredit", () => ({
  getFinancialCreditDestinations: jest.fn(), previewFinancialCreditApplication: jest.fn(), confirmFinancialCreditApplication: jest.fn(),
}));
jest.mock("../../../services/axios", () => ({ getUserFacingApiError: (error, fallback) => fallback }));

const currency = (value) => `R$ ${(value / 100).toFixed(2).replace(".", ",")}`;
const context = { patientId: 30, patientName: "TESTE Cancelamento Parcial", periodStart: "2026-10-01", periodEnd: "2026-10-31", periodLabel: "outubro de 2026" };
const patient = { id: 30, full_name: "TESTE Cancelamento Parcial" };
const entry = (id, day) => ({ entry_id: id, session_id: id + 500, session_starts_at: `2026-11-${day}T13:00:00.000Z`, service_name: "Fisioterapia", amount_cents: 10000, paid_cents: 0, open_cents: 10000 });
const group = {
  key: "package-90", kind: "package", series_id: 90, service_name: "Fisioterapia", reference_date: "2026-10-28T13:00:00.000Z",
  amount_cents: 30000, paid_cents: 0, open_cents: 30000, entries: [entry(101, "04"), entry(102, "11"), entry(103, "18")],
};
const single = { key: "single-201", kind: "standalone", service_name: "Pilates", reference_date: "2026-10-30T13:00:00.000Z", amount_cents: 10000, paid_cents: 0, open_cents: 10000, entries: [{ ...entry(201, "04"), service_name: "Pilates" }] };
const destinations = (groups = [group], credit = 5000) => ({ patient, credit_available_cents: credit, groups });
const makePreview = (body, groups = [group], credit = 5000) => {
  let remaining = body.amount_cents;
  const rows = groups.filter((item) => item.entries.some((row) => body.selected_entry_ids.includes(row.entry_id))).map((item) => {
    const entries = item.entries.filter((row) => body.selected_entry_ids.includes(row.entry_id)).map((row) => {
      const allocated = Math.min(row.open_cents, remaining); remaining -= allocated;
      return { ...row, selected: true, allocated_cents: allocated, open_after_cents: row.open_cents - allocated };
    });
    const allocated = entries.reduce((sum, row) => sum + row.allocated_cents, 0);
    return { ...item, entries, allocated_cents: allocated, open_after_cents: item.open_cents - allocated };
  });
  const open = rows.flatMap((item) => item.entries).reduce((sum, row) => sum + row.open_cents, 0);
  return { patient, credit_available_cents: credit, credit_remaining_cents: credit - body.amount_cents, amount_cents: body.amount_cents,
    selected_open_before_cents: open, selected_open_after_cents: open - body.amount_cents, groups: rows, preview_fingerprint: "review-1" };
};
const setup = (props = {}) => {
  const callbacks = { onClose: jest.fn(), onCompleted: jest.fn(), ...props };
  return { ...render(<FinancialCreditUseModal context={context} formatCurrency={currency} {...callbacks} />), ...callbacks };
};
const advance = async () => {
  const button = screen.getByRole("button", { name: "Avançar" });
  await waitFor(() => expect(button).toBeEnabled());
  await userEvent.click(button);
  return screen.findByRole("heading", { name: "Conferir uso do crédito" });
};
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { resolve, reject, promise };
};

beforeEach(() => {
  jest.clearAllMocks();
  getFinancialCreditDestinations.mockResolvedValue({ data: destinations() });
  previewFinancialCreditApplication.mockImplementation(async (body) => ({ data: makePreview(body) }));
  confirmFinancialCreditApplication.mockImplementation(async (body) => ({ data: { ...makePreview(body), command_id: 8, replayed: false } }));
});

test("consulta o servidor, seleciona somente grupo único e expande sessões na mesma janela", async () => {
  setup();
  expect(await screen.findByRole("checkbox", { name: /Pacote de Fisioterapia/ })).toBeChecked();
  expect(getFinancialCreditDestinations).toHaveBeenCalledWith({ patient_id: 30, period_start: "2026-10-01", period_end: "2026-10-31" });
  await waitFor(() => expect(screen.getByLabelText("Valor a usar")).toHaveValue("50,00"));
  expect(screen.getByText(patient.full_name)).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Escolher sessões" }));
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(screen.getByRole("checkbox", { name: /04\/11\/2026, 10:00/ })).toBeChecked();
  expect(previewFinancialCreditApplication).not.toHaveBeenCalled();
  expect(confirmFinancialCreditApplication).not.toHaveBeenCalled();
});

test("vários grupos não são escolhidos automaticamente; pacote e seleção parcial não duplicam obrigações", async () => {
  getFinancialCreditDestinations.mockResolvedValue({ data: destinations([group, single]) });
  previewFinancialCreditApplication.mockImplementation(async (body) => ({ data: makePreview(body, [group, single]) }));
  setup();
  const packageCheckbox = await screen.findByRole("checkbox", { name: /Pacote de Fisioterapia/ });
  expect(packageCheckbox).not.toBeChecked();
  expect(screen.getByRole("checkbox", { name: /Sessão avulsa de Pilates/ })).not.toBeChecked();
  expect(screen.getByRole("button", { name: "Avançar" })).toBeDisabled();
  await userEvent.click(packageCheckbox);
  await userEvent.click(screen.getByRole("button", { name: "Escolher sessões" }));
  await userEvent.click(screen.getByRole("checkbox", { name: /11\/11\/2026/ }));
  expect(packageCheckbox).toHaveAttribute("aria-checked", "mixed");
  await userEvent.click(screen.getByRole("checkbox", { name: /Sessão avulsa de Pilates/ }));
  await advance();
  expect(previewFinancialCreditApplication).toHaveBeenCalledWith(expect.objectContaining({ selected_entry_ids: [101, 103, 201], amount_cents: 5000 }));
  expect(confirmFinancialCreditApplication).not.toHaveBeenCalled();
});

test("permite centavos e valor parcial; voltar conserva escolhas e nova edição exige outra prévia", async () => {
  setup();
  await waitFor(() => expect(screen.getByRole("button", { name: "Avançar" })).toBeEnabled());
  fireEvent.change(screen.getByLabelText("Valor a usar"), { target: { value: "12,34" } });
  await advance();
  expect(screen.getByRole("button", { name: "Confirmar" })).toBeEnabled();
  await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
  expect(screen.getByLabelText("Valor a usar")).toHaveValue("12,34");
  expect(screen.getByRole("checkbox", { name: /Pacote de/ })).toBeChecked();
  await userEvent.click(screen.getByRole("button", { name: "Escolher sessões" }));
  await userEvent.click(screen.getByRole("checkbox", { name: /18\/11\/2026/ }));
  expect(screen.getByLabelText("Valor a usar")).toHaveValue("12,34");
  expect(screen.queryByRole("button", { name: "Confirmar" })).not.toBeInTheDocument();
  await advance();
  expect(previewFinancialCreditApplication).toHaveBeenLastCalledWith(expect.objectContaining({ selected_entry_ids: [101, 102], amount_cents: 1234 }));
});

test.each(["", "0", "50,01"])("não avança valor inválido %s nem seleção vazia", async (value) => {
  setup();
  await waitFor(() => expect(screen.getByRole("button", { name: "Avançar" })).toBeEnabled());
  fireEvent.change(screen.getByLabelText("Valor a usar"), { target: { value } });
  expect(screen.getByRole("button", { name: "Avançar" })).toBeDisabled();
  await userEvent.click(screen.getByRole("checkbox", { name: /Pacote de/ }));
  expect(screen.getByRole("button", { name: "Avançar" })).toBeDisabled();
  expect(previewFinancialCreditApplication).not.toHaveBeenCalled();
});

test("revisão mostra exclusivamente destinos que recebem crédito e distingue sessão, pacote e seleção", async () => {
  setup(); await advance();
  const list = screen.getByRole("list", { name: "Destinos conferidos" });
  expect(within(list).getByText("Fisioterapia — 04/11/2026, 10:00")).toBeVisible();
  expect(within(list).queryByText(/11\/11\/2026/)).not.toBeInTheDocument();
  expect(screen.getByText("A receber nesta sessão após o uso: R$ 50,00")).toBeVisible();
  expect(screen.getByText("A receber no pacote após o uso: R$ 250,00")).toBeVisible();
  expect(screen.getByText("A receber na seleção após o uso").parentElement).toHaveTextContent("R$ 250,00");
  expect(screen.getByText("Crédito restante").parentElement).toHaveTextContent("R$ 0,00");
  expect(screen.queryByText(/101|package-90|fingerprint|dívida total/i)).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("heading", { name: "Conferir uso do crédito" })).toHaveFocus());
});

test("não substitui a aplicação e os saldos recebidos por uma simulação local", async () => {
  previewFinancialCreditApplication.mockImplementation(async (body) => {
    const data = makePreview(body);
    data.groups[0].entries[0].allocated_cents = 0;
    data.groups[0].entries[0].open_after_cents = 10000;
    data.groups[0].entries[1].allocated_cents = 5000;
    data.groups[0].entries[1].open_after_cents = 5000;
    data.groups[0].open_after_cents = 24000;
    data.selected_open_after_cents = 23000;
    return { data };
  });
  setup(); await advance();
  expect(screen.getByText("Fisioterapia — 11/11/2026, 10:00")).toBeVisible();
  expect(screen.queryByText("Fisioterapia — 04/11/2026, 10:00")).not.toBeInTheDocument();
  expect(screen.getByText("A receber no pacote após o uso: R$ 240,00")).toBeVisible();
  expect(screen.getByText("A receber na seleção após o uso").parentElement).toHaveTextContent("R$ 230,00");
});

test("um clique confirma exatamente a prévia e bloqueia duplo envio", async () => {
  const pending = deferred();
  confirmFinancialCreditApplication.mockReturnValue(pending.promise);
  const { onCompleted } = setup(); await advance();
  const apply = screen.getByRole("button", { name: "Confirmar" });
  fireEvent.click(apply); fireEvent.click(apply);
  expect(confirmFinancialCreditApplication).toHaveBeenCalledTimes(1);
  expect(confirmFinancialCreditApplication).toHaveBeenCalledWith({ patient_id: 30, period_start: "2026-10-01", period_end: "2026-10-31", selected_entry_ids: [101, 102, 103], amount_cents: 5000, preview_fingerprint: "review-1" }, expect.any(String));
  expect(screen.getByRole("button", { name: "Voltar" })).toBeDisabled();
  await act(async () => pending.resolve({ data: { patient, amount_cents: 5000, command_id: 8 } }));
  expect(onCompleted).toHaveBeenCalledTimes(1);
});

test.each([undefined, 500])("resposta incerta %s conserva comando/chave e bloqueia edição e fechamento até retry", async (status) => {
  confirmFinancialCreditApplication.mockRejectedValueOnce(status ? { response: { status } } : new Error("Rede"));
  const { onClose, onCompleted } = setup(); await advance();
  await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("button", { name: "Voltar" })).toBeDisabled();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onClose).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  expect(confirmFinancialCreditApplication.mock.calls[1]).toEqual(confirmFinancialCreditApplication.mock.calls[0]);
  expect(onCompleted).toHaveBeenCalledTimes(1);
});

test("mudança concorrente recarrega revisão e exige outro clique com outra chave", async () => {
  confirmFinancialCreditApplication.mockRejectedValueOnce({ response: { status: 409, data: { code: "CREDIT_APPLICATION_PREVIEW_STALE" } } });
  previewFinancialCreditApplication.mockImplementationOnce(async (body) => ({ data: makePreview(body) }))
    .mockImplementationOnce(async (body) => ({ data: { ...makePreview(body), preview_fingerprint: "review-2" } }));
  setup(); await advance();
  await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Os dados mudaram. Confira os valores atualizados antes de aplicar o crédito.");
  expect(confirmFinancialCreditApplication).toHaveBeenCalledTimes(1);
  expect(previewFinancialCreditApplication).toHaveBeenCalledTimes(2);
  await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  const { calls } = confirmFinancialCreditApplication.mock;
  expect(calls[1][0].preview_fingerprint).toBe("review-2");
  expect(calls[1][1]).not.toBe(calls[0][1]);
});

test("prévia obsoleta sem seleção válida retorna à escolha sem selecionar novo grupo automaticamente", async () => {
  confirmFinancialCreditApplication.mockRejectedValueOnce({ response: { status: 409, data: { code: "CREDIT_APPLICATION_PREVIEW_STALE" } } });
  previewFinancialCreditApplication.mockImplementationOnce(async (body) => ({ data: makePreview(body) })).mockRejectedValueOnce({ response: { status: 400 } });
  getFinancialCreditDestinations.mockResolvedValueOnce({ data: destinations() }).mockResolvedValueOnce({ data: destinations([single]) });
  setup(); await advance();
  await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  const checkbox = await screen.findByRole("checkbox", { name: /Sessão avulsa de Pilates/ });
  expect(checkbox).not.toBeChecked();
  expect(screen.getByRole("button", { name: "Avançar" })).toBeDisabled();
  expect(confirmFinancialCreditApplication).toHaveBeenCalledTimes(1);
});

test("se limite mudou, retorna à escolha preservando interseção e ajusta somente valor inválido", async () => {
  confirmFinancialCreditApplication.mockRejectedValueOnce({ response: { status: 409, data: { code: "CREDIT_APPLICATION_PREVIEW_STALE" } } });
  previewFinancialCreditApplication.mockImplementationOnce(async (body) => ({ data: makePreview(body) })).mockRejectedValueOnce({ response: { status: 400 } });
  getFinancialCreditDestinations.mockResolvedValueOnce({ data: destinations() }).mockResolvedValueOnce({ data: destinations([{ ...group, entries: [group.entries[1]] }], 2500) });
  setup(); await advance();
  await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  await screen.findByRole("checkbox", { name: /Pacote de/ });
  await waitFor(() => expect(screen.getByLabelText("Valor a usar")).toHaveValue("25,00"));
  expect(screen.getByRole("checkbox", { name: /Pacote de/ })).toBeChecked();
  expect(confirmFinancialCreditApplication).toHaveBeenCalledTimes(1);
});

test.each([403, 500])("falha de prévia %s mantém etapa1 e nunca aplica nem faz fallback", async (status) => {
  previewFinancialCreditApplication.mockRejectedValueOnce({ response: { status } });
  setup();
  await waitFor(() => expect(screen.getByRole("button", { name: "Avançar" })).toBeEnabled());
  await userEvent.click(screen.getByRole("button", { name: "Avançar" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("heading", { name: "Onde usar o crédito?" })).toBeInTheDocument();
  expect(confirmFinancialCreditApplication).not.toHaveBeenCalled();
});

test("destinos vazios ou de outro paciente não habilitam nenhuma aplicação", async () => {
  getFinancialCreditDestinations.mockResolvedValueOnce({ data: { ...destinations(), patient: { id: 999, full_name: "Outro paciente" } } });
  setup();
  await screen.findByRole("alert");
  expect(screen.queryByText("Outro paciente")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Avançar" })).toBeDisabled();
  getFinancialCreditDestinations.mockResolvedValueOnce({ data: destinations([]) });
  await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  expect(await screen.findByText("Nenhum pacote ou sessão avulsa elegível neste período.")).toBeVisible();
});

test("prévia de outro paciente ou seleção é rejeitada sem confirmação", async () => {
  previewFinancialCreditApplication.mockImplementationOnce(async (body) => ({ data: makePreview({ ...body, selected_entry_ids: [101] }) }));
  setup();
  await waitFor(() => expect(screen.getByRole("button", { name: "Avançar" })).toBeEnabled());
  await userEvent.click(screen.getByRole("button", { name: "Avançar" }));
  await screen.findByRole("alert");
  expect(screen.queryByRole("button", { name: "Confirmar" })).not.toBeInTheDocument();
  expect(confirmFinancialCreditApplication).not.toHaveBeenCalled();
});

test("desmontagem ignora prévia tardia, restaura rolagem e foco", async () => {
  const trigger = document.createElement("button"); document.body.appendChild(trigger); trigger.focus();
  const pending = deferred(); previewFinancialCreditApplication.mockReturnValue(pending.promise);
  const { unmount, onCompleted } = setup();
  await waitFor(() => expect(screen.getByRole("button", { name: "Avançar" })).toBeEnabled());
  await userEvent.click(screen.getByRole("button", { name: "Avançar" }));
  unmount();
  await act(async () => pending.resolve({ data: makePreview({ selected_entry_ids: [101, 102, 103], amount_cents: 5000 }) }));
  expect(onCompleted).not.toHaveBeenCalled();
  expect(trigger).toHaveFocus();
  expect(document.body.style.overflow).not.toBe("hidden"); trigger.remove();
});

test("teclado mantém foco no modal e Escape fecha somente fora do envio", async () => {
  const { onClose } = setup(); await screen.findByRole("checkbox", { name: /Pacote de/ });
  const next = screen.getByRole("button", { name: "Avançar" });
  await waitFor(() => expect(next).toBeEnabled());
  next.focus();
  fireEvent.keyDown(document, { key: "Tab" });
  expect(screen.getByRole("checkbox", { name: /Pacote de/ })).toHaveFocus();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(1);
});


test("retry da consulta após prévia obsoleta não seleciona novo grupo sozinho", async () => {
  confirmFinancialCreditApplication.mockRejectedValueOnce({ response: { status: 409, data: { code: "CREDIT_APPLICATION_PREVIEW_STALE" } } });
  previewFinancialCreditApplication.mockImplementationOnce(async (body) => ({ data: makePreview(body) })).mockRejectedValueOnce({ response: { status: 400 } });
  getFinancialCreditDestinations.mockResolvedValueOnce({ data: destinations() }).mockRejectedValueOnce(new Error("Consulta indisponível"))
    .mockResolvedValueOnce({ data: destinations([single]) });
  setup(); await advance();
  await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  await userEvent.click(await screen.findByRole("button", { name: "Tentar novamente" }));
  expect(await screen.findByRole("checkbox", { name: /Sessão avulsa de Pilates/ })).not.toBeChecked();
  expect(screen.getByRole("button", { name: "Avançar" })).toBeDisabled();
  expect(confirmFinancialCreditApplication).toHaveBeenCalledTimes(1);
});

test("reduzir saldo selecionado conserva valor parcial ainda válido", async () => {
  getFinancialCreditDestinations.mockResolvedValue({ data: destinations([group], 20000) });
  setup();
  await waitFor(() => expect(screen.getByLabelText("Valor a usar")).toHaveValue("200,00"));
  fireEvent.change(screen.getByLabelText("Valor a usar"), { target: { value: "12,34" } });
  await userEvent.click(screen.getByRole("button", { name: "Escolher sessões" }));
  await userEvent.click(screen.getByRole("checkbox", { name: /11\/11\/2026/ }));
  await userEvent.click(screen.getByRole("checkbox", { name: /18\/11\/2026/ }));
  expect(screen.getByText("Até R$ 100,00 nos destinos selecionados.")).toBeVisible();
  expect(screen.getByLabelText("Valor a usar")).toHaveValue("12,34");
});


test("falha temporária ao recarregar destinos conserva valor editado válido no retry", async () => {
  confirmFinancialCreditApplication.mockRejectedValueOnce({ response: { status: 409, data: { code: "CREDIT_APPLICATION_PREVIEW_STALE" } } });
  previewFinancialCreditApplication.mockImplementationOnce(async (body) => ({ data: makePreview(body) })).mockRejectedValueOnce({ response: { status: 400 } });
  getFinancialCreditDestinations.mockResolvedValueOnce({ data: destinations() }).mockRejectedValueOnce(new Error("Consulta indisponível"))
    .mockResolvedValueOnce({ data: destinations() });
  setup();
  await waitFor(() => expect(screen.getByRole("button", { name: "Avançar" })).toBeEnabled());
  fireEvent.change(screen.getByLabelText("Valor a usar"), { target: { value: "12,34" } });
  await advance();
  await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  await userEvent.click(await screen.findByRole("button", { name: "Tentar novamente" }));
  await waitFor(() => expect(screen.getByLabelText("Valor a usar")).toHaveValue("12,34"));
  expect(confirmFinancialCreditApplication).toHaveBeenCalledTimes(1);
});


test("Voltar após stale consulta saldos atuais sem mostrar catálogo antigo durante o carregamento", async () => {
  const reload = deferred();
  getFinancialCreditDestinations.mockResolvedValueOnce({ data: destinations() }).mockReturnValueOnce(reload.promise);
  confirmFinancialCreditApplication.mockRejectedValueOnce({ response: { status: 409, data: { code: "CREDIT_APPLICATION_PREVIEW_STALE" } } });
  previewFinancialCreditApplication.mockImplementationOnce(async (body) => ({ data: makePreview(body) }))
    .mockImplementationOnce(async (body) => ({ data: { ...makePreview(body, [group], 15000), preview_fingerprint: "review-2" } }));
  setup(); await advance();
  await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  await screen.findByRole("alert");
  expect(screen.getByText("Crédito disponível").parentElement).toHaveTextContent("R$ 150,00");
  await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
  expect(screen.getByRole("heading", { name: "Conferir uso do crédito" })).toBeInTheDocument();
  expect(screen.queryByLabelText("Valor a usar")).not.toBeInTheDocument();
  expect(screen.getByText("Crédito disponível").parentElement).toHaveTextContent("R$ 150,00");
  expect(screen.getByRole("button", { name: "Voltar" })).toBeDisabled();
  await act(async () => reload.resolve({ data: destinations([group], 15000) }));
  expect(await screen.findByRole("heading", { name: "Onde usar o crédito?" })).toBeInTheDocument();
  expect(screen.getByText("Crédito disponível").parentElement).toHaveTextContent("R$ 150,00");
  expect(screen.getByLabelText("Valor a usar")).toHaveValue("50,00");
  fireEvent.change(screen.getByLabelText("Valor a usar"), { target: { value: "100,00" } });
  expect(screen.getByRole("button", { name: "Avançar" })).toBeEnabled();
  expect(confirmFinancialCreditApplication).toHaveBeenCalledTimes(1);
});

test("falha do catálogo ao Voltar preserva nova revisão; retry conserva valor parcial e escolhas válidas", async () => {
  getFinancialCreditDestinations.mockResolvedValueOnce({ data: destinations() })
    .mockRejectedValueOnce(new Error("Consulta indisponível"))
    .mockResolvedValueOnce({ data: destinations([{ ...group, entries: [group.entries[0], group.entries[2]], open_cents: 20000 }], 15000) });
  confirmFinancialCreditApplication.mockRejectedValueOnce({ response: { status: 409, data: { code: "CREDIT_APPLICATION_PREVIEW_STALE" } } });
  previewFinancialCreditApplication.mockImplementationOnce(async (body) => ({ data: makePreview(body) }))
    .mockImplementationOnce(async (body) => ({ data: { ...makePreview(body, [group], 15000), preview_fingerprint: "review-2" } }));
  setup();
  await waitFor(() => expect(screen.getByRole("button", { name: "Avançar" })).toBeEnabled());
  fireEvent.change(screen.getByLabelText("Valor a usar"), { target: { value: "12,34" } });
  await advance();
  await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  await screen.findByRole("alert");
  await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("A revisão foi preservada. Tente voltar novamente.");
  expect(screen.getByRole("heading", { name: "Conferir uso do crédito" })).toBeInTheDocument();
  expect(screen.getByText("Crédito disponível").parentElement).toHaveTextContent("R$ 150,00");
  expect(screen.queryByLabelText("Valor a usar")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
  await waitFor(() => expect(screen.getByLabelText("Valor a usar")).toHaveValue("12,34"));
  expect(screen.getByRole("checkbox", { name: /Pacote de/ })).toBeChecked();
  await userEvent.click(screen.getByRole("button", { name: "Escolher sessões" }));
  expect(screen.queryByRole("checkbox", { name: /11\/11\/2026/ })).not.toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: /04\/11\/2026/ })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: /18\/11\/2026/ })).toBeChecked();
  expect(confirmFinancialCreditApplication).toHaveBeenCalledTimes(1);
});
