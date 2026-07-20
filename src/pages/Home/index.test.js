/* eslint-env jest */
import React from "react";
import "@testing-library/jest-dom";
import { render } from "@testing-library/react";
import HomePage from "./index";
import { usePublicClinicContext } from "../../contexts/PublicClinicContext";

jest.mock("../../contexts/PublicClinicContext", () => ({
  usePublicClinicContext: jest.fn(),
}));
jest.mock("../../components/Nav/TopNavbar", () => () => <div>Header</div>);
jest.mock("../../components/Sections/Header", () => () => <div>Banner</div>);
jest.mock("../../components/Sections/Contact", () => () => <div>Estrutura</div>);
jest.mock("../../components/Sections/Services", () => () => <div>Serviços</div>);
jest.mock("../../components/Sections/About", () => () => <div>Sobre</div>);
jest.mock("../../components/Sections/Footer", () => () => <div>Footer</div>);

it("renders the approved public section order", () => {
  usePublicClinicContext.mockReturnValue({ loaded: true, loading: false });
  const { container } = render(<HomePage />);
  const text = container.textContent;

  expect(text.indexOf("Header")).toBeLessThan(text.indexOf("Banner"));
  expect(text.indexOf("Banner")).toBeLessThan(text.indexOf("Estrutura"));
  expect(text.indexOf("Estrutura")).toBeLessThan(text.indexOf("Serviços"));
  expect(text.indexOf("Serviços")).toBeLessThan(text.indexOf("Sobre"));
  expect(text.indexOf("Sobre")).toBeLessThan(text.indexOf("Footer"));
});
