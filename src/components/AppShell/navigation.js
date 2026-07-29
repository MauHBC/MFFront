import {
  FaCalendarAlt,
  FaChartLine,
  FaClipboardList,
  FaMoneyBillWave,
  FaUserFriends,
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
  },
  {
    key: "schedule",
    label: "Agenda",
    path: "/agendamentos",
    matchPaths: ["/agendamentos"],
    icon: FaCalendarAlt,
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
      },
    ],
  },
  {
    key: "patients",
    label: "Pacientes",
    path: "/pacientes",
    matchPaths: ["/pacientes"],
    icon: FaUserFriends,
  },
  {
    key: "plans",
    label: "Planos",
    path: "/planos",
    matchPaths: ["/planos"],
    icon: FaClipboardList,
    isVisible: () => isPlansModuleEnabled,
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
      },
    ],
  },
];

export function filterVisibleNavigationItems(items) {
  return items.reduce((visibleItems, item) => {
    if (item.isVisible && !item.isVisible()) return visibleItems;

    if (!item.children) return [...visibleItems, item];

    const children = item.children.filter(
      (child) => !child.isVisible || child.isVisible(),
    );
    if (children.length === 0) return visibleItems;

    return [...visibleItems, { ...item, children }];
  }, []);
}

export function getVisibleNavigationItems() {
  return filterVisibleNavigationItems(navigationItems);
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
