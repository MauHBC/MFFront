/* eslint-env jest */
import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useSelector } from "react-redux";
import axios from "../services/axios";
import { PublicClinicProvider, usePublicClinicContext } from "./PublicClinicContext";
import { ClinicProvider, useClinicContext } from "./ClinicContext";

jest.mock("react-redux", () => ({ useSelector: jest.fn() }));
jest.mock("../services/axios", () => ({ get: jest.fn() }));

const icon = () => document.querySelector("link[rel='icon']");
const appleIcon = () => document.querySelector("link[rel='apple-touch-icon']");
const PublicReady = () => <div>{usePublicClinicContext().loaded ? "Pronto" : "Carregando"}</div>;
const ClinicReady = () => <div>{useClinicContext().loaded ? "Pronto" : "Carregando"}</div>;

beforeEach(() => {
  jest.clearAllMocks();
  document.head.innerHTML = "<link rel='icon' href='/favicon.ico'><link rel='apple-touch-icon' href='/apple-touch-icon.png'>";
  useSelector.mockImplementation((selector) => selector({ auth: { isLoggedIn: false, token: null } }));
});

test("entrada central mantém o símbolo Motria no favicon e no ícone Apple", async () => {
  axios.get.mockResolvedValue({ data: { has_public_tenant: false } });
  render(<MemoryRouter initialEntries={["/login"]}><PublicClinicProvider><PublicReady /></PublicClinicProvider></MemoryRouter>);
  await screen.findByText("Pronto");
  expect(icon()).toHaveAttribute("href", "/favicon.ico");
  expect(appleIcon()).toHaveAttribute("href", "/apple-touch-icon.png");
});

test("domínio white-label conserva seu favicon próprio e o Apple neutro", async () => {
  axios.get.mockResolvedValue({ data: { has_public_tenant: true, favicon_url: "/assets/clinics/cmt/favicon.ico" } });
  render(<MemoryRouter initialEntries={["/login"]}><PublicClinicProvider><PublicReady /></PublicClinicProvider></MemoryRouter>);
  await screen.findByText("Pronto");
  expect(icon()).toHaveAttribute("href", "/assets/clinics/cmt/favicon.ico");
  expect(appleIcon()).toHaveAttribute("href", "/neutral-icon.svg");
});

test("domínio white-label sem favicon mantém o fallback neutro", async () => {
  axios.get.mockResolvedValue({ data: { has_public_tenant: true } });
  render(<MemoryRouter initialEntries={["/login"]}><PublicClinicProvider><PublicReady /></PublicClinicProvider></MemoryRouter>);
  await screen.findByText("Pronto");
  expect(icon()).toHaveAttribute("href", "/neutral-icon.svg");
  expect(appleIcon()).toHaveAttribute("href", "/neutral-icon.svg");
});

test("clínica autenticada conserva o favicon específico", async () => {
  useSelector.mockImplementation((selector) => selector({ auth: { isLoggedIn: true, token: "test-token" } }));
  axios.get.mockResolvedValue({ data: { favicon_url: "/assets/clinics/cmt/favicon.ico" } });
  render(<ClinicProvider><ClinicReady /></ClinicProvider>);
  await screen.findByText("Pronto");
  expect(icon()).toHaveAttribute("href", "/assets/clinics/cmt/favicon.ico");
  expect(appleIcon()).toHaveAttribute("href", "/neutral-icon.svg");
});

test("clínica autenticada sem favicon não herda o símbolo Motria", async () => {
  useSelector.mockImplementation((selector) => selector({ auth: { isLoggedIn: true, token: "test-token" } }));
  axios.get.mockResolvedValue({ data: { favicon_url: null } });
  render(<ClinicProvider><ClinicReady /></ClinicProvider>);
  await screen.findByText("Pronto");
  expect(icon()).toHaveAttribute("href", "/neutral-icon.svg");
  expect(appleIcon()).toHaveAttribute("href", "/neutral-icon.svg");
});
