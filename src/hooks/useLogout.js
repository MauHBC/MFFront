// hooks/useLogout.js
import { useDispatch } from "react-redux";
import * as actions from "../store/modules/auth/actions";
import history from "../services/history";

export function useLogout() {
  const dispatch = useDispatch();

  const handleLogout = (e) => {
    e.preventDefault();
    dispatch(actions.loginFailure());
    history.push("/login");
  };

  return handleLogout;
}
