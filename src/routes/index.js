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
import Agendamentos from "../pages/Agendamentos";
import Imoveis from "../pages/Imoveis";
import Imovel from "../pages/Imovel";
import Register from "../pages/Register";
import Laudos from "../pages/Laudos";
import Agendar from "../pages/Agendar";
import AgendarEdit from "../pages/AgendarEdit";
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
        <MyRoute exact path="/agendamentos" component={Agendamentos} isClosed />
        <MyRoute exact path="/agendamentos/:id/agendar" component={Agendar} isClosed />
        <MyRoute exact path="/agendamentos/:id/agendarEdit" component={AgendarEdit} isClosed />
        <MyRoute exact path="/imoveis" component={Imoveis} isClosed allowedGroups={1} />
        <MyRoute exact path="/laudos" component={Laudos} isClosed allowedGroups={3} />
        <MyRoute exact path="/imovel/:id/edit" component={Imovel} isClosed />
        <MyRoute exact path="/imovel/" component={Imovel} isClosed />
        <MyRoute exact path="/register/" component={Register} isClosed />

        {/* Rota para páginas não encontradas ou sem acesso */}
        <MyRoute exact path="/semAcesso/" component={SemAcesso} isClosed={false} />
        <MyRoute path="*" component={Page404} isClosed={false} />
      </Switch>
    </>
  );
}
