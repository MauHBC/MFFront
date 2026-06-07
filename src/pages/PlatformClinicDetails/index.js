import React, { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Link, useParams } from "react-router-dom";
import styled from "styled-components";
import { FaArrowLeft, FaExternalLinkAlt } from "react-icons/fa";
import { PageContent, PageWrapper } from "../../components/AppLayout";
import DataLoadingState from "../../components/DataLoadingState";
import { usePlatformAdmin } from "../../hooks/usePlatformAdmin";
import axios from "../../services/axios";

const emptyBrandingForm = {
  public_name: "",
  logo_url: "",
  favicon_url: "",
  primary_color: "",
  secondary_color: "",
  accent_color: "",
};

const emptyPublicProfileForm = {
  is_published: false,
  hero_title: "",
  hero_subtitle: "",
  hero_quote: "",
  hero_quote_author: "",
  hero_image_url: "",
  about_title: "",
  about_text: "",
  about_image_urls: [],
  services_json: [],
  contact_phone: "",
  contact_whatsapp: "",
  contact_instagram: "",
  contact_address: "",
};

const emptyService = {
  title: "",
  subtitle: "",
  icon: "",
};

const detailTabs = [
  { id: "summary", label: "Resumo" },
  { id: "brand", label: "Marca" },
  { id: "publicPage", label: "Página pública" },
  { id: "domains", label: "Domínios" },
  { id: "diagnostics", label: "Diagnóstico" },
];

function valueOrDash(value) {
  return value === null || value === undefined || value === "" ? "-" : value;
}

const readinessTone = {
  PASS: "pass",
  WARN: "warn",
  FAIL: "fail",
};

const readinessLabel = {
  PASS: "Pronto",
  WARN: "Atenção",
  FAIL: "Corrigir",
};

const domainTypeLabel = {
  primary: "principal",
  secondary: "secundário",
  custom: "personalizado",
};

const domainStatusLabel = {
  verified: "verificado",
  pending: "pendente",
  inactive: "inativo",
};

function nullableText(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function normalizeImageList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "")).filter(Boolean);
}

function normalizeServices(value) {
  if (!Array.isArray(value)) return [];

  return value.map((item) => {
    if (typeof item === "string") {
      return { ...emptyService, title: item };
    }

    return {
      title: String(item?.title || ""),
      subtitle: String(item?.subtitle || item?.description || ""),
      icon: String(item?.icon || item?.type || ""),
    };
  });
}

function sanitizeImageList(value) {
  return normalizeImageList(value).map((item) => item.trim()).filter(Boolean);
}

function sanitizeServices(value) {
  return normalizeServices(value)
    .map((item) => ({
      title: item.title.trim(),
      subtitle: item.subtitle.trim(),
      icon: item.icon.trim(),
    }))
    .filter((item) => item.title || item.subtitle || item.icon);
}

function isValidHex(value) {
  return /^#[0-9a-fA-F]{6}$/.test(String(value || "").trim());
}

function normalizeColorInput(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "";
  const prefixed = rawValue.startsWith("#") ? rawValue : `#${rawValue}`;
  return prefixed.slice(0, 7);
}

function buildPublicUrl(domain) {
  if (!domain) return "";
  if (domain.includes("localhost") || domain.endsWith(".local.test")) {
    return `http://${domain}`;
  }
  return `https://${domain}`;
}

function getPrimaryDomain(domains = []) {
  return domains.find((domain) => domain.is_primary) || domains[0] || null;
}

function isLocalDomain(domain) {
  return domain?.endsWith(".local.test") || domain?.includes("localhost");
}

function getReadinessIssues(readiness) {
  if (!Array.isArray(readiness?.checks)) return [];
  return readiness.checks.filter((check) => check.status !== "PASS");
}

function buildBrandingForm(branding) {
  return {
    public_name: branding?.public_name || "",
    logo_url: branding?.logo_url || "",
    favicon_url: branding?.favicon_url || "",
    primary_color: branding?.primary_color || "",
    secondary_color: branding?.secondary_color || "",
    accent_color: branding?.accent_color || "",
  };
}

function buildPublicProfileForm(publicProfile) {
  return {
    is_published: Boolean(publicProfile?.is_published),
    hero_title: publicProfile?.hero_title || "",
    hero_subtitle: publicProfile?.hero_subtitle || "",
    hero_quote: publicProfile?.hero_quote || "",
    hero_quote_author: publicProfile?.hero_quote_author || "",
    hero_image_url: publicProfile?.hero_image_url || "",
    about_title: publicProfile?.about_title || "",
    about_text: publicProfile?.about_text || "",
    about_image_urls: normalizeImageList(publicProfile?.about_image_urls),
    services_json: normalizeServices(publicProfile?.services_json),
    contact_phone: publicProfile?.contact_phone || "",
    contact_whatsapp: publicProfile?.contact_whatsapp || "",
    contact_instagram: publicProfile?.contact_instagram || "",
    contact_address: publicProfile?.contact_address || "",
  };
}

function StatusBadge({ status }) {
  return (
    <Badge $tone={readinessTone[status] || "neutral"}>
      {readinessLabel[status] || "-"}
    </Badge>
  );
}

StatusBadge.propTypes = {
  status: PropTypes.string,
};

StatusBadge.defaultProps = {
  status: "",
};

function InfoGrid({ items }) {
  return (
    <Grid>
      {items.map((item) => (
        <InfoItem key={item.label}>
          <span>{item.label}</span>
          <strong>{valueOrDash(item.value)}</strong>
        </InfoItem>
      ))}
    </Grid>
  );
}

InfoGrid.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired,
    value: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
      PropTypes.bool,
    ]),
  })).isRequired,
};

function ColorField({
  label,
  name,
  value,
  onChange,
}) {
  const normalizedValue = normalizeColorInput(value);
  const pickerValue = isValidHex(normalizedValue) ? normalizedValue : "#000000";

  return (
    <Field>
      <span>{label}</span>
      <ColorControl>
        <input
          aria-label={`${label} visual`}
          name={name}
          type="color"
          value={pickerValue}
          onChange={onChange}
        />
        <input
          aria-label={`${label} HEX`}
          name={name}
          value={value}
          onChange={onChange}
          placeholder="#064333"
          maxLength={7}
        />
        <ColorPreview aria-hidden="true" $color={isValidHex(value) ? value : "transparent"} />
      </ColorControl>
      {value && !isValidHex(value) && <FieldHint $tone="error">Use HEX válido, exemplo #064333.</FieldHint>}
    </Field>
  );
}

ColorField.propTypes = {
  label: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

function BrandColorCard({
  label,
  name,
  value,
  onChange,
}) {
  const normalizedValue = normalizeColorInput(value);
  const pickerValue = isValidHex(normalizedValue) ? normalizedValue : "#000000";

  return (
    <BrandColorCardShell>
      <BrandColorPreview $color={isValidHex(value) ? value : "transparent"} />
      <BrandColorContent>
        <strong>{label}</strong>
        <BrandColorInputs>
          <input
            aria-label={`${label} HEX`}
            name={name}
            value={value}
            onChange={onChange}
            placeholder="#064333"
            maxLength={7}
          />
          <input
            aria-label={`${label} visual`}
            name={name}
            type="color"
            value={pickerValue}
            onChange={onChange}
          />
        </BrandColorInputs>
        {value && !isValidHex(value) && <FieldHint $tone="error">Use HEX válido, exemplo #064333.</FieldHint>}
      </BrandColorContent>
    </BrandColorCardShell>
  );
}

BrandColorCard.propTypes = {
  label: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

function BrandImageCard({
  label,
  name,
  value,
  onChange,
  placeholder,
}) {
  return (
    <BrandImageCardShell>
      <BrandImageHeader>
        <strong>{label}</strong>
        <span>{value ? "Configurado" : "Não configurado"}</span>
      </BrandImageHeader>
      <BrandPathField>
        <span>Caminho atual</span>
        <input
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
        />
      </BrandPathField>
      <UploadNotice>
        <button type="button" disabled>Upload de imagem</button>
        <small>Upload será habilitado em fase futura.</small>
      </UploadNotice>
    </BrandImageCardShell>
  );
}

BrandImageCard.propTypes = {
  label: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
};

BrandImageCard.defaultProps = {
  placeholder: "",
};

function ImagePathField({
  label,
  name,
  value,
  onChange,
  placeholder,
}) {
  return (
    <Field>
      <span>{label}</span>
      <input
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
      <UploadNotice>
        <button type="button" disabled>Upload de imagem</button>
        <small>Upload será habilitado em fase futura.</small>
      </UploadNotice>
    </Field>
  );
}

ImagePathField.propTypes = {
  label: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
};

ImagePathField.defaultProps = {
  placeholder: "",
};

function AboutImagesEditor({
  images,
  onChange,
  onAdd,
  onRemove,
}) {
  return (
    <EditorBlock>
      <EditorHeader>
        <span>Imagens sobre</span>
        <EditorButton type="button" onClick={onAdd}>Adicionar imagem</EditorButton>
      </EditorHeader>
      {images.length === 0 && <FieldHint>Nenhuma imagem adicionada.</FieldHint>}
      {images.map((image, index) => (
        <ListEditorRow key={`about-image-${index + 1}`}>
          <input
            aria-label={`Imagem sobre ${index + 1}`}
            data-index={index}
            value={image}
            onChange={onChange}
            placeholder="/assets/clinics/cmt/about-logo.png"
          />
          <RemoveButton type="button" data-index={index} onClick={onRemove}>
            Remover
          </RemoveButton>
        </ListEditorRow>
      ))}
      <UploadNotice>
        <button type="button" disabled>Upload de imagem</button>
        <small>Upload será habilitado em fase futura.</small>
      </UploadNotice>
    </EditorBlock>
  );
}

AboutImagesEditor.propTypes = {
  images: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func.isRequired,
  onAdd: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
};

function ServicesEditor({
  services,
  onChange,
  onAdd,
  onRemove,
}) {
  return (
    <EditorBlock>
      <EditorHeader>
        <span>Serviços</span>
        <EditorButton type="button" onClick={onAdd}>Adicionar serviço</EditorButton>
      </EditorHeader>
      {services.length === 0 && <FieldHint>Nenhum serviço adicionado.</FieldHint>}
      {services.map((service, index) => (
        <ServiceRow key={`service-${index + 1}`}>
          <Field>
            <span>Título</span>
            <input
              data-field="title"
              data-index={index}
              value={service.title}
              onChange={onChange}
              placeholder="Fisioterapia"
            />
          </Field>
          <Field>
            <span>Subtítulo</span>
            <input
              data-field="subtitle"
              data-index={index}
              value={service.subtitle}
              onChange={onChange}
              placeholder="Atendimento individualizado"
            />
          </Field>
          <Field>
            <span>Ícone/tipo</span>
            <input
              data-field="icon"
              data-index={index}
              value={service.icon}
              onChange={onChange}
              placeholder="fisioterapia"
            />
          </Field>
          <RemoveButton type="button" data-index={index} onClick={onRemove}>
            Remover serviço
          </RemoveButton>
        </ServiceRow>
      ))}
    </EditorBlock>
  );
}

ServicesEditor.propTypes = {
  services: PropTypes.arrayOf(PropTypes.shape({
    title: PropTypes.string,
    subtitle: PropTypes.string,
    icon: PropTypes.string,
  })).isRequired,
  onChange: PropTypes.func.isRequired,
  onAdd: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
};

function LandingPreview({ branding, profile }) {
  const services = sanitizeServices(profile.services_json);
  const images = sanitizeImageList(profile.about_image_urls);

  return (
    <PreviewBox>
      <PreviewHeader>
        <strong>{branding.public_name || "Nome público da clínica"}</strong>
        <span>{profile.is_published ? "Publicada" : "Não publicada"}</span>
      </PreviewHeader>
      <PreviewHero>
        <div>
          <h3>{profile.hero_title || "Título principal"}</h3>
          <p>{profile.hero_subtitle || "Subtítulo da página pública"}</p>
          {profile.hero_quote && <blockquote>{profile.hero_quote}</blockquote>}
          {profile.hero_quote_author && <small>{profile.hero_quote_author}</small>}
        </div>
        <PreviewImage>
          {profile.hero_image_url || "Imagem principal"}
        </PreviewImage>
      </PreviewHero>
      <PreviewSection>
        <h4>{profile.about_title || "Título sobre"}</h4>
        <p>{profile.about_text || "Texto sobre a clínica."}</p>
        {images.length > 0 && <small>{images.length} imagem(ns) sobre configurada(s)</small>}
      </PreviewSection>
      {services.length > 0 && (
        <PreviewServices>
          {services.map((service, index) => (
            <li key={`preview-service-${index + 1}`}>
              <strong>{service.title || "Serviço"}</strong>
              <span>{service.subtitle || service.icon || "-"}</span>
            </li>
          ))}
        </PreviewServices>
      )}
    </PreviewBox>
  );
}

LandingPreview.propTypes = {
  branding: PropTypes.shape({
    public_name: PropTypes.string,
  }).isRequired,
  profile: PropTypes.shape({
    is_published: PropTypes.bool,
    hero_title: PropTypes.string,
    hero_subtitle: PropTypes.string,
    hero_quote: PropTypes.string,
    hero_quote_author: PropTypes.string,
    hero_image_url: PropTypes.string,
    about_title: PropTypes.string,
    about_text: PropTypes.string,
    about_image_urls: PropTypes.arrayOf(PropTypes.string),
    services_json: PropTypes.arrayOf(PropTypes.shape({
      title: PropTypes.string,
      subtitle: PropTypes.string,
      icon: PropTypes.string,
    })),
  }).isRequired,
};

export default function PlatformClinicDetails() {
  const { id } = useParams();
  const { isLoading: isCheckingAdmin, isPlatformAdmin, checked } = usePlatformAdmin();
  const [detail, setDetail] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [brandingForm, setBrandingForm] = useState(emptyBrandingForm);
  const [publicProfileForm, setPublicProfileForm] = useState(emptyPublicProfileForm);
  const [brandingFeedback, setBrandingFeedback] = useState(null);
  const [publicProfileFeedback, setPublicProfileFeedback] = useState(null);
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [isSavingPublicProfile, setIsSavingPublicProfile] = useState(false);
  const [showLandingPreview, setShowLandingPreview] = useState(false);
  const [activeTab, setActiveTab] = useState("summary");

  useEffect(() => {
    let isMounted = true;

    async function loadDetail() {
      if (!isPlatformAdmin) return;

      setIsLoading(true);
      setError("");

      try {
        const response = await axios.get(`/platform/clinics/${id}`);
        if (!isMounted) return;
        setDetail(response.data);
        setBrandingForm(buildBrandingForm(response.data?.branding));
        setPublicProfileForm(buildPublicProfileForm(response.data?.public_profile));
      } catch (requestError) {
        if (!isMounted) return;
        setError("Não foi possível carregar a clínica.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadDetail();

    return () => {
      isMounted = false;
    };
  }, [id, isPlatformAdmin]);

  const handleBrandingChange = useCallback((event) => {
    const { name, value } = event.target;
    setBrandingFeedback(null);
    const nextValue = name.endsWith("_color") ? normalizeColorInput(value) : value;
    setBrandingForm((current) => ({ ...current, [name]: nextValue }));
  }, []);

  const handlePublicProfileChange = useCallback((event) => {
    const {
      name,
      value,
      type,
      checked: inputChecked,
    } = event.target;
    setPublicProfileFeedback(null);
    setPublicProfileForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? inputChecked : value,
    }));
  }, []);

  const handleAboutImageChange = useCallback((event) => {
    const index = Number(event.target.dataset.index);
    const { value } = event.target;
    setPublicProfileFeedback(null);
    setPublicProfileForm((current) => {
      const nextImages = [...current.about_image_urls];
      nextImages[index] = value;
      return { ...current, about_image_urls: nextImages };
    });
  }, []);

  const addAboutImage = useCallback(() => {
    setPublicProfileFeedback(null);
    setPublicProfileForm((current) => ({
      ...current,
      about_image_urls: [...current.about_image_urls, ""],
    }));
  }, []);

  const removeAboutImage = useCallback((event) => {
    const index = Number(event.currentTarget.dataset.index);
    setPublicProfileFeedback(null);
    setPublicProfileForm((current) => ({
      ...current,
      about_image_urls: current.about_image_urls.filter((item, itemIndex) => itemIndex !== index),
    }));
  }, []);

  const handleServiceChange = useCallback((event) => {
    const index = Number(event.target.dataset.index);
    const { field } = event.target.dataset;
    const { value } = event.target;
    setPublicProfileFeedback(null);
    setPublicProfileForm((current) => {
      const nextServices = current.services_json.map((service, serviceIndex) => {
        if (serviceIndex !== index) return service;
        return { ...service, [field]: value };
      });
      return { ...current, services_json: nextServices };
    });
  }, []);

  const addService = useCallback(() => {
    setPublicProfileFeedback(null);
    setPublicProfileForm((current) => ({
      ...current,
      services_json: [...current.services_json, { ...emptyService }],
    }));
  }, []);

  const removeService = useCallback((event) => {
    const index = Number(event.currentTarget.dataset.index);
    setPublicProfileFeedback(null);
    setPublicProfileForm((current) => ({
      ...current,
      services_json: current.services_json.filter((item, itemIndex) => itemIndex !== index),
    }));
  }, []);

  const toggleLandingPreview = useCallback(() => {
    setShowLandingPreview((current) => !current);
  }, []);

  const handleTabChange = useCallback((event) => {
    setActiveTab(event.currentTarget.dataset.tab);
  }, []);

  const primaryDomain = getPrimaryDomain(detail?.domains || []);
  const readinessIssues = getReadinessIssues(detail?.readiness);

  const saveBranding = useCallback(async (event) => {
    event.preventDefault();
    setIsSavingBranding(true);
    setBrandingFeedback(null);

    try {
      const payload = {
        public_name: nullableText(brandingForm.public_name),
        logo_url: nullableText(brandingForm.logo_url),
        favicon_url: nullableText(brandingForm.favicon_url),
        primary_color: nullableText(brandingForm.primary_color),
        secondary_color: nullableText(brandingForm.secondary_color),
        accent_color: nullableText(brandingForm.accent_color),
      };
      const response = await axios.put(`/platform/clinics/${id}/branding`, payload);
      setDetail((current) => ({ ...current, branding: response.data }));
      setBrandingForm(buildBrandingForm(response.data));
      setBrandingFeedback({ tone: "success", text: "Marca salva." });
    } catch (requestError) {
      const message = requestError?.response?.data?.errors?.[0] || "Não foi possível salvar a marca.";
      setBrandingFeedback({ tone: "error", text: message });
    } finally {
      setIsSavingBranding(false);
    }
  }, [brandingForm, id]);

  const savePublicProfile = useCallback(async (event) => {
    event.preventDefault();
    setIsSavingPublicProfile(true);
    setPublicProfileFeedback(null);

    try {
      const payload = {
        is_published: publicProfileForm.is_published,
        hero_title: nullableText(publicProfileForm.hero_title),
        hero_subtitle: nullableText(publicProfileForm.hero_subtitle),
        hero_quote: nullableText(publicProfileForm.hero_quote),
        hero_quote_author: nullableText(publicProfileForm.hero_quote_author),
        hero_image_url: nullableText(publicProfileForm.hero_image_url),
        about_title: nullableText(publicProfileForm.about_title),
        about_text: nullableText(publicProfileForm.about_text),
        about_image_urls: sanitizeImageList(publicProfileForm.about_image_urls),
        services_json: sanitizeServices(publicProfileForm.services_json),
        contact_phone: nullableText(publicProfileForm.contact_phone),
        contact_whatsapp: nullableText(publicProfileForm.contact_whatsapp),
        contact_instagram: nullableText(publicProfileForm.contact_instagram),
        contact_address: nullableText(publicProfileForm.contact_address),
      };

      const response = await axios.put(`/platform/clinics/${id}/public-profile`, payload);
      setDetail((current) => ({ ...current, public_profile: response.data }));
      setPublicProfileForm(buildPublicProfileForm(response.data));
      setPublicProfileFeedback({ tone: "success", text: "Página pública salva." });
    } catch (requestError) {
      const message = requestError?.response?.data?.errors?.[0]
        || requestError.message
        || "Não foi possível salvar a página pública.";
      setPublicProfileFeedback({ tone: "error", text: message });
    } finally {
      setIsSavingPublicProfile(false);
    }
  }, [id, publicProfileForm]);

  if (isCheckingAdmin || !checked) {
    return (
      <PageWrapper>
        <PageContent>
          <DataLoadingState />
        </PageContent>
      </PageWrapper>
    );
  }

  if (!isPlatformAdmin) {
    return (
      <PageWrapper>
        <PageContent>
          <DataLoadingState tone="error" text="Acesso restrito ao administrador da plataforma." />
        </PageContent>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper $background="#f5f7fb">
      <PageContent $maxWidth="1180px">
        <Header>
          <div>
            <BackLink to="/platform"><FaArrowLeft /> Lista de clínicas</BackLink>
            <h1>{detail?.branding?.public_name || detail?.clinic?.name || "Clínica"}</h1>
          </div>
          <HeaderActions>
            {detail?.readiness && <StatusBadge status={detail.readiness.status} />}
          </HeaderActions>
        </Header>

        {isLoading && <DataLoadingState />}
        {error && <DataLoadingState tone="error" text={error} />}

        {!isLoading && !error && detail && (
          <Sections>
            <Notice>
              Alterações nesta tela afetam a página pública da clínica. Domínios continuam
              somente leitura nesta fase.
            </Notice>

            <Tabs role="tablist" aria-label="Detalhe da clínica">
              {detailTabs.map((tab) => (
                <TabButton
                  key={tab.id}
                  type="button"
                  role="tab"
                  data-tab={tab.id}
                  aria-selected={activeTab === tab.id}
                  $active={activeTab === tab.id}
                  onClick={handleTabChange}
                >
                  {tab.label}
                </TabButton>
              ))}
            </Tabs>

            {activeTab === "summary" && (
              <TabPanel role="tabpanel">
                <SummaryGrid>
                  <Section>
                    <h2>Dados principais</h2>
                    <InfoGrid
                      items={[
                        { label: "ID", value: detail.clinic.id },
                        { label: "Nome interno", value: detail.clinic.name },
                        { label: "Nome público", value: detail.branding?.public_name },
                        { label: "Cidade", value: detail.clinic.city_name },
                        { label: "Estado", value: detail.clinic.state_code },
                        { label: "Status", value: detail.clinic.is_active ? "Ativa" : "Inativa" },
                      ]}
                    />
                  </Section>

                  <Section>
                    <h2>Prontidão</h2>
                    <ReadinessSummary>
                      <StatusBadge status={detail.readiness.status} />
                      <span>
                        {readinessIssues.length === 0
                          ? "Clínica pronta para operar."
                          : `${readinessIssues.length} pendência(s) encontrada(s).`}
                      </span>
                    </ReadinessSummary>
                    <PendingList>
                      {readinessIssues.length === 0 && <li>Nenhuma pendência principal.</li>}
                      {readinessIssues.slice(0, 4).map((check) => (
                        <li key={`summary-${check.status}-${check.label}`}>
                          <StatusBadge status={check.status} />
                          <span>{check.label}</span>
                        </li>
                      ))}
                    </PendingList>
                  </Section>

                  <Section>
                    <h2>Domínio principal</h2>
                    <DomainSummary>
                      <strong>{primaryDomain?.domain || "Nenhum domínio principal"}</strong>
                      <span>
                        {primaryDomain
                          ? `${primaryDomain.is_primary ? "principal" : "secundário"} | ${domainStatusLabel[primaryDomain.verification_status] || primaryDomain.verification_status || "-"}`
                          : "Cadastre e verifique um domínio em fase futura."}
                      </span>
                    </DomainSummary>
                    {primaryDomain?.domain ? (
                      <SiteAction>
                        <SiteLink
                          href={buildPublicUrl(primaryDomain.domain)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Ver site público <FaExternalLinkAlt />
                        </SiteLink>
                        {isLocalDomain(primaryDomain.domain) && (
                          <SiteHint>
                            Pode exigir configuração no arquivo hosts do Windows para abrir no navegador.
                          </SiteHint>
                        )}
                      </SiteAction>
                    ) : (
                      <SiteAction>
                        <DisabledSiteButton type="button" disabled>Ver site público</DisabledSiteButton>
                        <SiteHint>Nenhum domínio principal cadastrado.</SiteHint>
                      </SiteAction>
                    )}
                  </Section>
                </SummaryGrid>
              </TabPanel>
            )}

            {activeTab === "brand" && (
              <TabPanel role="tabpanel">
                <Section>
                  <h2>Preview da marca</h2>
                  <BrandPreview>
                    <BrandMark $color={isValidHex(brandingForm.primary_color) ? brandingForm.primary_color : "#344154"}>
                      {(brandingForm.public_name || detail.clinic.name || "S").slice(0, 2).toUpperCase()}
                    </BrandMark>
                    <div>
                      <strong>{brandingForm.public_name || detail.clinic.name}</strong>
                      <span>{brandingForm.logo_url ? "Logo configurada" : "Logo não configurada"}</span>
                    </div>
                    <BrandSwatches>
                      <ColorPreview $color={isValidHex(brandingForm.primary_color) ? brandingForm.primary_color : "transparent"} />
                      <ColorPreview $color={isValidHex(brandingForm.secondary_color) ? brandingForm.secondary_color : "transparent"} />
                      <ColorPreview $color={isValidHex(brandingForm.accent_color) ? brandingForm.accent_color : "transparent"} />
                    </BrandSwatches>
                  </BrandPreview>
                </Section>
                <Section>
                  <Form onSubmit={saveBranding}>
                    <BrandEditorStack>
                      <BrandGroup>
                        <BrandGroupHeader>
                          <h2>Identidade visual</h2>
                          <p>Configure o nome público e os arquivos visuais usados na página pública.</p>
                        </BrandGroupHeader>
                        <BrandIdentityGrid>
                          <BrandNameField>
                            <span>Nome público</span>
                            <input
                              name="public_name"
                              value={brandingForm.public_name}
                              onChange={handleBrandingChange}
                              maxLength={120}
                            />
                          </BrandNameField>
                          <BrandImageCard
                            label="Logo"
                            name="logo_url"
                            value={brandingForm.logo_url}
                            onChange={handleBrandingChange}
                            placeholder="/assets/clinics/cmt/logo.png"
                          />
                          <BrandImageCard
                            label="Favicon"
                            name="favicon_url"
                            value={brandingForm.favicon_url}
                            onChange={handleBrandingChange}
                            placeholder="/assets/clinics/cmt/favicon.ico"
                          />
                        </BrandIdentityGrid>
                      </BrandGroup>

                      <BrandGroup>
                        <BrandGroupHeader>
                          <h2>Cores da marca</h2>
                          <p>Use o seletor visual ou digite o HEX da paleta pública.</p>
                        </BrandGroupHeader>
                        <BrandColorGrid>
                          <BrandColorCard
                            label="Cor primária"
                            name="primary_color"
                            value={brandingForm.primary_color}
                            onChange={handleBrandingChange}
                          />
                          <BrandColorCard
                            label="Cor secundária"
                            name="secondary_color"
                            value={brandingForm.secondary_color}
                            onChange={handleBrandingChange}
                          />
                          <BrandColorCard
                            label="Cor de destaque"
                            name="accent_color"
                            value={brandingForm.accent_color}
                            onChange={handleBrandingChange}
                          />
                        </BrandColorGrid>
                      </BrandGroup>
                    </BrandEditorStack>

                    <BrandSaveBar>
                      <SaveButton type="submit" disabled={isSavingBranding}>
                        {isSavingBranding ? "Salvando..." : "Salvar marca"}
                      </SaveButton>
                      {brandingFeedback && (
                        <Feedback $tone={brandingFeedback.tone}>{brandingFeedback.text}</Feedback>
                      )}
                    </BrandSaveBar>
                  </Form>
                </Section>
              </TabPanel>
            )}

            {activeTab === "publicPage" && (
              <TabPanel role="tabpanel">
                <Section>
              <h2>Página pública</h2>
              <Form onSubmit={savePublicProfile}>
                <PreviewToolbar>
                  <PreviewButton type="button" onClick={toggleLandingPreview}>
                    {showLandingPreview ? "Ocultar prévia" : "Pré-visualizar nesta tela"}
                  </PreviewButton>
                  <FieldHint>Prévia simplificada com os dados atuais do formulário.</FieldHint>
                </PreviewToolbar>
                {showLandingPreview && (
                  <LandingPreview branding={brandingForm} profile={publicProfileForm} />
                )}
                <VerticalFields>
                  <CheckboxRow>
                    <input
                      name="is_published"
                      type="checkbox"
                      checked={publicProfileForm.is_published}
                      onChange={handlePublicProfileChange}
                    />
                    <span>Publicada</span>
                  </CheckboxRow>
                  <Field>
                    <span>Título principal</span>
                    <input
                      name="hero_title"
                      value={publicProfileForm.hero_title}
                      onChange={handlePublicProfileChange}
                      maxLength={190}
                    />
                  </Field>
                  <WideField>
                    <span>Subtítulo</span>
                    <textarea
                      name="hero_subtitle"
                      value={publicProfileForm.hero_subtitle}
                      onChange={handlePublicProfileChange}
                      rows={3}
                    />
                  </WideField>
                  <WideField>
                    <span>Frase destaque</span>
                    <textarea
                      name="hero_quote"
                      value={publicProfileForm.hero_quote}
                      onChange={handlePublicProfileChange}
                      rows={3}
                    />
                  </WideField>
                  <Field>
                    <span>Autor da frase</span>
                    <input
                      name="hero_quote_author"
                      value={publicProfileForm.hero_quote_author}
                      onChange={handlePublicProfileChange}
                      maxLength={190}
                    />
                  </Field>
                  <ImagePathField
                    label="Imagem principal"
                    name="hero_image_url"
                    value={publicProfileForm.hero_image_url}
                    onChange={handlePublicProfileChange}
                    placeholder="/assets/clinics/cmt/hero-photo.jpg"
                  />
                  <Field>
                    <span>Título sobre</span>
                    <input
                      name="about_title"
                      value={publicProfileForm.about_title}
                      onChange={handlePublicProfileChange}
                      maxLength={190}
                    />
                  </Field>
                  <WideField>
                    <span>Texto sobre</span>
                    <textarea
                      name="about_text"
                      value={publicProfileForm.about_text}
                      onChange={handlePublicProfileChange}
                      rows={5}
                    />
                  </WideField>
                  <Field>
                    <span>Telefone</span>
                    <input
                      name="contact_phone"
                      value={publicProfileForm.contact_phone}
                      onChange={handlePublicProfileChange}
                      maxLength={80}
                    />
                  </Field>
                  <Field>
                    <span>WhatsApp</span>
                    <input
                      name="contact_whatsapp"
                      value={publicProfileForm.contact_whatsapp}
                      onChange={handlePublicProfileChange}
                      maxLength={120}
                    />
                  </Field>
                  <Field>
                    <span>Instagram</span>
                    <input
                      name="contact_instagram"
                      value={publicProfileForm.contact_instagram}
                      onChange={handlePublicProfileChange}
                      maxLength={255}
                    />
                  </Field>
                  <Field>
                    <span>Endereço</span>
                    <textarea
                      name="contact_address"
                      value={publicProfileForm.contact_address}
                      onChange={handlePublicProfileChange}
                      rows={3}
                    />
                  </Field>
                  <AboutImagesEditor
                    images={publicProfileForm.about_image_urls}
                    onChange={handleAboutImageChange}
                    onAdd={addAboutImage}
                    onRemove={removeAboutImage}
                  />
                  <ServicesEditor
                    services={publicProfileForm.services_json}
                    onChange={handleServiceChange}
                    onAdd={addService}
                    onRemove={removeService}
                  />
                </VerticalFields>
                <ButtonRow>
                  <SaveButton type="submit" disabled={isSavingPublicProfile}>
                    {isSavingPublicProfile ? "Salvando..." : "Salvar página pública"}
                  </SaveButton>
                  {publicProfileFeedback && (
                    <Feedback $tone={publicProfileFeedback.tone}>
                      {publicProfileFeedback.text}
                    </Feedback>
                  )}
                </ButtonRow>
              </Form>
                </Section>
              </TabPanel>
            )}

            {activeTab === "domains" && (
              <TabPanel role="tabpanel">
                <Section>
                  <h2>Domínios</h2>
                  <SectionHint>Domínios estão somente leitura nesta fase. Edição será tratada em fase futura.</SectionHint>
                  <List>
                    {detail.domains.length === 0 && <li>Nenhum domínio cadastrado.</li>}
                    {detail.domains.map((domain) => (
                      <li key={domain.id || domain.domain}>
                        <strong>{domain.domain}</strong>
                        <span>
                          {domainTypeLabel[domain.domain_type] || domain.domain_type || "domínio"}
                          {" | "}
                          {domain.is_primary ? "principal" : "secundário"}
                          {" | "}
                          {domainStatusLabel[domain.verification_status] || domain.verification_status || "-"}
                        </span>
                      </li>
                    ))}
                  </List>
                </Section>
              </TabPanel>
            )}

            {activeTab === "diagnostics" && (
              <TabPanel role="tabpanel">
                <Section>
                  <h2>Checklist técnico</h2>
                  <Checks>
                    {detail.readiness.checks.map((check) => (
                      <li key={`${check.status}-${check.label}`}>
                        <StatusBadge status={check.status} />
                        <span>{check.label}</span>
                      </li>
                    ))}
                  </Checks>
                </Section>

                <Section>
                  <h2>Métricas resumidas</h2>
                  <InfoGrid
                    items={[
                      { label: "Pacientes", value: detail.metrics.patients },
                      { label: "Sessões", value: detail.metrics.sessions },
                      { label: "Lançamentos financeiros", value: detail.metrics.financial_entries },
                      { label: "Usuários", value: detail.metrics.users },
                    ]}
                  />
                </Section>

                <Section>
                  <h2>Usuários/Admins</h2>
                  <List>
                    {detail.users.length === 0 && <li>Nenhum usuário encontrado.</li>}
                    {detail.users.map((user) => (
                      <li key={user.id}>
                        <strong>{user.name || user.email}</strong>
                        <span>{user.email} | {user.groups.map((group) => group.slug || group.name).filter(Boolean).join(", ") || "sem grupo"}</span>
                      </li>
                    ))}
                  </List>
                </Section>
              </TabPanel>
            )}
          </Sections>
        )}
      </PageContent>
    </PageWrapper>
  );
}

const Header = styled.header`
  box-sizing: border-box;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
  margin-bottom: 20px;
  font-family: Inter, Roboto, "Nunito Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;

  h1 {
    margin: 8px 0 0;
    font-size: clamp(1.65rem, 3vw, 2.15rem);
    color: #111827;
    letter-spacing: 0;
    line-height: 1.08;
  }

  @media (max-width: 760px) {
    align-items: flex-start;
    flex-direction: column;
  }
`;

const HeaderActions = styled.div`
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
`;

const BackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #2563eb;
  font-size: 0.9rem;
  font-weight: 750;
  text-decoration: none;
`;

const SiteLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px solid rgba(37, 99, 235, 0.22);
  border-radius: 10px;
  color: #2563eb;
  background: #fff;
  font-size: 0.88rem;
  font-weight: 800;
  padding: 9px 12px;
  text-decoration: none;
  box-shadow: 0 8px 22px rgba(37, 99, 235, 0.08);
`;

const SiteAction = styled.div`
  box-sizing: border-box;
  display: grid;
  justify-items: end;
  gap: 5px;
  min-width: 0;
  max-width: 360px;
`;

const DisabledSiteButton = styled.button`
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 10px;
  color: #94a3b8;
  background: #f8fafc;
  font-size: 0.88rem;
  font-weight: 800;
  padding: 9px 12px;
`;

const SiteHint = styled.small`
  color: #64748b;
  font-size: 0.76rem;
  font-weight: 700;
  line-height: 1.35;
  text-align: right;
`;

const Sections = styled.div`
  box-sizing: border-box;
  display: grid;
  gap: 18px;
  font-family: Inter, Roboto, "Nunito Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
`;

const Tabs = styled.div`
  box-sizing: border-box;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.78);
  padding: 6px;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.045);
`;

const TabButton = styled.button`
  box-sizing: border-box;
  border: 1px solid ${({ $active }) => ($active ? "rgba(37, 99, 235, 0.22)" : "transparent")};
  border-radius: 11px;
  background: ${({ $active }) => ($active ? "#ffffff" : "transparent")};
  color: ${({ $active }) => ($active ? "#2563eb" : "#64748b")};
  cursor: pointer;
  font-size: 0.88rem;
  font-weight: 800;
  padding: 9px 13px;
  box-shadow: ${({ $active }) => ($active ? "0 8px 20px rgba(15, 23, 42, 0.08)" : "none")};
  transition: background 0.14s ease, color 0.14s ease, box-shadow 0.14s ease;

  &:hover {
    color: #2563eb;
    background: rgba(255, 255, 255, 0.72);
  }
`;

const TabPanel = styled.div`
  box-sizing: border-box;
  display: grid;
  gap: 16px;
  min-width: 0;
`;

const SummaryGrid = styled.div`
  box-sizing: border-box;
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(260px, 0.9fr);
  gap: 16px;
  min-width: 0;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const Notice = styled.div`
  box-sizing: border-box;
  padding: 13px 15px;
  border-radius: 14px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  color: #92400e;
  font-size: 0.92rem;
  font-weight: 750;
  box-shadow: 0 10px 26px rgba(146, 64, 14, 0.05);
`;

const SectionHint = styled.p`
  margin: -4px 0 12px;
  color: #64748b;
  font-size: 0.9rem;
  line-height: 1.45;
`;

const Section = styled.section`
  box-sizing: border-box;
  min-width: 0;
  background: #fff;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 16px 38px rgba(15, 23, 42, 0.055);

  h2 {
    margin: 0 0 16px;
    font-size: 1.02rem;
    color: #111827;
    letter-spacing: 0;
  }
`;

const ReadinessSummary = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;

  span {
    color: #334155;
    font-size: 0.92rem;
    font-weight: 800;
  }
`;

const PendingList = styled.ul`
  min-width: 0;
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    color: #475569;
    font-size: 0.9rem;
  }

  span {
    min-width: 0;
    overflow-wrap: anywhere;
  }
`;

const DomainSummary = styled.div`
  min-width: 0;
  display: grid;
  gap: 4px;
  margin-bottom: 12px;

  strong {
    color: #1f2937;
    overflow-wrap: anywhere;
  }

  span {
    color: #64748b;
    font-size: 0.88rem;
    font-weight: 700;
  }
`;

const BrandPreview = styled.div`
  box-sizing: border-box;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;

  strong {
    min-width: 0;
    display: block;
    color: #111827;
    font-size: 1rem;
    overflow-wrap: anywhere;
  }

  span {
    min-width: 0;
    color: #64748b;
    font-size: 0.86rem;
    font-weight: 700;
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const BrandMark = styled.span`
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: ${({ $color }) => $color};
  color: #fff;
  font-size: 0.92rem;
  font-weight: 900;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.12);
`;

const BrandSwatches = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  flex-wrap: wrap;
`;

const BrandEditorStack = styled.div`
  box-sizing: border-box;
  display: grid;
  gap: 18px;
  min-width: 0;
`;

const BrandGroup = styled.div`
  box-sizing: border-box;
  display: grid;
  gap: 14px;
  min-width: 0;
`;

const BrandGroupHeader = styled.div`
  min-width: 0;
  display: grid;
  gap: 4px;

  h2 {
    margin: 0;
    color: #111827;
    font-size: 1rem;
  }

  p {
    margin: 0;
    color: #64748b;
    font-size: 0.9rem;
    line-height: 1.45;
  }
`;

const BrandIdentityGrid = styled.div`
  box-sizing: border-box;
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) repeat(2, minmax(0, 1fr));
  gap: 14px;
  align-items: stretch;
  min-width: 0;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
`;

const BrandNameField = styled.label`
  box-sizing: border-box;
  display: grid;
  gap: 6px;
  min-width: 0;
  align-content: start;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 14px;
  background: #f8fafc;
  padding: 14px;

  span {
    color: #64748b;
    font-size: 0.74rem;
    font-weight: 800;
    text-transform: uppercase;
  }

  input {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    max-width: 420px;
    border: 1px solid rgba(148, 163, 184, 0.26);
    border-radius: 10px;
    background: #fff;
    color: #1f2937;
    font-size: 0.92rem;
    padding: 10px 11px;
  }
`;

const BrandImageCardShell = styled.div`
  box-sizing: border-box;
  display: grid;
  align-content: start;
  gap: 12px;
  min-width: 0;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 14px;
  background: #fff;
  padding: 14px;
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.035);
`;

const BrandImageHeader = styled.div`
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;

  strong {
    min-width: 0;
    overflow-wrap: anywhere;
    color: #111827;
    font-size: 0.95rem;
  }

  span {
    border-radius: 999px;
    background: #f1f5f9;
    color: #64748b;
    font-size: 0.72rem;
    font-weight: 800;
    padding: 4px 8px;
    white-space: nowrap;
  }
`;

const BrandPathField = styled.label`
  box-sizing: border-box;
  display: grid;
  gap: 5px;
  min-width: 0;

  span {
    color: #64748b;
    font-size: 0.74rem;
    font-weight: 800;
    text-transform: uppercase;
  }

  input {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    border: 1px solid rgba(148, 163, 184, 0.26);
    border-radius: 10px;
    background: #fff;
    color: #1f2937;
    font-size: 0.86rem;
    padding: 10px 11px;
  }
`;

const BrandColorGrid = styled.div`
  box-sizing: border-box;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  min-width: 0;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const BrandColorCardShell = styled.div`
  box-sizing: border-box;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  min-width: 0;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 14px;
  background: #fff;
  padding: 14px;
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.035);
`;

const BrandColorPreview = styled.span`
  box-sizing: border-box;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: ${({ $color }) => $color};
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.45);
`;

const BrandColorContent = styled.div`
  box-sizing: border-box;
  display: grid;
  gap: 8px;
  min-width: 0;

  strong {
    color: #111827;
    font-size: 0.9rem;
  }
`;

const BrandColorInputs = styled.div`
  box-sizing: border-box;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 40px;
  gap: 8px;
  align-items: center;

  input {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    border: 1px solid rgba(148, 163, 184, 0.26);
    border-radius: 10px;
    background: #fff;
    color: #1f2937;
    font-size: 0.88rem;
    padding: 9px 10px;
  }

  input[type="color"] {
    width: 40px;
    height: 38px;
    padding: 3px;
    cursor: pointer;
  }
`;

const BrandSaveBar = styled.div`
  box-sizing: border-box;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  border-top: 1px solid rgba(148, 163, 184, 0.18);
  padding-top: 16px;
`;

const Form = styled.form`
  box-sizing: border-box;
  display: grid;
  gap: 14px;
  min-width: 0;
`;

const VerticalFields = styled.div`
  box-sizing: border-box;
  display: grid;
  gap: 12px;
  min-width: 0;
`;

const ColorControl = styled.div`
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) 34px;
  align-items: center;
  gap: 8px;

  input[type="color"] {
    width: 46px;
    height: 40px;
    padding: 3px;
    cursor: pointer;
  }
`;

const ColorPreview = styled.span`
  box-sizing: border-box;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: ${({ $color }) => $color};
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.45);
`;

const FieldHint = styled.small`
  color: ${({ $tone }) => ($tone === "error" ? "#b91c1c" : "#64748b")};
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1.35;
`;

const UploadNotice = styled.div`
  box-sizing: border-box;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;

  button {
    max-width: 100%;
    border: 1px solid rgba(148, 163, 184, 0.22);
    border-radius: 10px;
    color: #94a3b8;
    background: #f8fafc;
    font-size: 0.82rem;
    font-weight: 800;
    padding: 7px 9px;
  }

  small {
    color: #64748b;
    font-size: 0.78rem;
    font-weight: 700;
  }
`;

const EditorBlock = styled.div`
  box-sizing: border-box;
  display: grid;
  gap: 10px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 14px;
  padding: 14px;
  background: #f8fafc;
  min-width: 0;
`;

const EditorHeader = styled.div`
  min-width: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;

  span {
    color: #64748b;
    font-size: 0.74rem;
    font-weight: 800;
    text-transform: uppercase;
  }
`;

const EditorButton = styled.button`
  box-sizing: border-box;
  max-width: 100%;
  border: 1px solid rgba(37, 99, 235, 0.22);
  border-radius: 10px;
  background: #fff;
  color: #2563eb;
  cursor: pointer;
  font-size: 0.84rem;
  font-weight: 800;
  padding: 8px 10px;
`;

const ListEditorRow = styled.div`
  box-sizing: border-box;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;

  input {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    border: 1px solid rgba(148, 163, 184, 0.26);
    border-radius: 10px;
    padding: 10px 11px;
    color: #1f2937;
    font-size: 0.92rem;
    background: #fff;
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const ServiceRow = styled.div`
  box-sizing: border-box;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1.4fr) minmax(0, 0.8fr) auto;
  gap: 10px;
  align-items: end;
  border-top: 1px solid rgba(148, 163, 184, 0.18);
  padding-top: 12px;

  @media (max-width: 960px) {
    grid-template-columns: 1fr;
    align-items: stretch;
  }
`;

const RemoveButton = styled.button`
  box-sizing: border-box;
  max-width: 100%;
  border: 1px solid rgba(185, 28, 28, 0.2);
  border-radius: 10px;
  background: #fff;
  color: #b91c1c;
  cursor: pointer;
  font-size: 0.84rem;
  font-weight: 800;
  padding: 9px 10px;
`;

const PreviewToolbar = styled.div`
  box-sizing: border-box;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
`;

const PreviewButton = styled.button`
  box-sizing: border-box;
  max-width: 100%;
  border: 1px solid rgba(37, 99, 235, 0.22);
  border-radius: 10px;
  background: #fff;
  color: #2563eb;
  cursor: pointer;
  font-size: 0.88rem;
  font-weight: 800;
  padding: 8px 11px;
`;

const PreviewBox = styled.div`
  box-sizing: border-box;
  display: grid;
  gap: 14px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 16px;
  padding: 16px;
  background: #f8fafc;
`;

const PreviewHeader = styled.div`
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;

  strong {
    color: #111827;
  }

  span {
    color: #64748b;
    font-size: 0.82rem;
    font-weight: 800;
  }
`;

const PreviewHero = styled.div`
  box-sizing: border-box;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(180px, 280px);
  gap: 14px;

  h3 {
    margin: 0 0 6px;
    color: #111827;
    font-size: 1.25rem;
  }

  p,
  blockquote {
    margin: 0 0 8px;
    color: #475569;
    line-height: 1.45;
  }

  blockquote {
    font-weight: 700;
  }

  small {
    color: #64748b;
    font-weight: 800;
  }

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

const PreviewImage = styled.div`
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  border: 1px dashed rgba(37, 99, 235, 0.24);
  border-radius: 14px;
  color: #64748b;
  font-size: 0.82rem;
  font-weight: 700;
  overflow-wrap: anywhere;
  padding: 12px;
`;

const PreviewSection = styled.div`
  min-width: 0;
  display: grid;
  gap: 5px;

  h4,
  p {
    margin: 0;
  }

  h4 {
    color: #111827;
  }

  p,
  small {
    color: #64748b;
    line-height: 1.45;
  }
`;

const PreviewServices = styled.ul`
  box-sizing: border-box;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    min-width: 0;
    display: grid;
    gap: 4px;
    border: 1px solid rgba(148, 163, 184, 0.18);
    border-radius: 12px;
    background: #fff;
    padding: 10px;
  }

  strong {
    color: #111827;
  }

  span {
    color: #64748b;
    font-size: 0.84rem;
  }
`;

const Field = styled.label`
  box-sizing: border-box;
  display: grid;
  gap: 6px;
  min-width: 0;

  span {
    color: #64748b;
    font-size: 0.74rem;
    font-weight: 800;
    text-transform: uppercase;
  }

  input,
  textarea {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    border: 1px solid rgba(148, 163, 184, 0.26);
    border-radius: 10px;
    padding: 10px 11px;
    color: #1f2937;
    font-size: 0.92rem;
    background: #fff;
    transition: border-color 0.14s ease, box-shadow 0.14s ease;
  }

  input:focus,
  textarea:focus {
    outline: none;
    border-color: rgba(37, 99, 235, 0.48);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
  }

  textarea {
    resize: vertical;
  }
`;

const WideField = styled(Field)`
  width: 100%;
`;

const CheckboxRow = styled.label`
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #1f2937;
  font-size: 0.94rem;
  font-weight: 700;

  input {
    width: 18px;
    height: 18px;
  }
`;

const ButtonRow = styled.div`
  box-sizing: border-box;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
`;

const SaveButton = styled.button`
  box-sizing: border-box;
  max-width: 100%;
  border: none;
  border-radius: 10px;
  background: #2563eb;
  color: #fff;
  cursor: pointer;
  font-size: 0.92rem;
  font-weight: 800;
  padding: 10px 15px;
  box-shadow: 0 10px 22px rgba(37, 99, 235, 0.18);

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

const Feedback = styled.span`
  color: ${({ $tone }) => ($tone === "success" ? "#166534" : "#b91c1c")};
  font-size: 0.9rem;
  font-weight: 800;
`;

const Grid = styled.div`
  box-sizing: border-box;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
  min-width: 0;
`;

const InfoItem = styled.div`
  display: grid;
  gap: 4px;
  min-width: 0;

  span {
    color: #64748b;
    font-size: 0.74rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  strong {
    min-width: 0;
    overflow-wrap: anywhere;
    color: #1f2937;
    font-size: 0.92rem;
  }
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  width: fit-content;
  border-radius: 999px;
  padding: 5px 9px;
  font-size: 0.74rem;
  font-weight: 800;
  color: ${({ $tone }) => {
    if ($tone === "pass") return "#1f6b3a";
    if ($tone === "warn") return "#875b00";
    if ($tone === "fail") return "#9a2f2f";
    return "#53605a";
  }};
  background: ${({ $tone }) => {
    if ($tone === "pass") return "#e6f4ea";
    if ($tone === "warn") return "#fff2cc";
    if ($tone === "fail") return "#fbe4e4";
    return "#eef1ef";
  }};
`;

const List = styled.ul`
  box-sizing: border-box;
  display: grid;
  gap: 9px;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    min-width: 0;
    display: grid;
    gap: 3px;
    padding: 11px 0;
    border-bottom: 1px solid rgba(148, 163, 184, 0.16);
  }

  li:last-child {
    border-bottom: none;
  }

  span {
    color: #64748b;
    font-size: 0.86rem;
    overflow-wrap: anywhere;
  }

  strong {
    min-width: 0;
    overflow-wrap: anywhere;
  }
`;

const Checks = styled.ul`
  box-sizing: border-box;
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 9px;
    color: #334155;
  }

  span {
    min-width: 0;
    overflow-wrap: anywhere;
  }
`;
