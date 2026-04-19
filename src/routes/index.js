import React from "react";
import { Switch, useLocation } from "react-router-dom";

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
import PatientsMenu from "../pages/Patients";
import PatientsNew from "../pages/PatientsNew";
import PatientsSearch from "../pages/PatientsSearch";
import PatientDetails from "../pages/PatientDetails";
import Agendamentos from "../pages/Agendamentos";
import PatientEvaluationNew from "../pages/PatientEvaluationNew";
import PatientEvaluationDetails from "../pages/PatientEvaluationDetails";
import ImobNavbar from "../components/ImobNavbar/TopNavbar";
import Financeiro from "../pages/Financeiro";
import SchedulingEvents from "../pages/SchedulingEvents";
import Planos from "../pages/Planos";
import { isPlansModuleEnabled } from "../config/features";

export default function Routes() {
  const location = useLocation();

  // Condicional para verificar se não é a HomePage
  const isPublicSignup = location.pathname.startsWith("/cadastro/paciente");
  const shouldShowNavbar = location.pathname !== "/" && !isPublicSignup;

  return (
    <>
      {shouldShowNavbar && <ImobNavbar />} {/* Exibe a navbar em todas as páginas, exceto na HomePage */}

      <Switch>
        {/* Rotas públicas */}
        <MyRoute exact path="/" component={HomePage} isClosed={false} />
        <MyRoute exact path="/menu" component={Menu} isClosed />
        <MyRoute exact path="/login/" component={Login} isClosed={false} />
        <MyRoute exact path="/politica" component={Politica} isClosed={false} />
        <MyRoute exact path="/cadastro/paciente/:token" component={PatientSelfSignup} isClosed={false} />

        {/* Rotas protegidas */}
        <MyRoute exact path="/register/" component={Register} isClosed />
        <MyRoute exact path="/pacientes" component={PatientsMenu} isClosed />
        <MyRoute exact path="/pacientes/novo" component={PatientsNew} isClosed />
        <MyRoute exact path="/pacientes/consultar" component={PatientsSearch} isClosed />
        <MyRoute exact path="/pacientes/:id" component={PatientDetails} isClosed />
        <MyRoute exact path="/pacientes/:id/avaliacoes/nova" component={PatientEvaluationNew} isClosed />
        <MyRoute exact path="/pacientes/:id/avaliacoes/:evaluationId" component={PatientEvaluationDetails} isClosed />
        <MyRoute exact path="/agendamentos" component={Agendamentos} isClosed />
        <MyRoute exact path="/agendamentos/eventos" component={SchedulingEvents} isClosed />
        <MyRoute exact path="/financeiro" component={Financeiro} isClosed />
        <MyRoute
          exact
          path="/planos"
          component={isPlansModuleEnabled ? Planos : Page404}
          isClosed={isPlansModuleEnabled}
        />

        {/* Rota para páginas não encontradas ou sem acesso */}
        <MyRoute exact path="/semAcesso/" component={SemAcesso} isClosed={false} />
        <MyRoute path="*" component={Page404} isClosed={false} />
      </Switch>
    </>
  );
}
