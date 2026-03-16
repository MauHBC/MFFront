import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import styled from "styled-components";
import { toast } from "react-toastify";

import axios from "../../services/axios";
import Loading from "../../components/Loading";

const clean = (value) => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
};

export default function PatientSelfSignup() {
  const { token } = useParams();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [inviteInfo, setInviteInfo] = useState(null);
  const [inviteError, setInviteError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    referral_source: "",
    sex: "",
    birth_date: "",
    cpf: "",
    rg: "",
    profession: "",
    marital_status: "",
    instagram: "",
    emergency_contact_name: "",
    emergency_contact_relationship: "",
    emergency_contact_phone: "",
    main_complaint: "",
    relevant_conditions: "",
    treatment_goal: "",
    contact_via_phone: false,
    contact_via_whatsapp: false,
    contact_via_email: false,
    consent_data_processing: false,
    consent_image_use: false,
    consent_info_truth: false,
    address_street: "",
    address_number: "",
    address_complement: "",
    address_neighborhood: "",
    address_city: "",
    address_state: "",
    address_zip: "",
  });

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setInviteError("");
    axios
      .get(`/public/patient-invites/${token}`)
      .then((response) => {
        if (!active) return;
        setInviteInfo(response.data);
      })
      .catch((error) => {
        if (!active) return;
        setInviteError(
          error?.response?.data?.error || "Convite invalido ou expirado.",
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const handleChange = useCallback((event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }, []);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();

      const name = form.full_name.trim();
      if (name.length < 3) {
        toast.error("Informe o nome completo.");
        return;
      }
      if (!form.consent_data_processing || !form.consent_info_truth) {
        toast.error("Confirme os consentimentos obrigatorios.");
        return;
      }

      const sex = clean(form.sex);
      const payload = {
        full_name: name,
        email: clean(form.email),
        phone: clean(form.phone),
        referral_source: clean(form.referral_source),
        sex: sex ? sex.toUpperCase() : null,
        birth_date: clean(form.birth_date),
        cpf: clean(form.cpf),
        rg: clean(form.rg),
        profession: clean(form.profession),
        marital_status: clean(form.marital_status),
        instagram: clean(form.instagram),
        emergency_contact_name: clean(form.emergency_contact_name),
        emergency_contact_relationship: clean(form.emergency_contact_relationship),
        emergency_contact_phone: clean(form.emergency_contact_phone),
        main_complaint: clean(form.main_complaint),
        relevant_conditions: clean(form.relevant_conditions),
        treatment_goal: clean(form.treatment_goal),
        contact_via_phone: form.contact_via_phone,
        contact_via_whatsapp: form.contact_via_whatsapp,
        contact_via_email: form.contact_via_email,
        consent_data_processing: form.consent_data_processing,
        consent_image_use: form.consent_image_use,
        consent_info_truth: form.consent_info_truth,
        address_street: clean(form.address_street),
        address_number: clean(form.address_number),
        address_complement: clean(form.address_complement),
        address_neighborhood: clean(form.address_neighborhood),
        address_city: clean(form.address_city),
        address_state: clean(form.address_state)
          ? clean(form.address_state).toUpperCase()
          : null,
        address_zip: clean(form.address_zip),
      };

      setIsSaving(true);
      try {
        await axios.post(`/public/patient-intake/${token}`, payload);
        setSubmitted(true);
      } catch (error) {
        const message =
          error?.response?.data?.error ||
          "Nao foi possivel enviar o cadastro.";
        toast.error(message);
      } finally {
        setIsSaving(false);
      }
    },
    [form, token],
  );

  if (isLoading) {
    return (
      <Wrapper>
        <Card>
          <Loading isLoading />
        </Card>
      </Wrapper>
    );
  }

  if (inviteError) {
    return (
      <Wrapper>
        <Card>
          <Title>Cadastro do paciente</Title>
          <ErrorText>{inviteError}</ErrorText>
        </Card>
      </Wrapper>
    );
  }

  if (submitted) {
    return (
      <Wrapper>
        <Card>
          <Title>Cadastro enviado</Title>
          <SuccessText>
            Obrigado! Seu cadastro foi recebido. A equipe entrara em contato.
          </SuccessText>
        </Card>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <Card>
        <Header>
          <Title>Cadastro do paciente</Title>
          <Subtitle>
            {inviteInfo?.clinic?.name
              ? `Clinica: ${inviteInfo.clinic.name}`
              : "Preencha seus dados para iniciar o atendimento."}
          </Subtitle>
        </Header>

        <Loading isLoading={isSaving} />

        <Form onSubmit={handleSubmit}>
          <SectionTitle>Dados pessoais</SectionTitle>
          <FormGrid>
            <Field>
              Nome completo *
              <input
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                placeholder="Nome completo"
                autoComplete="off"
                required
              />
            </Field>
            <Field>
              CPF
              <input
                name="cpf"
                value={form.cpf}
                onChange={handleChange}
                placeholder="000.000.000-00"
              />
            </Field>
            <Field>
              RG
              <input
                name="rg"
                value={form.rg}
                onChange={handleChange}
                placeholder="RG"
              />
            </Field>
            <Field>
              Data de nascimento
              <input
                type="date"
                name="birth_date"
                value={form.birth_date}
                onChange={handleChange}
              />
            </Field>
            <Field>
              Sexo
              <select name="sex" value={form.sex} onChange={handleChange}>
                <option value="">Selecionar</option>
                <option value="F">Feminino</option>
                <option value="M">Masculino</option>
              </select>
            </Field>
            <Field>
              Estado civil
              <select
                name="marital_status"
                value={form.marital_status}
                onChange={handleChange}
              >
                <option value="">Selecionar</option>
                <option value="Solteiro(a)">Solteiro(a)</option>
                <option value="Casado(a)">Casado(a)</option>
                <option value="Uniao estavel">Uniao estavel</option>
                <option value="Divorciado(a)">Divorciado(a)</option>
                <option value="Viuvo(a)">Viuvo(a)</option>
                <option value="Outro">Outro</option>
              </select>
            </Field>
            <Field>
              Profissao
              <input
                name="profession"
                value={form.profession}
                onChange={handleChange}
                placeholder="Profissao"
              />
            </Field>
          </FormGrid>

          <SectionTitle>Contato</SectionTitle>
          <FormGrid>
            <Field>
              Email
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="email@exemplo.com"
                autoComplete="off"
              />
            </Field>
            <Field>
              Telefone
              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="(00) 00000-0000"
              />
            </Field>
            <Field>
              Instagram
              <input
                name="instagram"
                value={form.instagram}
                onChange={handleChange}
                placeholder="@perfil"
              />
            </Field>
            <Field>
              Como conheceu a clinica
              <select
                name="referral_source"
                value={form.referral_source}
                onChange={handleChange}
              >
                <option value="">Selecionar</option>
                <option value="Instagram">Instagram</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Medico">Medico</option>
                <option value="Amigo">Amigo</option>
                <option value="Outro">Outro</option>
              </select>
            </Field>
          </FormGrid>

          <SectionTitle>Preferencias de contato</SectionTitle>
          <CheckboxGroup>
            <CheckboxField>
              <input
                type="checkbox"
                name="contact_via_whatsapp"
                checked={form.contact_via_whatsapp}
                onChange={handleChange}
              />
              <div>WhatsApp</div>
            </CheckboxField>
            <CheckboxField>
              <input
                type="checkbox"
                name="contact_via_phone"
                checked={form.contact_via_phone}
                onChange={handleChange}
              />
              <div>Telefone</div>
            </CheckboxField>
            <CheckboxField>
              <input
                type="checkbox"
                name="contact_via_email"
                checked={form.contact_via_email}
                onChange={handleChange}
              />
              <div>Email</div>
            </CheckboxField>
          </CheckboxGroup>

          <SectionTitle>Endereco</SectionTitle>
          <FormGrid>
            <Field>
              Rua
              <input
                name="address_street"
                value={form.address_street}
                onChange={handleChange}
              />
            </Field>
            <Field>
              Numero
              <input
                name="address_number"
                value={form.address_number}
                onChange={handleChange}
              />
            </Field>
            <Field>
              Complemento
              <input
                name="address_complement"
                value={form.address_complement}
                onChange={handleChange}
              />
            </Field>
            <Field>
              Bairro
              <input
                name="address_neighborhood"
                value={form.address_neighborhood}
                onChange={handleChange}
              />
            </Field>
            <Field>
              Cidade
              <input
                name="address_city"
                value={form.address_city}
                onChange={handleChange}
              />
            </Field>
            <Field>
              UF
              <input
                name="address_state"
                value={form.address_state}
                onChange={handleChange}
                maxLength={2}
              />
            </Field>
            <Field>
              CEP
              <input
                name="address_zip"
                value={form.address_zip}
                onChange={handleChange}
              />
            </Field>
          </FormGrid>

          <SectionTitle>Contato de emergencia</SectionTitle>
          <FormGrid>
            <Field>
              Nome completo
              <input
                name="emergency_contact_name"
                value={form.emergency_contact_name}
                onChange={handleChange}
                placeholder="Nome do contato"
              />
            </Field>
            <Field>
              Grau de parentesco
              <input
                name="emergency_contact_relationship"
                value={form.emergency_contact_relationship}
                onChange={handleChange}
                placeholder="Ex.: Mae, Pai, Conjuge"
              />
            </Field>
            <Field>
              Telefone
              <input
                name="emergency_contact_phone"
                value={form.emergency_contact_phone}
                onChange={handleChange}
                placeholder="(00) 00000-0000"
              />
            </Field>
          </FormGrid>

          <SectionTitle>Informacoes clinicas</SectionTitle>
          <FormGrid>
            <Field className="span-2">
              Queixa principal
              <textarea
                name="main_complaint"
                value={form.main_complaint}
                onChange={handleChange}
                rows={3}
              />
            </Field>
            <Field className="span-2">
              Doencas ou condicoes relevantes
              <textarea
                name="relevant_conditions"
                value={form.relevant_conditions}
                onChange={handleChange}
                rows={3}
              />
            </Field>
            <Field className="span-2">
              Objetivo do tratamento
              <textarea
                name="treatment_goal"
                value={form.treatment_goal}
                onChange={handleChange}
                rows={3}
              />
            </Field>
          </FormGrid>

          <SectionTitle>Consentimentos</SectionTitle>
          <CheckboxGroup>
            <CheckboxField>
              <input
                type="checkbox"
                name="consent_data_processing"
                checked={form.consent_data_processing}
                onChange={handleChange}
                required
              />
              <div>
                Autorizo a coleta e uso dos meus dados (LGPD). *
                <small>
                  Dados usados apenas para atendimento, registro clinico e
                  obrigacoes legais.
                </small>
              </div>
            </CheckboxField>
            <CheckboxField>
              <input
                type="checkbox"
                name="consent_image_use"
                checked={form.consent_image_use}
                onChange={handleChange}
              />
              <div>Autorizo uso de imagem/voz/depoimento para comunicacao.</div>
            </CheckboxField>
            <CheckboxField>
              <input
                type="checkbox"
                name="consent_info_truth"
                checked={form.consent_info_truth}
                onChange={handleChange}
                required
              />
              <div>Declaro que as informacoes fornecidas sao verdadeiras. *</div>
            </CheckboxField>
          </CheckboxGroup>

          <Actions>
            <SubmitButton type="submit" disabled={isSaving}>
              {isSaving ? "Enviando..." : "Enviar cadastro"}
            </SubmitButton>
          </Actions>
        </Form>
      </Card>
    </Wrapper>
  );
}

const Wrapper = styled.section`
  min-height: 100vh;
  background: radial-gradient(circle at top, #f3f7ef 0%, #f7f8f4 60%, #eef2e7 100%);
  padding: 60px 0;
`;

const Card = styled.div`
  width: min(920px, 92vw);
  margin: 0 auto;
  background: #fff;
  border-radius: 18px;
  padding: 28px;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(106, 121, 92, 0.18);
`;

const Header = styled.div`
  margin-bottom: 24px;
`;

const Title = styled.h1`
  color: #1b1b1b;
  margin-bottom: 6px;
  font-size: 1.8rem;
`;

const Subtitle = styled.p`
  color: #6a795c;
`;

const ErrorText = styled.p`
  color: #b84b4b;
  font-size: 1rem;
`;

const SuccessText = styled.p`
  color: #4b6a3d;
  font-size: 1rem;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 22px;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;

  .span-2 {
    grid-column: span 2;
  }
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.95rem;
  color: #1b1b1b;

  input,
  select,
  textarea {
    height: 42px;
    border-radius: 10px;
    border: 1px solid rgba(106, 121, 92, 0.2);
    padding: 0 12px;
    font-size: 0.95rem;
    color: #1b1b1b;
  }

  textarea {
    height: auto;
    padding: 10px 12px;
    resize: vertical;
  }
`;

const SectionTitle = styled.h2`
  font-size: 1.05rem;
  color: #6a795c;
  margin: 6px 0 0;
`;

const Actions = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: flex-end;
`;

const SubmitButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 20px;
  border-radius: 10px;
  border: none;
  background: #6a795c;
  color: #fff;
  font-weight: 700;
  transition: filter 0.2s ease;

  &:hover:not(:disabled) {
    filter: brightness(0.95);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const CheckboxGroup = styled.div`
  display: grid;
  gap: 12px;
`;

const CheckboxField = styled.label`
  display: flex;
  gap: 10px;
  align-items: flex-start;
  font-size: 0.95rem;
  color: #1b1b1b;

  input {
    margin-top: 3px;
    accent-color: #6a795c;
  }

  small {
    display: block;
    color: #6a795c;
    font-size: 0.8rem;
    margin-top: 4px;
  }
`;
