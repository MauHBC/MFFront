import React from "react";
import { Switch } from "react-router-dom";

import MyRoute from "./MyRoute";

import Imoveis from "../pages/Imoveis";
import Agendamentos from "../pages/Agendamentos";
import Imovel from "../pages/Imovel";
import Register from "../pages/Register";
import Login from "../pages/Login";
import Page404 from "../pages/Page404";
import SemAcesso from "../pages/SemAcesso";
import Menu from "../pages/Menu";
import HomeIndex from "../pages/HomeIndex";
import Laudos from "../pages/Laudos";
import Agendar from "../pages/Agendar";
import PoliticasDePrivacidade from "../pages/PoliticasDePrivacidade";

export default function Routes() {
  return (
    <Switch>
      <MyRoute
        exact
        path="/politicasdeprivacidade"
        component={PoliticasDePrivacidade}
        isClosed={false}
      />
      <MyRoute exact path="/menu" component={Menu} isClosed={false} />
      <MyRoute exact path="/agendamentos" component={Agendamentos} isClosed />
      <MyRoute exact path="/" component={HomeIndex} isClosed={false} />
      <MyRoute
        exact
        path="/imoveis"
        a
        component={Imoveis}
        isClosed
        allowedGroups={1}
      />
      <MyRoute
        exact
        path="/laudos"
        component={Laudos}
        isClosed
        allowedGroups={3}
      />
      <MyRoute exact path="/imovel/:id/edit" component={Imovel} isClosed />
      <MyRoute exact path="/imovel/" component={Imovel} isClosed />

      <MyRoute
        exact
        path="/agendamentos/:id/agendar"
        component={Agendar}
        isClosed
      />

      <MyRoute exact path="/login/" component={Login} isClosed={false} />
      <MyRoute
        exact
        path="/semAcesso/"
        component={SemAcesso}
        isClosed={false}
      />
      <MyRoute exact path="/register/" component={Register} isClosed />
      <MyRoute path="*" component={Page404} isClosed={false} />
    </Switch>
  );
}
