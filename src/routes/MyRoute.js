/* eslint-disable react/jsx-props-no-spreading */
import React from "react";
import { Route } from "react-router-dom";
import PropTypes from "prop-types";
import { useAuthRedirect } from "../hooks/useAuthRedirect";
import { useAuthorization, isTeamAdministrator } from "../contexts/AuthorizationContext";
import SemAcesso from "../pages/SemAcesso";

function MyRoute({
  component: Component,
  isClosed,
  allowedGroups,
  requiredModule,
  minimumAccessLevel,
  requiredCapability,
  administratorOnly,
  ...rest
}) {
  const redirect = useAuthRedirect({ isClosed, allowedGroups, location: rest.location });
  const authorization = useAuthorization();

  // Se houver redirecionamento, renderiza o componente de redirecionamento
  if (redirect) return redirect;

  const requiresOfficialAuthorization = Boolean(
    requiredModule || requiredCapability || administratorOnly,
  );
  if (isClosed && requiresOfficialAuthorization) {
    if (["idle", "loading"].includes(authorization.status)) {
      return <Route {...rest} render={() => <div role="status">Validando acesso...</div>} />;
    }
    if (authorization.status === "error") {
      return (
        <Route
          {...rest}
          render={() => <div role="alert">Não foi possível validar seu acesso.</div>}
        />
      );
    }
    const allowed = authorization.status === "ready"
      && (!administratorOnly || isTeamAdministrator(authorization.context))
      && (!requiredModule || authorization.canAccessModule(requiredModule, minimumAccessLevel))
      && (!requiredCapability || authorization.hasCapability(requiredCapability));
    if (!allowed) return <Route {...rest} render={() => <SemAcesso />} />;
  }

  // Caso contrário, renderiza a rota normalmente
  return <Route {...rest} render={(props) => <Component {...props} />} />;
}

// Definindo valores padrão
MyRoute.defaultProps = {
  isClosed: false,
  allowedGroups: null,
  requiredModule: null,
  minimumAccessLevel: "view",
  requiredCapability: null,
  administratorOnly: false,
};

// Definindo tipos das props
MyRoute.propTypes = {
  component: PropTypes.oneOfType([PropTypes.element, PropTypes.func]).isRequired,
  isClosed: PropTypes.bool,
  allowedGroups: PropTypes.number,
  requiredModule: PropTypes.string,
  minimumAccessLevel: PropTypes.oneOf(["view", "edit", "manage"]),
  requiredCapability: PropTypes.string,
  administratorOnly: PropTypes.bool,
};

export default MyRoute;
