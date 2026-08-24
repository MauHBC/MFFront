import {
  commercialNameRepresentsFrequency,
  getPlanFrequencySubtitle,
} from "./patientPlanOverviewPresentation";

describe("patientPlanOverviewPresentation", () => {
  it("não repete frequência estruturada já presente no nome comercial", () => {
    expect(commercialNameRepresentsFrequency({
      commercialName: "Pilates 2x na semana",
      sessionsPerWeek: 2,
      frequencyLabel: "2x por semana",
    })).toBe(true);
    expect(getPlanFrequencySubtitle({
      commercial_name: "Pilates 2x na semana",
      sessions_per_week: 2,
      frequency_label: "2x por semana",
    })).toBe("");
  });

  it("mostra frequência discreta quando o nome comercial não a representa", () => {
    expect(getPlanFrequencySubtitle({
      commercial_name: "Pilates recorrente",
      sessions_per_week: 3,
      frequency_label: "3x por semana",
    })).toBe("3x por semana");
  });

  it("usa fallback estruturado quando não há frequency_label", () => {
    expect(getPlanFrequencySubtitle({
      commercial_name: "Funcional mensal",
      sessions_per_week: 2,
    })).toBe("2x por semana");
  });
});
