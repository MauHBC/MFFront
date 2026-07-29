import {
  FaCalendarAlt,
  FaChartLine,
  FaClipboardList,
  FaCog,
  FaMoneyBillWave,
  FaUserFriends,
  FaWallet,
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
        icon: FaChartLine,
      },
      {
        key: "financial-revenues",
        label: "Receitas",
        path: "/financeiro/receitas",
        matchPaths: ["/financeiro/receitas"],
        icon: FaMoneyBillWave,
      },
      {
        key: "financial-expenses",
        label: "Despesas da clínica",
        path: "/financeiro/despesas",
        matchPaths: ["/financeiro/despesas"],
        icon: FaWallet,
      },
      {
        key: "financial-settings",
        label: "Configurações",
        path: "/financeiro/configuracoes",
        matchPaths: ["/financeiro/configuracoes"],
        icon: FaCog,
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

export function isNavigationItemActive(item, pathname) {
  const matchesItem = item.matchPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  return matchesItem || (item.children || []).some(
    (child) => isNavigationItemActive(child, pathname),
  );
}

export default navigationItems;
