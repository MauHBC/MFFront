/* eslint-disable react/jsx-props-no-spreading */
import React from "react";
import { Route } from "react-router-dom";
import PropTypes from "prop-types";
import { useAuthRedirect } from "../hooks/useAuthRedirect";

function MyRoute({ component: Component, isClosed, allowedGroups, ...rest }) {
  const redirect = useAuthRedirect({ isClosed, allowedGroups, location: rest.location });

  // Se houver redirecionamento, renderiza o componente de redirecionamento
  if (redirect) return redirect;

  // Caso contrário, renderiza a rota normalmente
  return <Route {...rest} render={(props) => <Component {...props} />} />;
}

// Definindo valores padrão
MyRoute.defaultProps = {
  isClosed: false,
  allowedGroups: null,
};

// Definindo tipos das props
MyRoute.propTypes = {
  component: PropTypes.oneOfType([PropTypes.element, PropTypes.func]).isRequired,
  isClosed: PropTypes.bool,
  allowedGroups: PropTypes.number,
};

export default MyRoute;
