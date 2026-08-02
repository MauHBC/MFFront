import React from "react";
import { Redirect, Switch, useLocation } from "react-router-dom";

import MyRoute from "./MyRoute";

// Páginas públicas (acesso aberto)
import HomePage from "../pages/Home";
import Politica from "../pages/Politica";
import Menu from "../pages/Menu";
import Login from "../pages/Login";
import SemAcesso from "../pages/SemAcesso";
import Page404 from "../pages/Page404";
import PatientSelfSignup from "../pages/PatientSelfSignup";

// Páginas protegidas (requer autenticação)
import Register from "../pages/Register";
import PatientsNew from "../pages/PatientsNew";
import PatientsSearch from "../pages/PatientsSearch";
import PatientDetails from "../pages/PatientDetails";
import Agendamentos from "../pages/Agendamentos";
import Painel from "../pages/Dashboard";
import PatientEvaluationNew from "../pages/PatientEvaluationNew";
import PatientEvaluationDetails from "../pages/PatientEvaluationDetails";
import ImobNavbar from "../components/ImobNavbar/TopNavbar";
import Financeiro from "../pages/Financeiro";
import SchedulingEvents from "../pages/SchedulingEvents";
import Planos from "../pages/Planos";
import PlatformPaused from "../pages/PlatformPaused";
import { isPlansModuleEnabled } from "../config/features";
import AppShell from "../components/AppShell";
import Equipe from "../pages/Equipe";

function getPatientsPageTitle(pathname) {
  if (pathname === "/pacientes/novo") return "Novo paciente";
  if (pathname.includes("/avaliacoes/nova")) return "Nova avaliação";
  if (pathname.includes("/avaliacoes/")) return "Avaliação";
  if (/^\/pacientes\/[^/]+$/.test(pathname)) return "Perfil do paciente";
  return "Pacientes";
}

function getAppShellPageTitle(pathname) {
  if (pathname === "/financeiro" || pathname.startsWith("/financeiro/")) return "Financeiro";
  if (pathname === "/planos" || pathname.startsWith("/planos/")) return "Planos";
  if (pathname === "/equipe") return "Equipe";
  return getPatientsPageTitle(pathname);
}

function LegacyFinancialRoute() {
  const location = useLocation();
  const params = new URLSearchParams(location.search || "");
  const view = params.get("view") || params.get("tab");
  const pathname = view === "mensalidades"
    ? "/financeiro/receitas"
    : "/financeiro/visao-geral";
  return <Redirect to={{ pathname, search: location.search }} />;
}

export default function Routes() {
  const location = useLocation();

  // Condicional para verificar se não é a HomePage
  const isPublicSignup = location.pathname.startsWith("/cadastro/paciente");
  const usesPatientsAppShell = location.pathname === "/pacientes"
    || location.pathname.startsWith("/pacientes/");
  const usesPlansAppShell = location.pathname === "/planos"
    || location.pathname.startsWith("/planos/");
  const usesFinancialAppShell = location.pathname === "/financeiro"
    || location.pathname.startsWith("/financeiro/");
  const usesTeamAppShell = location.pathname === "/equipe";
  const usesAppShell = [
    "/menu",
    "/painel",
    "/dashboard",
    "/agendamentos",
    "/agendamentos/eventos",
  ].includes(location.pathname)
    || usesPatientsAppShell
    || usesPlansAppShell
    || usesFinancialAppShell
    || usesTeamAppShell;
  const shouldShowNavbar = location.pathname !== "/" && !isPublicSignup && !usesAppShell;

  const routeContent = (
    <Switch>
        {/* Rotas públicas */}
        <MyRoute exact path="/" component={HomePage} isClosed={false} />
        <MyRoute exact path="/menu" component={Menu} isClosed />
        <MyRoute exact path="/login/" component={Login} isClosed={false} />
        <MyRoute exact path="/politica" component={Politica} isClosed={false} />
        <MyRoute exact path="/cadastro/paciente/:token" component={PatientSelfSignup} isClosed={false} />

        {/* Rotas protegidas */}
        <MyRoute exact path="/register/" component={Register} isClosed administratorOnly />
        <MyRoute exact path="/pacientes" component={PatientsSearch} isClosed requiredModule="patients" />
        <MyRoute exact path="/pacientes/novo" component={PatientsNew} isClosed requiredModule="patients" minimumAccessLevel="edit" />
        <MyRoute exact path="/pacientes/consultar" component={PatientsSearch} isClosed requiredModule="patients" />
        <MyRoute exact path="/pacientes/:id" component={PatientDetails} isClosed requiredModule="patients" />
        <MyRoute exact path="/pacientes/:id/avaliacoes/nova" component={PatientEvaluationNew} isClosed requiredModule="clinical_records" minimumAccessLevel="edit" requiredCapability="clinical_records.write" />
        <MyRoute exact path="/pacientes/:id/avaliacoes/:evaluationId" component={PatientEvaluationDetails} isClosed requiredModule="clinical_records" requiredCapability="clinical_records.read" />
        <MyRoute exact path="/agendamentos" component={Agendamentos} isClosed requiredModule="schedule" />
        <MyRoute exact path="/agendamentos/eventos" component={SchedulingEvents} isClosed requiredModule="schedule" minimumAccessLevel="manage" requiredCapability="schedule.configure" />
        <MyRoute exact path="/painel" component={Painel} isClosed requiredModule="dashboard" />
        <MyRoute exact path="/dashboard" component={Painel} isClosed requiredModule="dashboard" />
        <MyRoute exact path="/equipe" component={Equipe} isClosed administratorOnly />
        <MyRoute exact path="/financeiro" component={LegacyFinancialRoute} isClosed requiredModule="finance" />
        <MyRoute
          exact
          path={[
            "/financeiro/visao-geral",
            "/financeiro/receitas",
            "/financeiro/despesas",
          ]}
          component={Financeiro}
          isClosed
          requiredModule="finance"
        />
        <MyRoute
          exact
          path={[
            "/financeiro/configuracoes",
            "/financeiro/configuracoes/formas-pagamento",
            "/financeiro/configuracoes/categorias-despesas",
          ]}
          component={Financeiro}
          isClosed
          requiredModule="finance"
          minimumAccessLevel="manage"
          requiredCapability="finance.configure"
        />
        <MyRoute exact path="/platform" component={PlatformPaused} isClosed />
        <MyRoute exact path="/platform/clinics/:id" component={PlatformPaused} isClosed />
        <MyRoute
          exact
          path="/planos"
          component={isPlansModuleEnabled ? Planos : Page404}
          isClosed={isPlansModuleEnabled}
          requiredModule="plans"
        />
        <MyRoute
          exact
          path="/planos/pacientes/:patientPlanId"
          component={isPlansModuleEnabled ? Planos : Page404}
          isClosed={isPlansModuleEnabled}
          requiredModule="plans"
        />

        {/* Rota para páginas não encontradas ou sem acesso */}
        <MyRoute exact path="/semAcesso/" component={SemAcesso} isClosed={false} />
        <MyRoute path="*" component={Page404} isClosed={false} />
    </Switch>
  );

  return (
    <>
      {shouldShowNavbar && <ImobNavbar />} {/* Exibe a navbar em todas as páginas, exceto na HomePage */}
      {usesPatientsAppShell || usesPlansAppShell || usesFinancialAppShell || usesTeamAppShell ? (
        <AppShell pageTitle={getAppShellPageTitle(location.pathname)}>
          {routeContent}
        </AppShell>
      ) : routeContent}
    </>
  );
}
