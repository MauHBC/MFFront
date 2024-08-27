import React from "react";
import { Route, Redirect } from "react-router-dom";
import PropTypes from "prop-types";
import { useSelector } from "react-redux";

// "middleware"
// Every time Componet MyRoute is called, the current state is recorded in the console
export default function MyRoute({
  component: Component,
  isClosed,
  allowedGroups,
  ...rest
}) {
  const isLoggedIn = useSelector((state) => state.auth.isLoggedIn);
  const userGroups = useSelector((state) => state.auth.user.group_ids);

  if (isClosed && !isLoggedIn) {
    return (
      <Redirect
        to={{ pathname: "/login", state: { prevPath: rest.location.pathname } }}
      />
    );
  }

  // Verificar se o usuário deve ser redirecionado para a página de Sem Acesso
  if (
    isClosed &&
    isLoggedIn &&
    allowedGroups &&
    !userGroups.includes(allowedGroups)
  ) {
    return <Redirect to="/semAcesso" />;
  }
  // eslint-disable-next-line react/jsx-props-no-spreading
  return <Route {...rest} render={(props) => <Component {...props} />} />;
}

// defined default property to isClosed.
MyRoute.defaultProps = {
  isClosed: false,
  allowedGroups: null,
};

// defined properties (PropTypes)
MyRoute.propTypes = {
  // to guarantee that component property must be either a React element or a function.
  component: PropTypes.oneOfType([PropTypes.element, PropTypes.func])
    .isRequired, // Obrigatório
  isClosed: PropTypes.bool,
  allowedGroups: PropTypes.number, // Adjust the type based on your group ID implementation
};
