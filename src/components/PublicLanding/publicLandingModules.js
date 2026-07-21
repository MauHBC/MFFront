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
  gallery: "galleryContact",
  landing_services: "landingServices",
  differentials: "aboutDifferentials",
  about: "aboutDifferentials",
  contact: "galleryContact",
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
  if (key === "professionals" || key === "testimonials") return visibleItems(content.items);
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
      component: IMPLEMENTED_COMPONENTS[key] || null,
      key,
      visible,
    };
  });
  return {
    document,
    modules,
    hasAbout: modules.some((item) => ["about", "differentials"].includes(item.key) && item.visible),
    hasContact: modules.some((item) => ["gallery", "contact"].includes(item.key) && item.visible),
    hasServices: modules.some((item) => item.key === "landing_services" && item.visible),
  };
};

export const getRenderableLandingModules = (publicClinic) => {
  const { modules } = getPublicLandingModuleState(publicClinic);
  const renderedComponents = new Set();
  return modules.filter((module) => {
    if (!module.visible || !module.component || renderedComponents.has(module.component)) return false;
    const compositeVisible = modules.some(
      (candidate) => candidate.component === module.component && candidate.visible,
    );
    if (!compositeVisible) return false;
    renderedComponents.add(module.component);
    return true;
  }).map((module) => ({
    ...module,
    visibleSections: modules
      .filter((candidate) => candidate.component === module.component && candidate.visible)
      .map((candidate) => candidate.key),
  }));
};
