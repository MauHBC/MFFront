import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route } from "react-router-dom";
import PatientSelfSignup from ".";
import axios from "../../services/axios";
import CommercialBoundary from "../SelfService/CommercialBoundary";
import { PublicClinicProvider } from "../../contexts/PublicClinicContext";

jest.mock("../../services/axios", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("react-toastify", () => ({ toast: { error: jest.fn() } }));
jest.mock("react-redux", () => ({ useSelector: (selector) => selector({ auth: { isLoggedIn: true } }) }));
jest.mock("../../contexts/CommercialContext", () => ({
  useCommercial: () => ({ status: "ready", data: { managed: true, state: "trial_expired" } }),
}));
const renderPage = (path = "/c/agenda-de-joao-2/synthetic-placeholder") => render(
  <MemoryRouter initialEntries={[path]}>
    <Route path={["/c/:slug/:token", "/c/:token", "/cadastro/paciente/:token"]}>
      <CommercialBoundary><PatientSelfSignup /></CommercialBoundary>
    </Route>
  </MemoryRouter>,
);

beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockResolvedValue({ data: { valid: true, identity: { name: "Agenda de João", logo_url: null } } });
  axios.post.mockResolvedValue({ data: { received: true } });
});

test("shows invite identity, title and optional logo with a slug-bound lookup", async () => {
  axios.get.mockResolvedValue({ data: { valid: true, identity: { name: "Espaço Cuidar", logo_url: "/assets/brand.png" } } });
  renderPage();
  expect(await screen.findByText("Espaço Cuidar")).toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledWith("/public/patient-invites/synthetic-placeholder?slug=agenda-de-joao-2");
  const logo = screen.getByAltText("");
  expect(logo).toHaveAttribute("src", "/assets/brand.png");
  expect(logo).toHaveAttribute("aria-hidden", "true");
  const identity = screen.getByRole("group", { name: "Identidade do atendimento" });
  const name = screen.getByText("Espaço Cuidar");
  expect(logo.parentElement).toBe(identity);
  expect(name.parentElement).toBe(identity);
  expect(identity.nextElementSibling).toBe(screen.getByRole("heading", { name: "Cadastro do paciente", level: 1 }));
  expect(screen.getAllByText("Espaço Cuidar")).toHaveLength(1);
  await waitFor(() => expect(document.title).toBe("Cadastro do paciente | Espaço Cuidar"));
  fireEvent.error(logo);
  expect(identity.querySelector("img")).toBeNull();
  expect(screen.getByText("Espaço Cuidar")).toBeInTheDocument();
});

test("long autonomous names remain in the identity block without a logo or repeated subtitle", async () => {
  const name = "Agenda de profissional com nome muito longo e atendimento especializado";
  axios.get.mockResolvedValue({ data: { valid: true, identity: { name, logo_url: null } } });
  renderPage();
  const identityName = await screen.findByText(name);
  const identity = screen.getByRole("group", { name: "Identidade do atendimento" });
  expect(identityName.parentElement).toBe(identity);
  expect(identity.querySelector("img")).toBeNull();
  expect(screen.getAllByText(name)).toHaveLength(1);
  expect(identity.nextElementSibling).toBe(screen.getByRole("heading", { name: "Cadastro do paciente", level: 1 }));
});

test("legacy route retains intake contract and optional-logo fallback", async () => {
  const { container } = renderPage("/cadastro/paciente/synthetic-legacy-placeholder");
  expect(await screen.findByText("Agenda de João")).toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  fireEvent.change(container.querySelector('[name="full_name"]'), { target: { value: "Paciente Sintético" } });
  fireEvent.click(container.querySelector('[name="consent_data_processing"]'));
  fireEvent.click(container.querySelector('[name="consent_info_truth"]'));
  fireEvent.submit(container.querySelector("form"));
  await screen.findByText("Cadastro enviado");
  expect(axios.post).toHaveBeenCalledWith("/public/patient-intake/synthetic-legacy-placeholder", expect.objectContaining({
    full_name: "Paciente Sintético", consent_data_processing: true, consent_info_truth: true,
  }));
});

test("new route includes its slug in intake without submitting a tenant", async () => {
  const { container } = renderPage();
  await screen.findByText("Agenda de João");
  fireEvent.change(container.querySelector('[name="full_name"]'), { target: { value: "Paciente Sintético" } });
  fireEvent.click(container.querySelector('[name="consent_data_processing"]'));
  fireEvent.click(container.querySelector('[name="consent_info_truth"]'));
  fireEvent.submit(container.querySelector("form"));
  await screen.findByText("Cadastro enviado");
  expect(axios.post.mock.calls[0][0]).toBe("/public/patient-intake/synthetic-placeholder?slug=agenda-de-joao-2");
  expect(axios.post.mock.calls[0][1]).not.toHaveProperty("clinic_id");
});

test("custom domain short route resolves the token without inventing a slug or tenant", async () => {
  const { container } = renderPage("/c/synthetic-short-placeholder");
  await screen.findByText("Agenda de João");
  expect(axios.get).toHaveBeenCalledWith("/public/patient-invites/synthetic-short-placeholder");
  fireEvent.change(container.querySelector('[name="full_name"]'), { target: { value: "Paciente Sintético" } });
  fireEvent.click(container.querySelector('[name="consent_data_processing"]'));
  fireEvent.click(container.querySelector('[name="consent_info_truth"]'));
  fireEvent.submit(container.querySelector("form"));
  await screen.findByText("Cadastro enviado");
  expect(axios.post.mock.calls[0][0]).toBe("/public/patient-intake/synthetic-short-placeholder");
  expect(axios.post.mock.calls[0][1]).not.toHaveProperty("clinic_id");
});

test("transitional frontend still renders the published backend response without identity", async () => {
  axios.get.mockResolvedValue({ data: { valid: true, expires_at: "2026-10-13T12:00:00.000Z" } });
  const { container } = renderPage("/cadastro/paciente/synthetic-legacy-placeholder");
  expect(await screen.findByText("Preencha seus dados para iniciar o atendimento.")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Cadastro do paciente", level: 1 })).toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "Identidade do atendimento" })).not.toBeInTheDocument();
  expect(container.querySelector("form")).toBeInTheDocument();
});

test("unavailable invite never shows identity or enables intake", async () => {
  axios.get.mockRejectedValue({ response: { data: { error: "Convite indisponível" } } });
  const { container } = renderPage();
  await screen.findByText("Convite indisponível");
  expect(screen.queryByText("Agenda de João")).not.toBeInTheDocument();
  expect(container.querySelector("form")).toBeNull();
  expect(axios.post).not.toHaveBeenCalled();
});

test("late public host context cannot replace invite title or brand", async () => {
  const previousPath = window.location.pathname;
  window.history.replaceState(null, "", "/c/agenda-de-joao-2/preview");
  let resolveHost;
  const hostResponse = new Promise((resolve) => { resolveHost = resolve; });
  axios.get.mockImplementation((path) => path.includes("clinic-context")
    ? hostResponse
    : Promise.resolve({ data: { valid: true, identity: { name: "Agenda de João", logo_url: null } } }));
  try {
    render(
      <MemoryRouter initialEntries={["/c/agenda-de-joao-2/preview"]}>
        <PublicClinicProvider>
          <Route path="/c/:slug/:token"><PatientSelfSignup /></Route>
        </PublicClinicProvider>
      </MemoryRouter>,
    );
    await screen.findByText("Agenda de João");
    await waitFor(() => expect(document.title).toBe("Cadastro do paciente | Agenda de João"));
    await act(async () => resolveHost({ data: { has_public_tenant: true, public_name: "Outra marca" } }));
    expect(document.title).toBe("Cadastro do paciente | Agenda de João");
    expect(screen.queryByText("Outra marca")).not.toBeInTheDocument();
  } finally {
    window.history.replaceState(null, "", previousPath);
  }
});
