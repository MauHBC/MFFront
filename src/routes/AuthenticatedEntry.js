import React from "react";
import { Redirect } from "react-router-dom";
import { useAuthorization } from "../contexts/AuthorizationContext";
import Menu from "../pages/Menu";
import SemAcesso from "../pages/SemAcesso";

// Login and clinic changes share this entry; direct module URLs keep their guards.
export default function AuthenticatedEntry() {
  const authorization = useAuthorization();
  if (["idle", "loading"].includes(authorization.status)) {
    return <div role="status">Validando acesso...</div>;
  }
  if (authorization.status === "error") {
    return <div role="alert">Não foi possível validar seu acesso.</div>;
  }
  if (authorization.status !== "ready") return <SemAcesso />;
  if (authorization.canAccessModule("schedule")) {
    return <Redirect to="/agendamentos" />;
  }
  return <Menu />;
}
