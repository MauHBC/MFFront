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
import { getClinicPublicProfile } from "../config/clinicPublicProfiles";
import productIdentity from "../config/productIdentity";

const DEFAULT_PUBLIC_CONTEXT = {
  has_public_tenant: false,
  public_name: productIdentity.name,
  logo_url: null,
  logo_header_url: null,
  favicon_url: null,
  primary_color: "#6a795c",
  secondary_color: "#3d5230",
  accent_color: "#A2B190",
  domain: null,
  domain_type: null,
};

const PublicClinicContext = createContext({
  publicClinic: DEFAULT_PUBLIC_CONTEXT,
  loading: false,
  error: null,
  displayName: DEFAULT_PUBLIC_CONTEXT.public_name,
  logoSrc: null,
});

function normalizeContext(data) {
  const profile = data?.has_public_tenant
    ? getClinicPublicProfile(data?.clinic_id)
    : null;

  return {
    ...DEFAULT_PUBLIC_CONTEXT,
    ...data,
    has_public_tenant: Boolean(data?.has_public_tenant),
    public_name:
      profile?.public_name ||
      data?.public_name ||
      DEFAULT_PUBLIC_CONTEXT.public_name,
    logo_url: profile?.logo_url || data?.logo_url || null,
    logo_header_url: profile?.logo_header_url || data?.logo_header_url || null,
    favicon_url: profile?.favicon_url || data?.favicon_url || null,
    primary_color:
      profile?.primary_color ||
      data?.primary_color ||
      DEFAULT_PUBLIC_CONTEXT.primary_color,
    secondary_color:
      profile?.secondary_color ||
      data?.secondary_color ||
      DEFAULT_PUBLIC_CONTEXT.secondary_color,
    accent_color:
      profile?.accent_color ||
      data?.accent_color ||
      DEFAULT_PUBLIC_CONTEXT.accent_color,
  };
}

function applyPublicVariables(publicClinic) {
  const root = document.documentElement;
  root.style.setProperty("--public-primary-color", publicClinic.primary_color);
  root.style.setProperty("--public-secondary-color", publicClinic.secondary_color);
  root.style.setProperty("--public-accent-color", publicClinic.accent_color);
}

function applyPublicFavicon(faviconUrl) {
  let link = document.querySelector("link[rel='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }

  link.href = faviconUrl || `${process.env.PUBLIC_URL || ""}/neutral-icon.svg`;
}

export function PublicClinicProvider({ children }) {
  const isLoggedIn = useSelector((state) => state.auth.isLoggedIn);
  const [publicClinic, setPublicClinic] = useState(DEFAULT_PUBLIC_CONTEXT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadPublicClinicContext() {
      if (isLoggedIn) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await axios.get("/public/clinic-context");
        if (!active) return;

        const nextContext = normalizeContext(response.data);
        setPublicClinic(nextContext);
        applyPublicVariables(nextContext);
        document.title = nextContext.public_name;
        applyPublicFavicon(nextContext.favicon_url);
      } catch (err) {
        if (!active) return;

        setError(err);
        setPublicClinic(DEFAULT_PUBLIC_CONTEXT);
        applyPublicVariables(DEFAULT_PUBLIC_CONTEXT);
        document.title = DEFAULT_PUBLIC_CONTEXT.public_name;
        applyPublicFavicon(DEFAULT_PUBLIC_CONTEXT.favicon_url);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadPublicClinicContext();

    return () => {
      active = false;
    };
  }, [isLoggedIn]);

  const value = useMemo(() => ({
    publicClinic,
    loading,
    error,
    displayName: publicClinic.public_name || DEFAULT_PUBLIC_CONTEXT.public_name,
    logoSrc: publicClinic.logo_url || null,
  }), [error, loading, publicClinic]);

  return (
    <PublicClinicContext.Provider value={value}>
      {children}
    </PublicClinicContext.Provider>
  );
}

PublicClinicProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export function usePublicClinicContext() {
  return useContext(PublicClinicContext);
}
