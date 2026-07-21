export const PUBLIC_LANDING_MODULE_KEYS = Object.freeze([
  "hero",
  "gallery",
  "what_is",
  "landing_services",
  "differentials",
  "audience",
  "conversion",
  "about",
  "approach",
  "professionals",
  "testimonials",
  "contact",
  "footer",
]);

const IMPLEMENTED_COMPONENTS = Object.freeze({
  hero: "hero",
  gallery: "gallery",
  what_is: "whatIs",
  landing_services: "landingServices",
  differentials: "differentials",
  audience: "audience",
  conversion: "conversion",
  about: "about",
  approach: "approach",
  professionals: "professionals",
  testimonials: "testimonials",
  contact: "contact",
  footer: "footer",
});

const hasText = (value) => typeof value === "string" && value.trim().length > 0;
const visibleItems = (items) => Array.isArray(items)
  && items.some((item) => item?.visible !== false);

const hasContent = (key, content = {}) => {
  if (key === "gallery") return visibleItems(content.items);
  if (key === "landing_services" || key === "differentials" || key === "audience") {
    return visibleItems(content.items);
  }
  if (key === "approach") return visibleItems(content.steps);
  if (key === "professionals" || key === "testimonials") {
    return Array.isArray(content.items)
      && content.items.some((item) => item?.visible !== false && item?.editorial_authorized === true);
  }
  if (key === "conversion") {
    return hasText(content.title) || hasText(content.text) || Boolean(content.action);
  }
  if (key === "about") {
    return hasText(content.eyebrow)
      || hasText(content.title)
      || hasText(content.content)
      || (Array.isArray(content.images) && content.images.length > 0)
      || Boolean(content.origin?.enabled && content.origin?.content);
  }
  if (key === "contact") {
    return ["label", "title", "text", "phone", "whatsapp", "email", "address"]
      .some((field) => hasText(content[field]))
      || ["social_links", "units", "legal_links"]
        .some((field) => Array.isArray(content[field]) && content[field].length > 0);
  }
  if (key === "what_is") {
    return hasText(content.eyebrow)
      || hasText(content.title)
      || hasText(content.text)
      || Boolean(content.image);
  }
  return false;
};

export const getLandingSectionsDocument = (publicClinic) => {
  const profile = publicClinic?.public_profile || {};
  const document = profile.landing_sections || profile.landing_sections_json;
  return document?.schema_version === 1 && document?.sections ? document : null;
};

export const getPublicLandingModuleState = (publicClinic) => {
  const document = getLandingSectionsDocument(publicClinic);
  const modules = PUBLIC_LANDING_MODULE_KEYS.map((key) => {
    const section = document?.sections?.[key];
    const structural = key === "hero" || key === "footer";
    const visible = structural || Boolean(section?.enabled && hasContent(key, section.content));
    return {
      backgroundVariant: section?.background_variant || "default",
      component: IMPLEMENTED_COMPONENTS[key] || null,
      content: section?.content || {},
      key,
      visible,
    };
  });
  return {
    document,
    modules,
    hasAbout: modules.some((item) => item.key === "about" && item.visible),
    hasContact: modules.some((item) => item.key === "contact" && item.visible),
    hasGallery: modules.some((item) => item.key === "gallery" && item.visible),
    hasServices: modules.some((item) => item.key === "landing_services" && item.visible),
  };
};

export const getRenderableLandingModules = (publicClinic) => {
  const { modules } = getPublicLandingModuleState(publicClinic);
  return modules.filter((module) => module.visible && module.component);
};
