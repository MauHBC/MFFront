/* eslint-env jest */
import {
  PUBLIC_LANDING_MODULE_KEYS,
  getPublicLandingModuleState,
  getRenderableLandingModules,
} from "./publicLandingModules";

const section = (enabled, content = {}) => ({ enabled, content });
const documentFor = (overrides = {}, unknown = {}) => ({
  public_profile: {
    landing_sections: {
      schema_version: 1,
      sections: {
        hero: { content: {} },
        gallery: section(false, { items: [] }),
        what_is: section(false, {}),
        landing_services: section(false, { items: [] }),
        differentials: section(false, { items: [] }),
        audience: section(false, { items: [] }),
        conversion: section(false, {}),
        about: section(false, {}),
        approach: section(false, { steps: [] }),
        professionals: section(false, { items: [] }),
        testimonials: section(false, { items: [] }),
        contact: section(false, { units: [] }),
        footer: { content: {} },
        ...overrides,
        ...unknown,
      },
    },
  },
});

describe("public landing module registry", () => {
  it("keeps the closed catalog in product order", () => {
    expect(PUBLIC_LANDING_MODULE_KEYS).toEqual([
      "hero", "gallery", "what_is", "landing_services", "differentials",
      "audience", "conversion", "about", "approach", "professionals",
      "testimonials", "contact", "footer",
    ]);
  });

  it("renders only structural modules when optional content is absent", () => {
    const modules = getRenderableLandingModules(documentFor());
    expect(modules.map((item) => item.key)).toEqual(["hero", "footer"]);
  });

  it("ignores unknown keys and modules without implemented components", () => {
    const clinic = documentFor({
      what_is: section(true, { title: "Conteudo futuro" }),
    }, {
      arbitrary: section(true, { title: "Nao renderizar" }),
    });
    expect(getRenderableLandingModules(clinic).map((item) => item.key))
      .toEqual(["hero", "footer"]);
  });

  it("does not render disabled or empty modules and preserves their content", () => {
    const clinic = documentFor({
      landing_services: section(false, { items: [{ title: "Preservado", visible: true }] }),
      gallery: section(true, { items: [] }),
    });
    const state = getPublicLandingModuleState(clinic);
    expect(state.hasServices).toBe(false);
    expect(state.hasContact).toBe(false);
    expect(clinic.public_profile.landing_sections.sections.landing_services.content.items)
      .toHaveLength(1);
  });

  it("supports zero one and multiple gallery images", () => {
    [0, 1, 3].forEach((count) => {
      const items = Array.from({ length: count }, (_, index) => ({
        url: `/image-${index}.jpg`, visible: true,
      }));
      const state = getPublicLandingModuleState(documentFor({
        gallery: section(true, { items }),
      }));
      expect(state.hasContact).toBe(count > 0);
    });
  });

  it("keeps composite sections single and in fixed registry order", () => {
    const modules = getRenderableLandingModules(documentFor({
      gallery: section(true, { items: [{ url: "/gallery.jpg", visible: true }] }),
      landing_services: section(true, { items: [{ title: "Editorial", visible: true }] }),
      differentials: section(true, { items: [{ title: "Diferencial", visible: true }] }),
      about: section(true, { title: "Sobre" }),
      contact: section(true, { units: [{ name: "Unidade" }] }),
    }));
    expect(modules.map((item) => item.key)).toEqual([
      "hero", "gallery", "landing_services", "differentials", "footer",
    ]);
    expect(modules.find((item) => item.component === "galleryContact").visibleSections)
      .toEqual(["gallery", "contact"]);
    expect(modules.find((item) => item.component === "aboutDifferentials").visibleSections)
      .toEqual(["differentials", "about"]);
  });

  it("derives navigation only from effectively rendered content", () => {
    const state = getPublicLandingModuleState(documentFor({
      landing_services: section(true, { items: [{ title: "Landing", visible: true }] }),
      about: section(true, { title: "Sobre" }),
      contact: section(true, { units: [] }),
    }));
    expect(state.hasServices).toBe(true);
    expect(state.hasAbout).toBe(true);
    expect(state.hasContact).toBe(false);
  });
});
