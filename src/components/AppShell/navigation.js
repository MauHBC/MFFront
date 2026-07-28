import {
  FaCalendarAlt,
  FaChartLine,
  FaClipboardList,
  FaMoneyBillWave,
  FaUserFriends,
} from "react-icons/fa";
import { isPlansModuleEnabled } from "../../config/features";

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
    path: "/financeiro",
    matchPaths: ["/financeiro"],
    icon: FaMoneyBillWave,
  },
];

export function getVisibleNavigationItems() {
  return navigationItems.filter((item) => !item.isVisible || item.isVisible());
}

export function isNavigationItemActive(item, pathname) {
  return item.matchPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export default navigationItems;
