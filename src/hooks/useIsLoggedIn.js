import { useSelector } from "react-redux";

// Hook dedicado para verificar se o usuário está logado
export const useIsLoggedIn = () => {
  return useSelector((state) => state.auth.isLoggedIn);
};
