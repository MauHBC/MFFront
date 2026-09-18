import React, { useEffect, useState } from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Router, useLocation } from "react-router-dom";
import { createMemoryHistory } from "history";
import EntryBoundary from "./EntryBoundary";
import {
  CENTRAL_LOGIN, PUBLIC_SITE_HOSTS, FORWARDING_HOSTS, entryDestination, loadEntryPolicy,
} from "../config/entryPolicy";

const oldHosts = [...PUBLIC_SITE_HOSTS, ...FORWARDING_HOSTS];
const internal = ["/login", "/menu/", "/register", "/agendamentos/eventos/",
  "/pacientes/123/avaliacoes/456", "/planos/pacientes/123", "/equipe",
  "/financeiro/configuracoes/formas-pagamento", "/configuracoes/documentos", "/platform/clinics/123"];
const exceptions = ["/politica", "/politica/", "/cadastro/paciente/synthetic-code",
  "/credencial", "/credencial/", "/recuperar-senha", "/api/public/media/code",
  "/api/patients/123", "/assets/photo.png", "/static/main.js", "/uploads/file.pdf",
  "/downloads/document.pdf", "/unknown", "/agendamentos/unknown"];

test.each(oldHosts)("closed path matrix on %s drops old context", (hostname) => {
  internal.forEach((pathname) => {
    expect(entryDestination({ hostname, pathname, hash: "#token=synthetic", enabled: true }))
      .toBe(CENTRAL_LOGIN);
    expect(entryDestination({ hostname, pathname, enabled: false })).toBeNull();
  });
  exceptions.forEach((pathname) => expect(entryDestination({
    hostname, pathname, enabled: true, hash: "#token=synthetic",
  })).toBeNull());
});
test.each(PUBLIC_SITE_HOSTS)("preserves site root and preview on %s", (hostname) => {
  ["", "#gallery", "#landing_preview=synthetic&clinic_id=123"].forEach((hash) => {
    expect(entryDestination({ hostname, pathname: "/", hash, enabled: true })).toBeNull();
  });
});
test.each(FORWARDING_HOSTS)("forwarding root preserves preview renderer on %s", (hostname) => {
  expect(entryDestination({ hostname, pathname: "/", hash: "#token=old", enabled: true }))
    .toBe(CENTRAL_LOGIN);
  ["#landing_preview=synthetic&clinic_id=123", "#landing_preview=invalid", "#landing_preview="]
    .forEach((hash) => expect(entryDestination({ hostname, pathname: "/", hash, enabled: true })).toBeNull());
});
test.each(["localhost", "127.0.0.1", "admin.motria.com.br", "unrelated.example"])(
  "never redirects unmanaged host %s", (hostname) => {
    internal.forEach((pathname) => expect(entryDestination({ hostname, pathname, enabled: true })).toBeNull());
  },
);
test("central root delegates session validation to the existing login; no loop", () => {
  expect(entryDestination({ hostname: "app.motria.com.br", pathname: "/", enabled: true })).toBe("/login");
  internal.forEach((pathname) => expect(entryDestination({
    hostname: "app.motria.com.br", pathname, enabled: true,
  })).toBeNull());
  expect(CENTRAL_LOGIN.endsWith("#")).toBe(true);
});

test("activation is same-origin, explicit and contains no redirect authority", async () => {
  const fetcher = jest.fn(async () => ({
    ok: true, headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({ version: 1, enabled: true, redirect: "https://untrusted.example" }),
  }));
  expect(await loadEntryPolicy({ hostname: oldHosts[0], fetcher })).toBe(true);
  expect(fetcher).toHaveBeenCalledWith("/entry-policy.json", expect.objectContaining({
    credentials: "omit", redirect: "error", cache: "no-store",
  }));
  fetcher.mockClear();
  expect(await loadEntryPolicy({ hostname: oldHosts[0], development: true, fetcher })).toBe(false);
  expect(await loadEntryPolicy({ hostname: "localhost", fetcher })).toBe(false);
  expect(fetcher).not.toHaveBeenCalled();
});
test.each([null, {}, { version: 1, enabled: "true" }, { version: 2, enabled: true }])(
  "malformed activation fails closed: %j", async (value) => {
    await expect(loadEntryPolicy({ hostname: oldHosts[0], fetcher: async () => ({
      ok: true, headers: { get: () => "application/json" }, json: async () => value,
    }) })).rejects.toThrow("ENTRY_POLICY_INVALID");
  },
);

function Probe({ mount }) {
  const location = useLocation();
  useEffect(() => { mount(); }, [mount]);
  return <div>module:{location.pathname}</div>;
}
const enabled = async () => true;
test("direct old bookmark never mounts its consumers, even with identifiers and tokens", async () => {
  const mount = jest.fn();
  const replace = jest.fn();
  const history = createMemoryHistory({ initialEntries: ["/pacientes/123?clinic_id=456#token=old"] });
  render(<Router history={history}><EntryBoundary hostname={oldHosts[0]} load={enabled} replace={replace}>
    <Probe mount={mount} />
  </EntryBoundary></Router>);
  await waitFor(() => expect(replace).toHaveBeenCalledWith(CENTRAL_LOGIN));
  expect(mount).not.toHaveBeenCalled();
  expect(screen.queryByText(/module:/)).not.toBeInTheDocument();
});
test("React navigation closes the boundary before mounting an internal route", async () => {
  const mount = jest.fn();
  const replace = jest.fn();
  const history = createMemoryHistory({ initialEntries: ["/politica"] });
  function Content() {
    const location = useLocation();
    return location.pathname === "/politica" ? <div>public policy</div> : <Probe mount={mount} />;
  }
  render(<Router history={history}><EntryBoundary hostname={oldHosts[0]} load={enabled} replace={replace}>
    <Content />
  </EntryBoundary></Router>);
  await screen.findByText("public policy");
  act(() => history.push("/agendamentos?patient=123#secret"));
  await waitFor(() => expect(replace).toHaveBeenCalledWith(CENTRAL_LOGIN));
  expect(mount).not.toHaveBeenCalled();
});
test("loading/error never exposes modules; explicit retry can preserve legacy", async () => {
  const mount = jest.fn();
  let reject;
  const load = jest.fn(() => new Promise((resolve, rejectPromise) => { reject = rejectPromise; }));
  const history = createMemoryHistory({ initialEntries: ["/menu"] });
  render(<Router history={history}><EntryBoundary hostname={oldHosts[0]} load={load}>
    <Probe mount={mount} />
  </EntryBoundary></Router>);
  expect(mount).not.toHaveBeenCalled();
  await act(async () => reject(new Error("network")));
  expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível");
  expect(mount).not.toHaveBeenCalled();
  load.mockResolvedValue(false);
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  await screen.findByText("module:/menu");
  expect(mount).toHaveBeenCalledTimes(1);
});

test.each([
  ["localhost", false], ["app.motria.com.br", true], [oldHosts[0], false],
])("ordinary navigation preserves mounted state on %s (enabled=%s)", async (hostname, active) => {
  const mount = jest.fn();
  const load = jest.fn(async () => active);
  const history = createMemoryHistory({ initialEntries: ["/financeiro/receitas"] });
  function StatefulModule() {
    const [filter, setFilter] = useState("");
    return <><Probe mount={mount} /><input aria-label="filter" value={filter}
      onChange={(event) => setFilter(event.target.value)} /></>;
  }
  render(<Router history={history}><EntryBoundary hostname={hostname} load={load}>
    <StatefulModule />
  </EntryBoundary></Router>);
  fireEvent.change(await screen.findByLabelText("filter"), { target: { value: "preserved" } });
  act(() => history.push("/financeiro/despesas"));
  await screen.findByText("module:/financeiro/despesas");
  expect(screen.getByLabelText("filter")).toHaveValue("preserved");
  expect(mount).toHaveBeenCalledTimes(1);
  expect(load).toHaveBeenCalledTimes(1);
});
