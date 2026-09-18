/* eslint-env jest */
import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";
import Summary from "./ClinicalSigningIdentitySummary";

test("trial eligibility retains pending identity and never displays an empty CREFITO", () => {
  const { container } = render(<Summary identity={{ name: "Titular", eligibility: "temporary_trial_owner", verification_status: "pending", registration_region: null, registration_number: null }} />);
  expect(screen.getByText(/Credenciais profissionais pendentes — uso liberado durante o teste gratuito/)).toBeInTheDocument();
  expect(container).not.toHaveTextContent(/identidade verificada|CREFITO|null|undefined/);
});
test("actual verified credentials display their real council", () => {
  render(<Summary identity={{ name: "Profissional", verification_status: "verified", registration_region: "8", registration_number: "123-F" }} />);
  expect(screen.getByText(/CREFITO-8 nº 123-F · identidade verificada/)).toBeInTheDocument();
});
