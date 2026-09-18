import React from "react";
import PropTypes from "prop-types";
import { useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import { useCommercial } from "../../contexts/CommercialContext";
import Commercial from "./Commercial";

export default function CommercialBoundary({ children }) {
  const logged = useSelector((state) => state.auth.isLoggedIn);
  const { pathname } = useLocation();
  const { status, data, refresh } = useCommercial();
  const publicPaths = ["/cadastro", "/confirmar-email", "/termos", "/privacidade", "/politica", "/recuperar-senha", "/credencial", "/login", "/login/"];
  if (!logged || publicPaths.includes(pathname)) return children;
  if (status === "loading") return <div className="motria-onboarding" role="status">Validando acesso da Agenda…</div>;
  if (status === "error") return <div className="motria-onboarding" role="alert">Não foi possível validar o acesso da Agenda. <button type="button" onClick={refresh}>Tentar novamente</button></div>;
  if (data?.managed && data.state !== "trial_active") return <Commercial />;
  return children;
}
CommercialBoundary.propTypes = { children: PropTypes.node.isRequired };
