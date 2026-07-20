/* eslint-env jest */
import {
  buildWhatsappHref,
  normalizePublicLandingConfig,
} from "./publicLanding";

describe("public landing normalization", () => {
  it("prefers header_logo_url and falls back through legacy and main logos", () => {
    const build = (publicClinic) => normalizePublicLandingConfig({
      displayName: "Clínica Teste",
      publicClinic,
    });

    expect(build({
      header_logo_url: "/header.png",
      logo_url: "/logo.png",
      public_profile: { logo_header_url: "/legacy.png" },
    }).logoSrc).toBe("/header.png");
    expect(build({
      logo_url: "/logo.png",
      public_profile: { logo_header_url: "/legacy.png" },
    }).logoSrc).toBe("/legacy.png");
    expect(build({
      logo_url: "/logo.png",
      public_profile: {},
    }).logoSrc).toBe("/logo.png");
    expect(build({ public_profile: {} }).logoSrc).toBeNull();
  });

  it("rejects unsafe header logos", () => {
    const config = normalizePublicLandingConfig({
      displayName: "Clínica Teste",
      publicClinic: {
        header_logo_url: ["java", "script:alert(1)"].join(""),
        logo_url: "/safe-logo.png",
        public_profile: {},
      },
    });

    expect(config.logoSrc).toBe("/safe-logo.png");
  });

  it("keeps legacy hero_image_url compatible", () => {
    const config = normalizePublicLandingConfig({
      displayName: "Clínica Teste",
      publicClinic: {
        public_name: "Clínica Teste",
        public_profile: {
          hero_title: "Título curto",
          hero_subtitle: "Texto de apoio",
          hero_image_url: "/hero.jpg",
          contact_whatsapp: "27999999999",
        },
      },
    });

    expect(config.title).toBe("Título curto");
    expect(config.images).toEqual([{
      src: "/hero.jpg",
      alt: "Clínica Teste - foto 1",
    }]);
    expect(config.action.href).toBe("https://wa.me/5527999999999");
    expect(config.action.label).toBe("Falar pelo WhatsApp");
  });

  it("supports configured multiple hero photos with alt text", () => {
    const config = normalizePublicLandingConfig({
      displayName: "Studio Movimento",
      publicClinic: {
        public_profile: {
          hero_image_url: "/legacy.jpg",
          hero_image_urls: ["/one.jpg", "/two.jpg"],
          hero_image_alt_texts: ["Foto um", "Foto dois"],
          primary_action_label: "Marcar avaliação",
          primary_action_url: "/avaliacao",
          primary_action_type: "link",
        },
      },
    });

    expect(config.images).toEqual([
      { src: "/one.jpg", alt: "Foto um" },
      { src: "/two.jpg", alt: "Foto dois" },
    ]);
    expect(config.bannerImage).toEqual({
      src: "/legacy.jpg",
      alt: "Studio Movimento - foto de destaque",
    });
    expect(config.action).toMatchObject({
      href: "/avaliacao",
      label: "Marcar avaliação",
      type: "link",
      isExternal: false,
    });
  });

  it("separates banner, gallery and controlled presentation", () => {
    const config = normalizePublicLandingConfig({
      displayName: "Clínica Teste",
      publicClinic: {
        public_profile: {
          hero_image_url: "/banner.jpg",
          hero_image_alt_text: "Banner exclusivo",
          hero_image_urls: ["/gallery-one.jpg", "/gallery-two.jpg"],
          hero_image_alt_texts: ["Galeria um", "Galeria dois"],
          hero_presentation_json: {
            overlay_color_source: "primary",
            overlay_strength: "strong",
            text_tone: "dark",
            image_position: "right",
            secondary_action: {
              visible: true,
              label: "Conhecer",
              type: "link",
              url: "/conhecer",
            },
          },
        },
      },
    });

    expect(config.bannerImage).toEqual({ src: "/banner.jpg", alt: "Banner exclusivo" });
    expect(config.images).toHaveLength(2);
    expect(config.heroPresentation).toMatchObject({
      overlayColorSource: "primary",
      overlayStrength: "strong",
      textTone: "dark",
      imagePosition: "right",
    });
    expect(config.secondaryAction).toMatchObject({
      label: "Conhecer",
      href: "/conhecer",
    });
  });

  it("applies legacy presentation defaults and hides incomplete secondary CTA", () => {
    const config = normalizePublicLandingConfig({
      displayName: "Clínica Antiga",
      publicClinic: {
        public_profile: {
          hero_image_urls: ["/legacy.jpg"],
          hero_presentation_json: {
            secondary_action: { visible: true, label: "Incompleto" },
          },
        },
      },
    });

    expect(config.bannerImage.src).toBe("/legacy.jpg");
    expect(config.heroPresentation).toMatchObject({
      overlayColorSource: "neutral-dark",
      overlayStrength: "medium",
      textTone: "light",
      imagePosition: "center",
    });
    expect(config.secondaryAction).toBeNull();
  });

  it("keeps an explicitly empty gallery separate from the banner", () => {
    const config = normalizePublicLandingConfig({
      displayName: "Clínica Teste",
      publicClinic: {
        public_profile: {
          hero_image_url: "/banner-only.jpg",
          hero_image_urls: [],
        },
      },
    });

    expect(config.bannerImage.src).toBe("/banner-only.jpg");
    expect(config.images).toEqual([]);
  });

  it("falls back without photos or a new action configuration", () => {
    const config = normalizePublicLandingConfig({
      displayName: "Sem Foto",
      publicClinic: { public_profile: {} },
    });

    expect(config.images).toEqual([]);
    expect(config.action).toMatchObject({
      href: "#contact",
      label: "Entrar em contato",
    });
    expect(config.hasServices).toBe(false);
    expect(config.services).toEqual([]);
  });

  it("uses about images only when no hero image is available", () => {
    const config = normalizePublicLandingConfig({
      displayName: "Clínica Fictícia",
      publicClinic: {
        public_profile: {
          about_image_urls: ["/about-one.jpg", "/about-two.jpg"],
        },
      },
    });

    expect(config.images).toEqual([
      { src: "/about-one.jpg", alt: "Clínica Fictícia - foto 1" },
      { src: "/about-two.jpg", alt: "Clínica Fictícia - foto 2" },
    ]);
  });

  it("normalizes whatsapp numbers and preserves explicit links", () => {
    expect(buildWhatsappHref("(27) 98847-2156")).toBe("https://wa.me/5527988472156");
    expect(buildWhatsappHref("https://wa.me/5527988472156")).toBe("https://wa.me/5527988472156");
  });

  it("normalizes public services without exposing hidden or untitled items", () => {
    const config = normalizePublicLandingConfig({
      displayName: "Clínica Fictícia",
      publicClinic: {
        public_profile: {
          services_title: "Cuidados disponíveis",
          services: [
            {
              title: "Terceiro cuidado",
              subtitle: "Descrição curta",
              order: 3,
            },
            {
              title: "Primeiro cuidado",
              description: "Descrição mais direta",
              image_url: "/assets/neutral/service.png",
              image_alt: "Pessoa em atendimento neutro",
              order: 1,
            },
            {
              title: "Oculto",
              is_visible: false,
            },
            {
              subtitle: "Sem título",
            },
          ],
        },
      },
    });

    expect(config.hasServices).toBe(true);
    expect(config.servicesTitle).toBe("Cuidados disponíveis");
    expect(config.services).toEqual([
      {
        id: "Primeiro cuidado-1",
        title: "Primeiro cuidado",
        description: "Descrição mais direta",
        imageSrc: "/assets/neutral/service.png",
        imageAlt: "Pessoa em atendimento neutro",
        order: 1,
      },
      {
        id: "Terceiro cuidado-0",
        title: "Terceiro cuidado",
        description: "Descrição curta",
        imageSrc: null,
        imageAlt: null,
        order: 3,
      },
    ]);
  });

  it("uses configured and neutral service section metadata", () => {
    const configured = normalizePublicLandingConfig({
      displayName: "Clínica Teste",
      publicClinic: {
        public_profile: {
          services_label: "Especialidades",
          services_title: "Cuidados disponíveis",
          services: [{ title: "Fisioterapia" }],
        },
      },
    });
    const legacy = normalizePublicLandingConfig({
      displayName: "Clínica Teste",
      publicClinic: {
        public_profile: {
          services_title: "Título legado",
          services: [{ title: "Fisioterapia" }],
        },
      },
    });
    const neutral = normalizePublicLandingConfig({
      displayName: "Clínica Teste",
      publicClinic: {
        public_profile: {
          services: [{ title: "Fisioterapia" }],
        },
      },
    });

    expect(configured.servicesLabel).toBe("Especialidades");
    expect(configured.servicesTitle).toBe("Cuidados disponíveis");
    expect(legacy.servicesTitle).toBe("Título legado");
    expect(neutral.servicesLabel).toBeNull();
    expect(neutral.servicesTitle).toBe("Serviços");
  });

  it("does not render about when institutional content and differentials are absent", () => {
    const config = normalizePublicLandingConfig({
      displayName: "Clínica Fictícia",
      publicClinic: { public_profile: {} },
    });

    expect(config.hasAbout).toBe(false);
    expect(config.about.hasContent).toBe(false);
    expect(config.differentials).toEqual([]);
  });

  it("normalizes institutional content without requiring images", () => {
    const config = normalizePublicLandingConfig({
      displayName: "Clínica Fictícia",
      publicClinic: {
        public_profile: {
          about_label: "Sobre",
          about_title: "Um espaço demonstrativo",
          about_text: "Primeiro parágrafo.\nSegundo parágrafo.",
        },
      },
    });

    expect(config.hasAbout).toBe(true);
    expect(config.about).toMatchObject({
      label: "Sobre",
      title: "Um espaço demonstrativo",
      paragraphs: ["Primeiro parágrafo.", "Segundo parágrafo."],
      images: [],
      hasContent: true,
    });
  });

  it("normalizes one and two institutional images with alt text", () => {
    const oneImage = normalizePublicLandingConfig({
      displayName: "Clínica Fictícia",
      publicClinic: {
        public_profile: {
          about_image_urls: ["/about-one.jpg"],
          about_image_alt_texts: ["Sala demonstrativa"],
        },
      },
    });
    const twoImages = normalizePublicLandingConfig({
      displayName: "Clínica Fictícia",
      publicClinic: {
        public_profile: {
          about_image_urls: ["/about-one.jpg", "/about-two.jpg", "/ignored.jpg"],
          about_image_alt_texts: ["Sala demonstrativa", "Atendimento demonstrativo"],
        },
      },
    });

    expect(oneImage.about.images).toEqual([
      { src: "/about-one.jpg", alt: "Sala demonstrativa" },
    ]);
    expect(twoImages.about.images).toEqual([
      { src: "/about-one.jpg", alt: "Sala demonstrativa" },
      { src: "/about-two.jpg", alt: "Atendimento demonstrativo" },
    ]);
  });

  it("keeps legacy about_image_url compatible", () => {
    const config = normalizePublicLandingConfig({
      displayName: "Clínica Fictícia",
      publicClinic: {
        public_profile: {
          about_image_url: "/legacy-about.jpg",
        },
      },
    });

    expect(config.hasAbout).toBe(true);
    expect(config.about.images).toEqual([
      {
        src: "/legacy-about.jpg",
        alt: "Clínica Fictícia - imagem institucional 1",
      },
    ]);
  });

  it("normalizes public differentials by visibility and order", () => {
    const config = normalizePublicLandingConfig({
      displayName: "Clínica Fictícia",
      publicClinic: {
        public_profile: {
          differentials: [
            { title: "Terceiro", description: "Texto", order: 3 },
            { title: "Primeiro", subtitle: "Resumo", order: 1 },
            { title: "Oculto", visible: false, order: 2 },
            { description: "Sem título" },
          ],
        },
      },
    });

    expect(config.hasAbout).toBe(true);
    expect(config.differentials).toEqual([
      {
        id: "Primeiro-1",
        title: "Primeiro",
        description: "Resumo",
        order: 1,
      },
      {
        id: "Terceiro-0",
        title: "Terceiro",
        description: "Texto",
        order: 3,
      },
    ]);
  });

  it("keeps invalid differentials JSON from breaking the landing", () => {
    const config = normalizePublicLandingConfig({
      displayName: "Clínica Fictícia",
      publicClinic: {
        public_profile: {
          about_title: "Sobre",
          differentials: "{invalid-json",
        },
      },
    });

    expect(config.hasAbout).toBe(true);
    expect(config.differentials).toEqual([]);
  });

  it("normalizes zero, one, two and many public differentials", () => {
    const build = (differentials) => normalizePublicLandingConfig({
      displayName: "Clínica Fictícia",
      publicClinic: {
        public_profile: {
          differentials,
        },
      },
    });

    expect(build([]).differentials).toHaveLength(0);
    expect(build([{ title: "Um" }]).differentials).toHaveLength(1);
    expect(build([{ title: "Um" }, { title: "Dois" }]).differentials).toHaveLength(2);
    expect(build([{ title: "Um" }, { title: "Dois" }, { title: "Três" }]).differentials)
      .toHaveLength(3);
  });

  it("does not expose contact without configured public contact data", () => {
    const config = normalizePublicLandingConfig({
      displayName: "Clínica Fictícia",
      publicClinic: { public_profile: {} },
    });

    expect(config.hasContact).toBe(false);
    expect(config.contact.hasContent).toBe(false);
    expect(config.footer.navigation.map((item) => item.href)).toEqual(["#home"]);
  });

  it("normalizes public contact CTA, methods and footer navigation", () => {
    const config = normalizePublicLandingConfig({
      displayName: "Clínica Fictícia",
      publicClinic: {
        public_profile: {
          contact_label: "Contato",
          contact_title: "Fale com a clínica",
          contact_text: "Texto público demonstrativo.",
          contact_whatsapp: "(27) 99999-0000",
          contact_phone: "(27) 3333-0000",
          contact_email: "contato@clinica.test",
          contact_address: "Rua Fictícia, 100",
          services: [{ title: "Serviço" }],
          about_title: "Sobre",
        },
      },
    });

    expect(config.hasContact).toBe(true);
    expect(config.contact.primaryAction).toMatchObject({
      href: "https://wa.me/5527999990000",
      label: "Falar pelo WhatsApp",
      isExternal: true,
    });
    expect(config.contact.methods.map((method) => method.id)).toEqual([
      "whatsapp",
      "phone",
      "email",
      "address",
    ]);
    expect(config.contact.sectionMethods.map((method) => method.id)).toEqual([
      "phone",
      "email",
      "address",
    ]);
    expect(config.footer.navigation.map((item) => item.label)).toEqual([
      "Início",
      "Estrutura",
      "Serviços",
      "Sobre",
    ]);
  });

  it("ignores unsafe links in contact, social links, legal links and units", () => {
    const scriptUrl = ["java", "script:alert(1)"].join("");
    const config = normalizePublicLandingConfig({
      displayName: "Clínica Fictícia",
      publicClinic: {
        public_profile: {
          primary_action_label: "Ação insegura",
          primary_action_url: scriptUrl,
          contact_social_links: [
            { label: "Seguro", url: "https://example.com/social" },
            { label: "Inseguro", url: scriptUrl },
          ],
          legal_links: [
            { label: "Privacidade", url: "/privacidade" },
            { label: "Inseguro", url: "data:text/html,boom" },
          ],
          public_units: [
            {
              name: "Unidade",
              address: "Rua Fictícia, 100",
              map_url: "vbscript:msgbox(1)",
            },
          ],
        },
      },
    });

    expect(config.contact.primaryAction).toBeNull();
    expect(config.contact.socialLinks).toHaveLength(1);
    expect(config.footer.legalLinks).toHaveLength(1);
    expect(config.contact.units[0].mapHref).toBeNull();
  });

  it("normalizes public units by visibility and order", () => {
    const build = (publicUnits) => normalizePublicLandingConfig({
      displayName: "Clínica Fictícia",
      publicClinic: {
        public_profile: {
          public_units: publicUnits,
        },
      },
    });

    expect(build([]).contact.units).toHaveLength(0);
    expect(build([{ name: "Uma", order: 1 }]).contact.units).toHaveLength(1);
    expect(build([{ name: "Duas B", order: 2 }, { name: "Duas A", order: 1 }])
      .contact.units.map((unit) => unit.name)).toEqual(["Duas A", "Duas B"]);
    expect(build([
      { name: "Uma", order: 1 },
      { name: "Oculta", visible: false, order: 2 },
      { name: "Três", order: 3 },
    ]).contact.units.map((unit) => unit.name)).toEqual(["Uma", "Três"]);
  });

  it("keeps invalid contact JSON from breaking the landing", () => {
    const config = normalizePublicLandingConfig({
      displayName: "Clínica Fictícia",
      publicClinic: {
        public_profile: {
          contact_title: "Contato",
          public_units: "{invalid-json",
          contact_social_links: "{invalid-json",
          legal_links: "{invalid-json",
        },
      },
    });

    expect(config.hasContact).toBe(true);
    expect(config.contact.units).toEqual([]);
    expect(config.contact.socialLinks).toEqual([]);
    expect(config.footer.legalLinks).toEqual([]);
  });

  it("deduplicates the section WhatsApp method when CTA has the same normalized destination", () => {
    const config = normalizePublicLandingConfig({
      displayName: "Clínica Fictícia",
      publicClinic: {
        public_profile: {
          primary_action_label: "Enviar mensagem",
          primary_action_url: "https://wa.me/5527999990000",
          primary_action_type: "whatsapp",
          contact_whatsapp: "(27) 99999-0000",
          contact_phone: "(27) 3333-0000",
        },
      },
    });

    expect(config.contact.methods.map((method) => method.id)).toEqual(["whatsapp", "phone"]);
    expect(config.contact.sectionMethods.map((method) => method.id)).toEqual(["phone"]);
  });

  it("keeps section WhatsApp when CTA has a different destination", () => {
    const config = normalizePublicLandingConfig({
      displayName: "Clínica Fictícia",
      publicClinic: {
        public_profile: {
          primary_action_label: "Agendar avaliação",
          primary_action_url: "/agendar",
          primary_action_type: "link",
          contact_whatsapp: "(27) 99999-0000",
        },
      },
    });

    expect(config.contact.primaryAction.href).toBe("/agendar");
    expect(config.contact.sectionMethods.map((method) => method.id)).toEqual(["whatsapp"]);
  });

  it("deduplicates WhatsApp despite formatting differences in the same number", () => {
    const config = normalizePublicLandingConfig({
      displayName: "Clínica Fictícia",
      publicClinic: {
        public_profile: {
          primary_action_label: "Enviar mensagem",
          primary_action_url: "https://api.whatsapp.com/send?phone=5527999990000",
          primary_action_type: "whatsapp",
          contact_whatsapp: "27 99999-0000",
        },
      },
    });

    expect(config.contact.methods.map((method) => method.id)).toEqual(["whatsapp"]);
    expect(config.contact.sectionMethods).toEqual([]);
  });
});
