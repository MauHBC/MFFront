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

// Páginas protegidas (requer autenticação)
import Register from "../pages/Register";
import PatientsMenu from "../pages/Patients";
import PatientsNew from "../pages/PatientsNew";
import PatientsSearch from "../pages/PatientsSearch";
import PatientDetails from "../pages/PatientDetails";
import ImobNavbar from "../components/ImobNavbar/TopNavbar";

export default function Routes() {
  const location = useLocation();

  // Condicional para verificar se não é a HomePage
  const shouldShowNavbar = location.pathname !== "/";

  return (
    <>
      {shouldShowNavbar && <ImobNavbar />} {/* Exibe a navbar em todas as páginas, exceto na HomePage */}

      <Switch>
        {/* Rotas públicas */}
        <MyRoute exact path="/" component={HomePage} isClosed={false} />
        <MyRoute exact path="/menu" component={Menu} isClosed={false} />
        <MyRoute exact path="/login/" component={Login} isClosed={false} />
        <MyRoute exact path="/politica" component={Politica} isClosed={false} />

        {/* Rotas protegidas */}
        <MyRoute exact path="/register/" component={Register} isClosed />
        <MyRoute exact path="/pacientes" component={PatientsMenu} isClosed={false} />
        <MyRoute exact path="/pacientes/novo" component={PatientsNew} isClosed={false} />
        <MyRoute exact path="/pacientes/consultar" component={PatientsSearch} isClosed={false} />
        <MyRoute exact path="/pacientes/:id" component={PatientDetails} isClosed={false} />

        {/* Rota para páginas não encontradas ou sem acesso */}
        <MyRoute exact path="/semAcesso/" component={SemAcesso} isClosed={false} />
        <MyRoute path="*" component={Page404} isClosed={false} />
      </Switch>
    </>
  );
}
