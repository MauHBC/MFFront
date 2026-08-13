import fs from "fs";
import path from "path";
import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import MyRoute from "./MyRoute";
import { useAuthorization } from "../contexts/AuthorizationContext";

jest.mock("../hooks/useAuthRedirect", () => ({ useAuthRedirect: () => null }));
jest.mock("../contexts/AuthorizationContext", () => ({
  useAuthorization: jest.fn(),
  isTeamAdministrator: () => false,
}));

const NewEvaluation = () => <div>Nova avaliação montada</div>;

describe("clinical evaluation route authorization characterization", () => {
  test("route declaration requires edit plus clinical_records.write", () => {
    const source = fs.readFileSync(path.resolve(__dirname, "index.js"), "utf8");
    expect(source).toMatch(
      /path="\/pacientes\/:id\/avaliacoes\/nova"[\s\S]*?requiredModule="clinical_records"[\s\S]*?minimumAccessLevel="edit"[\s\S]*?requiredCapability="clinical_records\.write"/,
    );
  });

  test("direct access remains denied for clinical-record read-only", () => {
    useAuthorization.mockReturnValue({
      status: "ready",
      context: { authorization_state: "authorized", is_administrator: false },
      canAccessModule: (moduleKey, minimum) => (
        moduleKey === "clinical_records" && minimum === "view"
      ),
      hasCapability: (capability) => capability === "clinical_records.read",
    });

    render(
      <MemoryRouter initialEntries={["/pacientes/101/avaliacoes/nova"]}>
        <MyRoute
          exact
          path="/pacientes/:id/avaliacoes/nova"
          component={NewEvaluation}
          isClosed
          requiredModule="clinical_records"
          minimumAccessLevel="edit"
          requiredCapability="clinical_records.write"
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Você não tem acesso")).toBeInTheDocument();
    expect(screen.queryByText("Nova avaliação montada")).not.toBeInTheDocument();
  });

  test("direct access mounts for edit plus clinical_records.write", () => {
    useAuthorization.mockReturnValue({
      status: "ready",
      context: { authorization_state: "authorized", is_administrator: false },
      canAccessModule: (moduleKey, minimum) => (
        moduleKey === "clinical_records" && minimum === "edit"
      ),
      hasCapability: (capability) => capability === "clinical_records.write",
    });

    render(
      <MemoryRouter initialEntries={["/pacientes/101/avaliacoes/nova"]}>
        <MyRoute
          exact
          path="/pacientes/:id/avaliacoes/nova"
          component={NewEvaluation}
          isClosed
          requiredModule="clinical_records"
          minimumAccessLevel="edit"
          requiredCapability="clinical_records.write"
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Nova avaliação montada")).toBeInTheDocument();
  });
});
