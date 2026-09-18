import React, { useEffect } from "react";
import { Helmet } from "react-helmet";
import { Router, useLocation } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import { Provider, useSelector } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import PropTypes from "prop-types";

import store, { persistor } from "./store";
import history from "./services/history";
import Routes from "./routes";
import { CommercialProvider } from "./contexts/CommercialContext";
import CommercialBoundary from "./pages/SelfService/CommercialBoundary";
import { ClinicProvider, useClinicContext } from "./contexts/ClinicContext";
import { AuthorizationProvider } from "./contexts/AuthorizationContext";
import { ClinicSessionProvider, useClinicSession } from "./contexts/ClinicSessionContext";
import { ClinicTransitionGuardProvider } from "./contexts/ClinicTransitionGuardContext";
import { PublicClinicProvider, usePublicClinicContext } from "./contexts/PublicClinicContext";
import productIdentity from "./config/productIdentity";
import TenantLoading from "./components/TenantLoading";
import useAppVersionUpdate from "./hooks/useAppVersionUpdate";
import EntryBoundary, { useEntryPolicy } from "./routes/EntryBoundary";

const PUBLIC_LANDING_PATH = "/";
const AUTH_REDIRECT_PATHS = new Set(["/login", "/login/"]);

function InitialRenderGate({ children }) {
  const { central } = useEntryPolicy();
  const location = useLocation();
  const isLoggedIn = useSelector((state) => state.auth.isLoggedIn);
  const { switching } = useClinicSession();
  const {
    loading: clinicLoading,
    loaded: clinicLoaded,
    error: clinicError,
  } = useClinicContext();
  const {
    loading: publicLoading,
    loaded: publicLoaded,
  } = usePublicClinicContext();
  const isPublicLandingPath = location.pathname === PUBLIC_LANDING_PATH;
  const shouldRedirectAuthenticatedPath = AUTH_REDIRECT_PATHS.has(location.pathname);

  useEffect(() => {
    if (isLoggedIn && clinicLoaded && shouldRedirectAuthenticatedPath && (!central || !clinicError)) {
      history.replace("/menu");
    }
  }, [central, clinicError, clinicLoaded, isLoggedIn, shouldRedirectAuthenticatedPath]);

  if (switching) return <TenantLoading />;
  if (central && isLoggedIn && clinicLoaded && clinicError && shouldRedirectAuthenticatedPath) {
    return <div role="alert">Não foi possível validar sua sessão. Recarregue a página para tentar novamente.</div>;
  }

  if (isPublicLandingPath) {
    if (publicLoading || !publicLoaded) {
      return <TenantLoading />;
    }

    return children;
  }

  if (isLoggedIn) {
    if (clinicLoading || !clinicLoaded || shouldRedirectAuthenticatedPath) {
      return <TenantLoading />;
    }
  }

  if (!isLoggedIn && (publicLoading || !publicLoaded)) {
    return <TenantLoading />;
  }

  return children;
}

InitialRenderGate.propTypes = {
  children: PropTypes.node.isRequired,
};

function AuthenticatedApplication() {
  const token = useSelector((state) => state.auth.token);
  const isLoggedIn = useSelector((state) => state.auth.isLoggedIn);
  const sessionKey = isLoggedIn && token ? token : "anonymous";
  return (
    <ClinicTransitionGuardProvider key={sessionKey}>
      <ClinicSessionProvider>
        <ClinicProvider>
          <AuthorizationProvider>
            <AppHelmet />
            <CommercialProvider>
              <InitialRenderGate>
                <CommercialBoundary><Routes /></CommercialBoundary>
              </InitialRenderGate>
            </CommercialProvider>
            <AppVersionReloader />
            <ToastContainer autoClose={2000} className="toats-container" />
          </AuthorizationProvider>
        </ClinicProvider>
      </ClinicSessionProvider>
    </ClinicTransitionGuardProvider>
  );
}

function AppHelmet() {
  const location = useLocation();
  const isLoggedIn = useSelector((state) => state.auth.isLoggedIn);
  const {
    displayName: clinicDisplayName,
    loaded: clinicLoaded,
  } = useClinicContext();
  const {
    displayName: publicDisplayName,
    loaded: publicLoaded,
  } = usePublicClinicContext();
  const isPublicLandingPath = location.pathname === PUBLIC_LANDING_PATH;
  let title = "Carregando...";
  if (isPublicLandingPath && publicLoaded && publicDisplayName) {
    title = publicDisplayName;
  } else if (isLoggedIn && clinicLoaded && clinicDisplayName) {
    title = clinicDisplayName;
  } else if (!isLoggedIn && publicLoaded && publicDisplayName) {
    title = publicDisplayName;
  }

  return (
    <Helmet>
      <title>{title}</title>
      {new URLSearchParams(location.hash.replace(/^#/, "")).get("landing_preview") && (
        <meta name="robots" content="noindex,nofollow,noarchive" />
      )}
      <meta name="description" content={productIdentity.description} />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin />
      <link
        href="https://fonts.googleapis.com/css2?family=Khula:wght@400;600;800&display=swap"
        rel="stylesheet"
      />
    </Helmet>
  );
}

function AppVersionReloader() {
  useAppVersionUpdate();
  return null;
}

function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={<TenantLoading />} persistor={persistor}>
        <Router history={history}>
          <EntryBoundary>
            <PublicClinicProvider>
              <AuthenticatedApplication />
            </PublicClinicProvider>
          </EntryBoundary>
        </Router>
      </PersistGate>
    </Provider>
  );
}

export default App;
