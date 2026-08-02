import {
  filterVisibleNavigationItems,
  getVisibleNavigationItems,
  isNavigationItemActive,
} from "./navigation";

describe("AppShell navigation", () => {
  const fullAccess = {
    canAccessModule: () => true,
    hasCapability: () => true,
    canViewTeam: true,
  };
  it("remove o módulo quando ele ou todos os seus submenus estão indisponíveis", () => {
    const hiddenParent = {
      key: "hidden-parent",
      matchPaths: ["/hidden"],
      isVisible: () => false,
      children: [{ key: "child", matchPaths: ["/hidden/child"] }],
    };
    const hiddenChildren = {
      key: "hidden-children",
      matchPaths: ["/children"],
      children: [{
        key: "child",
        matchPaths: ["/children/child"],
        isVisible: () => false,
      }],
    };

    expect(filterVisibleNavigationItems([hiddenParent, hiddenChildren])).toEqual([]);
  });

  it("mantém somente os submenus permitidos e deriva o pai ativo da rota filha", () => {
    const item = {
      key: "module",
      matchPaths: ["/module"],
      children: [
        { key: "allowed", matchPaths: ["/module/allowed"] },
        {
          key: "hidden",
          matchPaths: ["/module/hidden"],
          isVisible: () => false,
        },
      ],
    };

    const [visibleItem] = filterVisibleNavigationItems([item]);
    expect(visibleItem.children).toHaveLength(1);
    expect(isNavigationItemActive(visibleItem, "/module/allowed")).toBe(true);
  });

  it("expõe somente os submenus aprovados de Agenda e Planos", () => {
    const items = getVisibleNavigationItems(fullAccess);
    const agenda = items.find(({ key }) => key === "schedule");
    const patients = items.find(({ key }) => key === "patients");
    const plans = items.find(({ key }) => key === "plans");

    expect(agenda.children.map(({ label, path }) => ({ label, path }))).toEqual([
      { label: "Agenda", path: "/agendamentos" },
      { label: "Configurações", path: "/agendamentos/eventos" },
    ]);
    expect(patients.children).toBeUndefined();
    expect(plans.children.map(({ label, path }) => ({ label, path }))).toEqual([
      { label: "Pacientes com plano", path: "/planos?tab=patient-plans" },
      { label: "Planos mensais", path: "/planos?tab=service-plans" },
      { label: "Serviços", path: "/planos?tab=services" },
    ]);
  });

  it("resolve o submenu ativo pelas rotas e queries reais", () => {
    const items = getVisibleNavigationItems(fullAccess);
    const agenda = items.find(({ key }) => key === "schedule");
    const plans = items.find(({ key }) => key === "plans");

    expect(isNavigationItemActive(agenda.children[0], "/agendamentos")).toBe(true);
    expect(isNavigationItemActive(agenda.children[1], "/agendamentos")).toBe(false);
    expect(isNavigationItemActive(
      agenda.children[1],
      "/agendamentos/eventos",
    )).toBe(true);
    expect(isNavigationItemActive(plans.children[0], "/planos")).toBe(true);
    expect(isNavigationItemActive(
      plans.children[1],
      "/planos",
      "?tab=service-plans",
    )).toBe(true);
    expect(isNavigationItemActive(
      plans.children[2],
      "/planos",
      "?tab=services",
    )).toBe(true);
    expect(isNavigationItemActive(
      plans.children[0],
      "/planos/pacientes/41",
    )).toBe(true);
  });

  it("exibe Equipe somente com o contexto administrativo oficial", () => {
    expect(getVisibleNavigationItems({
      canAccessModule: () => true,
      hasCapability: () => true,
      canViewTeam: false,
    })
      .some(({ key }) => key === "team")).toBe(false);
    const items = getVisibleNavigationItems(fullAccess);
    const team = items.find(({ key }) => key === "team");
    expect(team.path).toBe("/equipe");
    expect(isNavigationItemActive(team, "/equipe")).toBe(true);
  });

  it("perfil somente Agenda nao enxerga outros modulos ou configuracao sem capacidade", () => {
    const items = getVisibleNavigationItems({
      canAccessModule: (moduleKey) => moduleKey === "schedule",
      hasCapability: () => false,
      canViewTeam: false,
    });
    expect(items.map(({ key }) => key)).toEqual(["schedule"]);
    expect(items[0].children.map(({ key }) => key)).toEqual(["schedule-calendar"]);
  });
});
