import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import PropTypes from "prop-types";
import { useSelector } from "react-redux";
import axios from "../services/axios";
import productIdentity from "../config/productIdentity";

const FALLBACK_CONTEXT = {
  clinic_id: null,
  operational_name: productIdentity.name,
  public_name: productIdentity.name,
  logo_url: null,
  favicon_url: null,
  colors: {
    primary: "#6a795c",
    secondary: "#3d5230",
    accent: "#A2B190",
  },
  location: {
    country_code: "BR",
    state_code: null,
    city_name: null,
  },
  has_branding: false,
};

const PENDING_CONTEXT = {
  ...FALLBACK_CONTEXT,
  operational_name: null,
  public_name: null,
};

const ClinicContext = createContext({
  clinic: PENDING_CONTEXT,
  loading: true,
  loaded: false,
  error: null,
  displayName: null,
  logoSrc: null,
  brandInitials: "SG",
});

function applyBrandingVariables(clinic) {
  const root = document.documentElement;
  root.style.setProperty("--clinic-primary-color", clinic.colors.primary);
  root.style.setProperty("--clinic-secondary-color", clinic.colors.secondary);
  root.style.setProperty("--clinic-accent-color", clinic.colors.accent);
}

function applyFavicon(faviconUrl) {
  if (!faviconUrl) return;

  let link = document.querySelector("link[rel='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = faviconUrl;
}

function getInitials(value) {
  const words = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "SG";

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function ClinicProvider({ children }) {
  const isLoggedIn = useSelector((state) => state.auth.isLoggedIn);
  const [clinic, setClinic] = useState(PENDING_CONTEXT);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadClinicContext() {
      if (!isLoggedIn) {
        setClinic(PENDING_CONTEXT);
        setError(null);
        setLoading(false);
        setLoaded(false);
        applyBrandingVariables(FALLBACK_CONTEXT);
        return;
      }

      setLoading(true);
      setLoaded(false);
      setError(null);

      try {
        const response = await axios.get("/clinic-context");
        if (!active) return;

        const nextClinic = {
          ...FALLBACK_CONTEXT,
          ...response.data,
          colors: {
            ...FALLBACK_CONTEXT.colors,
            ...(response.data?.colors || {}),
          },
          location: {
            ...FALLBACK_CONTEXT.location,
            ...(response.data?.location || {}),
          },
        };

        setClinic(nextClinic);
        applyBrandingVariables(nextClinic);
        applyFavicon(nextClinic.favicon_url);
      } catch (err) {
        if (!active) return;
        setError(err);
        setClinic(FALLBACK_CONTEXT);
        applyBrandingVariables(FALLBACK_CONTEXT);
      } finally {
        if (active) {
          setLoading(false);
          setLoaded(true);
        }
      }
    }

    loadClinicContext();

    return () => {
      active = false;
    };
  }, [isLoggedIn]);

  const value = useMemo(() => {
    const displayName = loaded
      ? clinic.public_name || clinic.operational_name || FALLBACK_CONTEXT.public_name
      : null;

    return {
      clinic,
      loading,
      loaded,
      error,
      displayName,
      logoSrc: loaded && clinic.clinic_id ? clinic.logo_url || null : null,
      brandInitials: getInitials(displayName),
    };
  }, [clinic, error, loaded, loading]);

  return (
    <ClinicContext.Provider value={value}>
      {children}
    </ClinicContext.Provider>
  );
}

ClinicProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export function useClinicContext() {
  return useContext(ClinicContext);
}
