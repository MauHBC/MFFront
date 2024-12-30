import { useSelector } from "react-redux";
import { useIsLoggedIn } from "./useIsLoggedIn";

// Hook para encapsular a lógica de autenticação
export const useAuth = () => {
  const isLoggedIn = useIsLoggedIn();
  const username = useSelector((state) => state.auth.user?.name || "");

  return { isLoggedIn, username };
};
