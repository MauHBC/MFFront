import { useEffect, useState } from "react";
import { useIsLoggedIn } from "./useIsLoggedIn";
import axios from "../services/axios";

const initialState = {
  isLoading: false,
  isPlatformAdmin: false,
  role: null,
  checked: false,
};

export function usePlatformAdmin() {
  const isLoggedIn = useIsLoggedIn();
  const [state, setState] = useState(initialState);

  useEffect(() => {
    let isMounted = true;

    async function loadPlatformAdmin() {
      if (!isLoggedIn) {
        setState(initialState);
        return;
      }

      setState((current) => ({ ...current, isLoading: true }));

      try {
        const response = await axios.get("/platform/me");
        if (!isMounted) return;

        setState({
          isLoading: false,
          isPlatformAdmin: response.data?.is_platform_admin === true,
          role: response.data?.role || null,
          checked: true,
        });
      } catch (error) {
        if (!isMounted) return;

        setState({
          isLoading: false,
          isPlatformAdmin: false,
          role: null,
          checked: true,
        });
      }
    }

    loadPlatformAdmin();

    return () => {
      isMounted = false;
    };
  }, [isLoggedIn]);

  return state;
}
