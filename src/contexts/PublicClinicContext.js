import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import PropTypes from "prop-types";
import { useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import axios from "../services/axios";
import { getClinicPublicProfile } from "../config/clinicPublicProfiles";
import productIdentity from "../config/productIdentity";

const DEFAULT_PUBLIC_CONTEXT = {
  has_public_tenant: false,
  public_name: productIdentity.name,
  logo_url: null,
  header_logo_url: null,
  logo_header_url: null,
  favicon_url: null,
  primary_color: "#6a795c",
  secondary_color: "#3d5230",
  accent_color: "#A2B190",
  domain: null,
  domain_type: null,
};

const PENDING_PUBLIC_CONTEXT = {
  ...DEFAULT_PUBLIC_CONTEXT,
  public_name: null,
};

const PublicClinicContext = createContext({
  publicClinic: PENDING_PUBLIC_CONTEXT,
  loading: true,
  loaded: false,
  error: null,
  displayName: null,
  logoSrc: null,
});

function normalizePublicProfile(profile) {
  if (!profile) return null;

  const services = Array.isArray(profile.services)
    ? profile.services
    : profile.services_json;
  const differentials = Array.isArray(profile.differentials)
    ? profile.differentials
    : profile.differentials_json;
  const contactSocialLinks = Array.isArray(profile.contact_social_links)
    ? profile.contact_social_links
    : profile.contact_social_links_json;
  const publicUnits = Array.isArray(profile.public_units)
    ? profile.public_units
    : profile.public_units_json;
  const legalLinks = Array.isArray(profile.legal_links)
    ? profile.legal_links
    : profile.legal_links_json;
  const aboutImageUrls = Array.isArray(profile.about_image_urls)
    ? profile.about_image_urls
    : null;
  const aboutImageAltTexts = Array.isArray(profile.about_image_alt_texts)
    ? profile.about_image_alt_texts
    : null;
  const heroImageUrls = Array.isArray(profile.hero_image_urls)
    ? profile.hero_image_urls
    : null;
  const heroImageAltTexts = Array.isArray(profile.hero_image_alt_texts)
    ? profile.hero_image_alt_texts
    : null;
  const heroPresentation = profile.hero_presentation
    || profile.hero_presentation_json
    || null;
  const aboutText = Array.isArray(profile.about_text)
    ? profile.about_text
    : String(profile.about_text || "")
      .split(/\r?\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

  return {
    ...profile,
    services: Array.isArray(services) ? services : profile.services,
    differentials: Array.isArray(differentials) ? differentials : profile.differentials,
    contact_social_links: Array.isArray(contactSocialLinks)
      ? contactSocialLinks
      : profile.contact_social_links,
    public_units: Array.isArray(publicUnits) ? publicUnits : profile.public_units,
    legal_links: Array.isArray(legalLinks) ? legalLinks : profile.legal_links,
    about_text: aboutText.length > 0 ? aboutText : profile.about_text,
    about_image_urls: aboutImageUrls,
    about_image_alt_texts: aboutImageAltTexts,
    hero_image_urls: heroImageUrls,
    hero_image_alt_texts: heroImageAltTexts,
    hero_presentation: heroPresentation,
    contact_instagram_label:
      profile.contact_instagram_label || (profile.contact_instagram ? "Instagram" : null),
  };
}

function normalizeContext(data) {
  const apiProfile = normalizePublicProfile(data?.public_profile);
  const staticProfile = data?.has_public_tenant
    ? getClinicPublicProfile(data?.clinic_id)
    : null;
  const profile = apiProfile
    ? { ...(staticProfile || {}), ...apiProfile }
    : staticProfile;
  const brandingProfile = apiProfile ? null : staticProfile;

  return {
    ...DEFAULT_PUBLIC_CONTEXT,
    ...data,
    ...(profile || {}),
    public_profile: profile || null,
    has_public_tenant: Boolean(data?.has_public_tenant),
    public_name:
      brandingProfile?.public_name ||
      data?.public_name ||
      DEFAULT_PUBLIC_CONTEXT.public_name,
    logo_url: brandingProfile?.logo_url || data?.logo_url || null,
    header_logo_url: data?.header_logo_url || null,
    logo_header_url: brandingProfile?.logo_header_url || data?.logo_header_url || null,
    favicon_url: brandingProfile?.favicon_url || data?.favicon_url || null,
    primary_color:
      brandingProfile?.primary_color ||
      data?.primary_color ||
      DEFAULT_PUBLIC_CONTEXT.primary_color,
    secondary_color:
      brandingProfile?.secondary_color ||
      data?.secondary_color ||
      DEFAULT_PUBLIC_CONTEXT.secondary_color,
    accent_color:
      brandingProfile?.accent_color ||
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
  const location = useLocation();
  const shouldLoadPublicContext = !isLoggedIn || location.pathname === "/";
  const [publicClinic, setPublicClinic] = useState(PENDING_PUBLIC_CONTEXT);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadPublicClinicContext() {
      if (!shouldLoadPublicContext) {
        setLoading(false);
        setLoaded(true);
        return;
      }

      setLoading(true);
      setLoaded(false);
      setError(null);

      try {
        const params = new URLSearchParams(location.hash.replace(/^#/, ""));
        const previewToken = params.get("landing_preview");
        const previewClinicId = params.get("clinic_id");
        const endpoint = previewToken && previewClinicId
          ? `/public/landing-preview/${encodeURIComponent(previewClinicId)}`
          : "/public/clinic-context";
        const response = await axios.get(endpoint, previewToken ? {
          headers: { "X-Landing-Preview-Token": previewToken },
        } : undefined);
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
        if (active) {
          setLoading(false);
          setLoaded(true);
        }
      }
    }

    loadPublicClinicContext();

    return () => {
      active = false;
    };
  }, [location.hash, shouldLoadPublicContext]);

  const value = useMemo(() => ({
    publicClinic,
    loading,
    loaded,
    error,
    displayName: loaded
      ? publicClinic.public_name || DEFAULT_PUBLIC_CONTEXT.public_name
      : null,
    logoSrc: publicClinic.logo_url || null,
  }), [error, loaded, loading, publicClinic]);

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
