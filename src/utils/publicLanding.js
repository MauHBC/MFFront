import productIdentity from "../config/productIdentity";
import { getPublicLandingModuleState } from "../components/PublicLanding/publicLandingModules";

const DEFAULT_CTA_LABEL = "Falar pelo WhatsApp";
const DEFAULT_GENERIC_CTA_LABEL = "Entrar em contato";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DANGEROUS_URL_PATTERN = /^(javascript|data|vbscript):/i;

function cleanText(value) {
  const text = String(value || "").trim();
  return text || null;
}

export function isSafeHref(value, { allowMailTo = false, allowTel = false } = {}) {
  const href = cleanText(value);
  if (!href || DANGEROUS_URL_PATTERN.test(href)) return false;
  if (/^https?:\/\//i.test(href)) return true;
  if (allowMailTo && /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(href)) return true;
  if (allowTel && /^tel:[0-9+().\-\s]+$/i.test(href)) return true;
  return href.startsWith("/") || href.startsWith("#");
}

export function buildWhatsappHref(contactWhatsapp) {
  if (!contactWhatsapp) return null;
  if (/^https?:\/\//i.test(contactWhatsapp)) return isSafeHref(contactWhatsapp) ? contactWhatsapp : null;

  const digits = String(contactWhatsapp).replace(/\D/g, "");
  if (!digits) return null;

  const normalized = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${normalized}`;
}

function getWhatsappDestinationKey(href) {
  const value = cleanText(href);
  if (!value || !/^https?:\/\//i.test(value)) return null;

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    if (host === "wa.me") {
      const digits = url.pathname.replace(/\D/g, "");
      return digits ? `whatsapp:${digits}` : null;
    }
    if (host === "api.whatsapp.com" || host === "web.whatsapp.com") {
      const digits = (url.searchParams.get("phone") || "").replace(/\D/g, "");
      return digits ? `whatsapp:${digits}` : null;
    }
  } catch (_error) {
    return null;
  }

  return null;
}

function getActionDestinationKey(action) {
  if (!action?.href) return null;
  return getWhatsappDestinationKey(action.href) || cleanText(action.href);
}

function isSameWhatsappAction(action, method) {
  if (!action || method?.id !== "whatsapp") return false;
  const actionKey = getActionDestinationKey(action);
  const methodKey = getWhatsappDestinationKey(method.href);
  return Boolean(actionKey && methodKey && actionKey === methodKey);
}

function normalizeArrayValue(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  }
  return [];
}

function normalizeStringArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(cleanText).filter(Boolean);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return normalizeStringArray(parsed);
    } catch (_error) {
      return cleanText(value) ? [cleanText(value)] : [];
    }
  }
  return [];
}

function normalizeParagraphs(value) {
  if (Array.isArray(value)) {
    return value.map(cleanText).filter(Boolean);
  }
  const text = cleanText(value);
  if (!text) return [];

  return text
    .split(/\r?\n/)
    .map(cleanText)
    .filter(Boolean);
}

function uniqueList(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = String(item || "").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeBoolean(value, defaultValue = true) {
  if (value === undefined || value === null || value === "") return defaultValue;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const text = String(value).trim().toLowerCase();
  if (["false", "0", "no", "nao", "não", "hidden"].includes(text)) return false;
  return true;
}

function normalizeNumber(value, defaultValue) {
  const number = Number(value);
  return Number.isFinite(number) ? number : defaultValue;
}

function normalizeEmailHref(value) {
  const email = cleanText(value);
  if (!email || !EMAIL_PATTERN.test(email)) return null;
  return `mailto:${email}`;
}

function normalizePhoneHref(value) {
  const phone = cleanText(value);
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  if (!digits || digits.length < 8) return null;
  return `tel:${digits}`;
}

function normalizeSafeExternalOrPath(value) {
  const href = cleanText(value);
  if (!isSafeHref(href)) return null;
  return href;
}

function getHeaderLogo(publicClinic, profile) {
  return (
    normalizeSafeExternalOrPath(publicClinic?.header_logo_url) ||
    normalizeSafeExternalOrPath(profile?.header_logo_url) ||
    normalizeSafeExternalOrPath(profile?.logo_header_url) ||
    normalizeSafeExternalOrPath(publicClinic?.logo_header_url) ||
    normalizeSafeExternalOrPath(profile?.logo_url) ||
    normalizeSafeExternalOrPath(publicClinic?.logo_url)
  );
}

function normalizePublicService(service, index) {
  const title = cleanText(service?.title);
  if (!title) return null;
  if (!normalizeBoolean(service?.is_visible ?? service?.visible, true)) return null;

  const description = cleanText(service.description) || cleanText(service.subtitle);
  const imageSrc =
    cleanText(service.image_url) ||
    cleanText(service.imageUrl) ||
    cleanText(service.image);

  return {
    id: cleanText(service.id) || `${title}-${index}`,
    title,
    description,
    imageSrc,
    imageAlt:
      cleanText(service.image_alt) ||
      cleanText(service.imageAlt) ||
      (imageSrc ? title : null),
    order: normalizeNumber(service.order ?? service.position, index),
  };
}

export function normalizePublicServices(profile) {
  const services = normalizeArrayValue(profile?.services);
  return services
    .map(normalizePublicService)
    .filter(Boolean)
    .sort((a, b) => a.order - b.order);
}

function normalizeAboutImages(profile, displayName) {
  const urls = uniqueList([
    ...normalizeStringArray(profile?.about_image_urls),
    cleanText(profile?.about_image_url),
  ]).slice(0, 2);
  const configuredAlts = normalizeStringArray(profile?.about_image_alt_texts);

  return urls.map((src, index) => ({
    src,
    alt:
      configuredAlts[index] ||
      cleanText(profile?.about_image_alt) ||
      `${displayName || productIdentity.name} - imagem institucional ${index + 1}`,
  }));
}

export function normalizePublicDifferentials(profile) {
  const differentials = normalizeArrayValue(profile?.differentials || profile?.differentials_json);

  return differentials
    .map((item, index) => {
      const title = cleanText(item?.title);
      if (!title) return null;
      if (!normalizeBoolean(item?.is_visible ?? item?.visible, true)) return null;

      return {
        id: cleanText(item.id) || `${title}-${index}`,
        title,
        description: cleanText(item.description) || cleanText(item.subtitle),
        order: normalizeNumber(item.order ?? item.position, index),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.order - b.order);
}

function getAbout(profile, displayName) {
  const label = cleanText(profile?.about_label);
  const title = cleanText(profile?.about_title);
  const paragraphs = normalizeParagraphs(profile?.about_text);
  const images = normalizeAboutImages(profile, displayName);
  const hasContent = Boolean(label || title || paragraphs.length > 0 || images.length > 0);

  return {
    label,
    title,
    paragraphs,
    images,
    hasContent,
  };
}

function getAction(profile) {
  const safeProfile = profile || {};
  const configuredUrl = cleanText(safeProfile.primary_action_url);
  const safeConfiguredUrl = isSafeHref(configuredUrl, { allowMailTo: true, allowTel: true })
    ? configuredUrl
    : null;
  const whatsappUrl = buildWhatsappHref(safeProfile.contact_whatsapp);
  const href = safeConfiguredUrl || whatsappUrl || "#contact";
  const type = cleanText(safeProfile.primary_action_type) || (safeConfiguredUrl ? "link" : "whatsapp");
  const label =
    cleanText(safeProfile.primary_action_label) ||
    (whatsappUrl ? DEFAULT_CTA_LABEL : DEFAULT_GENERIC_CTA_LABEL);

  return {
    href,
    label,
    type,
    isConfigured: Boolean(safeConfiguredUrl || whatsappUrl),
    isExternal: /^https?:\/\//i.test(href),
  };
}

function getConfiguredAction(profile) {
  const action = getAction(profile);
  return action.isConfigured ? action : null;
}

function normalizeContactMethods(profile) {
  const methods = [];
  const whatsappHref = buildWhatsappHref(profile?.contact_whatsapp);
  const phone = cleanText(profile?.contact_phone);
  const phoneHref = normalizePhoneHref(phone);
  const email = cleanText(profile?.contact_email);
  const emailHref = normalizeEmailHref(email);
  const address = cleanText(profile?.contact_address);

  if (whatsappHref) {
    methods.push({
      id: "whatsapp",
      label: "WhatsApp",
      value: "Enviar mensagem",
      href: whatsappHref,
      isExternal: true,
    });
  }
  if (phone && phoneHref) {
    methods.push({
      id: "phone",
      label: "Telefone",
      value: phone,
      href: phoneHref,
      isExternal: false,
    });
  }
  if (email && emailHref) {
    methods.push({
      id: "email",
      label: "E-mail",
      value: email,
      href: emailHref,
      isExternal: false,
    });
  }
  if (address) {
    methods.push({
      id: "address",
      label: "Endereço",
      value: address,
      href: null,
      isExternal: false,
    });
  }

  return methods;
}

function normalizeNamedLinks(items) {
  return normalizeArrayValue(items)
    .map((item, index) => {
      const label = cleanText(item?.label) || cleanText(item?.title);
      const href = normalizeSafeExternalOrPath(item?.url || item?.href);
      if (!label || !href) return null;
      if (!normalizeBoolean(item?.is_visible ?? item?.visible, true)) return null;

      return {
        id: cleanText(item.id) || `${label}-${index}`,
        label,
        href,
        isExternal: /^https?:\/\//i.test(href),
        order: normalizeNumber(item.order ?? item.position, index),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.order - b.order);
}

function normalizeSocialLinks(profile) {
  const configured = normalizeNamedLinks(profile?.contact_social_links || profile?.contact_social_links_json);
  const instagram = normalizeSafeExternalOrPath(profile?.contact_instagram);
  const instagramLabel = cleanText(profile?.contact_instagram_label) || "Instagram";

  return uniqueList([
    ...configured.map((item) => JSON.stringify(item)),
    instagram ? JSON.stringify({
      id: "instagram",
      label: instagramLabel,
      href: instagram,
      isExternal: true,
      order: configured.length,
    }) : null,
  ])
    .map((item) => (item ? JSON.parse(item) : null))
    .filter(Boolean);
}

function normalizePublicUnits(profile) {
  return normalizeArrayValue(profile?.public_units || profile?.public_units_json)
    .map((item, index) => {
      if (!normalizeBoolean(item?.is_visible ?? item?.visible, true)) return null;
      const address = cleanText(item?.address);
      const name = cleanText(item?.name);
      const phone = cleanText(item?.phone);
      const phoneHref = normalizePhoneHref(phone);
      const mapHref = normalizeSafeExternalOrPath(item?.map_url || item?.mapUrl);
      const hasMinimumContent = Boolean(address || name || phone || mapHref);
      if (!hasMinimumContent) return null;

      return {
        id: cleanText(item.id) || `${name || address || "unidade"}-${index}`,
        name,
        address,
        reference: cleanText(item?.reference) || cleanText(item?.complement),
        hours: cleanText(item?.hours),
        phone,
        phoneHref,
        mapHref,
        order: normalizeNumber(item.order ?? item.position, index),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.order - b.order);
}

function getContact(profile) {
  const primaryAction = getConfiguredAction(profile);
  const methods = normalizeContactMethods(profile);
  const sectionMethods = methods.filter((method) => !isSameWhatsappAction(primaryAction, method));
  const socialLinks = normalizeSocialLinks(profile);
  const units = normalizePublicUnits(profile);
  const label = cleanText(profile?.contact_label);
  const title = cleanText(profile?.contact_title);
  const text = cleanText(profile?.contact_text);
  const hasContent = Boolean(
    label ||
    title ||
    text ||
    primaryAction ||
    methods.length > 0 ||
    socialLinks.length > 0 ||
    units.length > 0,
  );

  return {
    label,
    title,
    text,
    primaryAction,
    methods,
    sectionMethods,
    socialLinks,
    units,
    hasContent,
  };
}

function getFooter(profile, config) {
  const legalLinks = normalizeNamedLinks(profile?.legal_links || profile?.legal_links_json);
  const configuredFooter = profile?.footer || profile?.footer_json || {};
  const configuredNavigation = normalizeNamedLinks(configuredFooter.navigation);
  const navigation = configuredNavigation.length > 0 ? configuredNavigation : [
    { label: "Início", href: "#home", visible: true },
    { label: "Estrutura", href: "#contact", visible: config.hasContact },
    { label: "Serviços", href: "#services", visible: config.hasServices },
    { label: "Sobre", href: "#about", visible: config.hasAbout },
  ].filter((item) => item.visible);

  return {
    navigation,
    legalLinks,
    content: cleanText(configuredFooter.content),
  };
}

function getHeroImages(profile, displayName) {
  const safeProfile = profile || {};
  const configuredImages = normalizeStringArray(safeProfile.hero_image_urls);
  const hasExplicitGallery = Array.isArray(safeProfile.hero_image_urls);
  const legacyHeroImage = cleanText(safeProfile.hero_image_url);
  const legacyAboutImages = normalizeStringArray(safeProfile.about_image_urls);
  const urls = uniqueList(
    hasExplicitGallery
      ? configuredImages
      : [legacyHeroImage || null, ...(!legacyHeroImage ? legacyAboutImages : [])],
  );
  const configuredAlts = normalizeStringArray(safeProfile.hero_image_alt_texts);

  return urls.map((src, index) => ({
    src,
    alt:
      configuredAlts[index] ||
      cleanText(safeProfile.hero_image_alt) ||
      `${displayName || productIdentity.name} - foto ${index + 1}`,
  }));
}

const DEFAULT_HERO_PRESENTATION = {
  overlayColorSource: "neutral-dark",
  overlayStrength: "medium",
  textTone: "light",
  imagePosition: "center",
};

function getHeroPresentation(profile) {
  const source = profile?.hero_presentation || profile?.hero_presentation_json || {};
  const allowed = (value, values, fallback) => (
    values.includes(cleanText(value)) ? cleanText(value) : fallback
  );
  const secondary = source?.secondary_action || {};
  const secondaryUrl = normalizeSafeExternalOrPath(secondary.url);
  const secondaryAction = normalizeBoolean(secondary.visible, false)
    && cleanText(secondary.label)
    && cleanText(secondary.type)
    && secondaryUrl
    ? {
      label: cleanText(secondary.label),
      type: cleanText(secondary.type),
      href: secondaryUrl,
      isExternal: /^https?:\/\//i.test(secondaryUrl),
    }
    : null;

  return {
    overlayColorSource: allowed(
      source.overlay_color_source,
      ["neutral-dark", "primary", "secondary"],
      DEFAULT_HERO_PRESENTATION.overlayColorSource,
    ),
    overlayStrength: allowed(
      source.overlay_strength,
      ["light", "medium", "strong"],
      DEFAULT_HERO_PRESENTATION.overlayStrength,
    ),
    textTone: allowed(
      source.text_tone,
      ["light", "dark"],
      DEFAULT_HERO_PRESENTATION.textTone,
    ),
    imagePosition: allowed(
      source.image_position,
      ["left", "center", "right"],
      DEFAULT_HERO_PRESENTATION.imagePosition,
    ),
    secondaryAction,
  };
}

function getBannerImage(profile, displayName, galleryImages) {
  const src = cleanText(profile?.hero_image_url) || galleryImages[0]?.src || null;
  if (!src) return null;
  const galleryMatch = galleryImages.find((image) => image.src === src);
  return {
    src,
    alt:
      cleanText(profile?.hero_image_alt_text)
      || galleryMatch?.alt
      || `${displayName || productIdentity.name} - foto de destaque`,
  };
}

export function normalizePublicLandingConfig({ publicClinic, displayName }) {
  const profile = publicClinic?.public_profile || {};
  const services = normalizePublicServices(profile);
  const resolvedDisplayName =
    cleanText(profile.public_name) ||
    cleanText(displayName) ||
    cleanText(publicClinic?.public_name) ||
    productIdentity.name;
  const about = getAbout(profile, resolvedDisplayName);
  const differentials = normalizePublicDifferentials(profile);
  const contact = getContact(profile);
  const galleryImages = getHeroImages(profile, resolvedDisplayName);
  const hasContact = contact.hasContent || galleryImages.length > 0;
  const moduleState = getPublicLandingModuleState(publicClinic);
  const partialConfig = moduleState.document ? {
    hasServices: moduleState.hasServices,
    hasAbout: moduleState.hasAbout,
    hasContact: moduleState.hasContact,
  } : {
    hasServices: services.length > 0,
    hasAbout: about.hasContent || differentials.length > 0,
    hasContact,
  };
  const presentation = getHeroPresentation(profile);

  const config = {
    displayName: resolvedDisplayName,
    logoSrc: getHeaderLogo(publicClinic, profile),
    title: cleanText(profile.hero_title) || resolvedDisplayName,
    subtitle: cleanText(profile.hero_subtitle) || productIdentity.subtitle,
    eyebrow:
      cleanText(profile.hero_eyebrow) ||
      cleanText(profile.services_title) ||
      "Cuidado, movimento e bem-estar",
    quote: cleanText(profile.hero_quote),
    quoteAuthor: cleanText(profile.hero_quote_author),
    action: getAction(profile),
    images: galleryImages,
    bannerImage: getBannerImage(profile, resolvedDisplayName, galleryImages),
    heroPresentation: presentation,
    secondaryAction: presentation.secondaryAction,
    services,
    hasServices: partialConfig.hasServices,
    servicesLabel: cleanText(profile.services_label),
    servicesTitle: cleanText(profile.services_title) || "Serviços",
    about,
    differentials,
    hasAbout: partialConfig.hasAbout,
    contact,
    hasContact,
    colors: {
      primary: publicClinic?.primary_color || "#6a795c",
      secondary: publicClinic?.secondary_color || "#3d5230",
      accent: publicClinic?.accent_color || "#A2B190",
    },
  };

  return {
    ...config,
    footer: getFooter(profile, config),
  };
}
