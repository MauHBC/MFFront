import { Redirect } from "react-router-dom";
import { useSelector } from "react-redux";
import { useIsLoggedIn } from "./useIsLoggedIn";

// Hook para verificar autenticação e permissões
export const useAuthRedirect = ({ isClosed, allowedGroups, location }) => {
  const isLoggedIn = useIsLoggedIn();
  const userGroups = useSelector((state) => state.auth.user.group_ids);

  // Verificar se o usuário não está logado e precisa estar
  if (isClosed && !isLoggedIn) {
    return (
      <Redirect
        to={{
          pathname: "/login",
          state: { prevPath: location.pathname },
        }}
      />
    );
  }

  // Verificar se o usuário não tem permissão para acessar a rota
  if (isClosed && isLoggedIn && allowedGroups && !userGroups.includes(allowedGroups)) {
    return <Redirect to="/semAcesso" />;
  }

  return null; // Caso tudo esteja OK, retorna null (sem redirecionamento)
};
