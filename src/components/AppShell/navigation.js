import {
  FaCalendarAlt,
  FaChartLine,
  FaClipboardList,
  FaCog,
  FaMoneyBillWave,
  FaUserFriends,
  FaUsersCog,
} from "react-icons/fa";
import { isPlansModuleEnabled } from "../../config/features";

export const NAVIGATION_BADGE_EVENT = "multifisio:app-shell:navigation-badge";

const navigationItems = [
  {
    key: "dashboard",
    label: "Painel",
    path: "/painel",
    matchPaths: ["/painel", "/dashboard"],
    icon: FaChartLine,
    isVisible: ({ canAccessModule } = {}) => canAccessModule?.("dashboard") === true,
  },
  {
    key: "schedule",
    label: "Agenda",
    path: "/agendamentos",
    matchPaths: ["/agendamentos"],
    icon: FaCalendarAlt,
    isVisible: ({ canAccessModule } = {}) => canAccessModule?.("schedule") === true,
    children: [
      {
        key: "schedule-calendar",
        label: "Agenda",
        path: "/agendamentos",
        exactMatchPaths: ["/agendamentos"],
      },
      {
        key: "schedule-settings",
        label: "Configurações",
        path: "/agendamentos/eventos",
        matchPaths: ["/agendamentos/eventos"],
        isVisible: ({ canAccessModule, hasCapability } = {}) => (
          canAccessModule?.("schedule", "manage") === true
          && hasCapability?.("schedule.configure") === true
        ),
      },
    ],
  },
  {
    key: "patients",
    label: "Pacientes",
    path: "/pacientes",
    matchPaths: ["/pacientes"],
    icon: FaUserFriends,
    isVisible: ({ canAccessModule } = {}) => canAccessModule?.("patients") === true,
  },
  {
    key: "team",
    label: "Equipe",
    path: "/equipe",
    matchPaths: ["/equipe"],
    icon: FaUsersCog,
    isVisible: ({ canViewTeam } = {}) => canViewTeam === true,
  },
  {
    key: "plans",
    label: "Planos",
    path: "/planos",
    matchPaths: ["/planos"],
    icon: FaClipboardList,
    isVisible: ({ canAccessModule } = {}) => (
      isPlansModuleEnabled && canAccessModule?.("plans") === true
    ),
    children: [
      {
        key: "plans-patients",
        label: "Pacientes com plano",
        path: "/planos?tab=patient-plans",
        isActive: ({ pathname, searchParams }) => (
          pathname.startsWith("/planos/pacientes/")
          || (
            pathname === "/planos"
            && ["", "patient-plans"].includes(searchParams.get("tab") || "")
          )
        ),
      },
      {
        key: "plans-monthly",
        label: "Planos mensais",
        path: "/planos?tab=service-plans",
        isActive: ({ pathname, searchParams }) => (
          pathname === "/planos" && searchParams.get("tab") === "service-plans"
        ),
      },
      {
        key: "plans-services",
        label: "Serviços",
        path: "/planos?tab=services",
        isActive: ({ pathname, searchParams }) => (
          pathname === "/planos" && searchParams.get("tab") === "services"
        ),
      },
    ],
  },
  {
    key: "financial",
    label: "Financeiro",
    path: "/financeiro/visao-geral",
    matchPaths: ["/financeiro"],
    icon: FaMoneyBillWave,
    isVisible: ({ canAccessModule } = {}) => canAccessModule?.("finance") === true,
    children: [
      {
        key: "financial-overview",
        label: "Visão geral",
        path: "/financeiro/visao-geral",
        matchPaths: ["/financeiro/visao-geral"],
      },
      {
        key: "financial-revenues",
        label: "Receitas",
        path: "/financeiro/receitas",
        matchPaths: ["/financeiro/receitas"],
      },
      {
        key: "financial-expenses",
        label: "Despesas da clínica",
        path: "/financeiro/despesas",
        matchPaths: ["/financeiro/despesas"],
      },
      {
        key: "financial-settings",
        label: "Configurações",
        path: "/financeiro/configuracoes",
        matchPaths: ["/financeiro/configuracoes"],
        isVisible: ({ canAccessModule, hasCapability } = {}) => (
          canAccessModule?.("finance", "manage") === true
          && hasCapability?.("finance.configure") === true
        ),
      },
    ],
  },
];

const footerNavigationItems = [
  {
    key: "settings",
    label: "Configurações",
    path: "/configuracoes/documentos",
    matchPaths: ["/configuracoes"],
    icon: FaCog,
    isVisible: ({ isAdministrator } = {}) => isAdministrator === true,
  },
];

export function filterVisibleNavigationItems(items, visibilityContext = {}) {
  return items.reduce((visibleItems, item) => {
    if (item.isVisible && !item.isVisible(visibilityContext)) return visibleItems;

    if (!item.children) return [...visibleItems, item];

    const children = item.children.filter(
      (child) => !child.isVisible || child.isVisible(visibilityContext),
    );
    if (children.length === 0) return visibleItems;

    return [...visibleItems, { ...item, children }];
  }, []);
}

export function getVisibleNavigationItems(visibilityContext) {
  return filterVisibleNavigationItems(navigationItems, visibilityContext);
}

export function getVisibleFooterNavigationItems(visibilityContext) {
  return filterVisibleNavigationItems(footerNavigationItems, visibilityContext);
}

export function isNavigationItemActive(item, pathname, search = "") {
  const searchParams = new URLSearchParams(search);
  if (item.isActive?.({ pathname, searchParams })) return true;

  const matchesExactPath = (item.exactMatchPaths || []).includes(pathname);
  const matchesItem = (item.matchPaths || []).some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  return matchesExactPath || matchesItem || (item.children || []).some(
    (child) => isNavigationItemActive(child, pathname, search),
  );
}

export default navigationItems;
