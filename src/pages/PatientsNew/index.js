import React, { useCallback, useState } from "react";
import { Link, useHistory } from "react-router-dom";
import styled from "styled-components";
import { toast } from "react-toastify";

import axios from "../../services/axios";
import Loading from "../../components/Loading";
import {
  formatBirthDateForApi,
  isBirthDateFilled,
  isBirthDateValid,
  maskBirthDateInput,
} from "../../utils/birthDate";

const clean = (value) => {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const TREATMENT_GOAL_OPTIONS = [
  { value: "reduce_pain", label: "Reduzir dor" },
  { value: "recover_movement", label: "Recuperar movimento" },
  { value: "rehabilitation", label: "Reabilitacao" },
  { value: "strength_flex_mob", label: "Forca/Flex/Mob" },
];

const buildTreatmentGoalPayload = (selectedValues = [], otherText = "") => {
  const labels = TREATMENT_GOAL_OPTIONS
    .filter((option) => selectedValues.includes(option.value))
    .map((option) => option.label);
  const other = clean(otherText || "");
  if (other) labels.push(`Outro: ${other}`);
  return labels.length ? labels.join(" | ") : null;
};

export default function PatientsNew() {
  const history = useHistory();
  const [isSaving, setIsSaving] = useState(false);
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
    treatment_goal_options: [],
    treatment_goal_other: "",
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

  const handleChange = useCallback((event) => {
    const { name, value, type, checked } = event.target;
    let nextValue = value;

    if (type === "checkbox") {
      nextValue = checked;
    } else if (name === "birth_date") {
      nextValue = maskBirthDateInput(value);
    }

    setForm((prev) => ({
      ...prev,
      [name]: nextValue,
    }));
  }, []);

  const handleTreatmentGoalToggle = useCallback((goalValue) => {
    setForm((prev) => {
      const hasValue = prev.treatment_goal_options.includes(goalValue);
      const nextGoals = hasValue
        ? prev.treatment_goal_options.filter((value) => value !== goalValue)
        : [...prev.treatment_goal_options, goalValue];
      return {
        ...prev,
        treatment_goal_options: nextGoals,
      };
    });
  }, []);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();

      const name = form.full_name.trim();
      if (name.length < 3) {
        toast.error("Informe o nome completo do paciente.");
        return;
      }

      if (isBirthDateFilled(form.birth_date) && !isBirthDateValid(form.birth_date)) {
        toast.error(
          "Data de nascimento invalida, coloque 4 digitos.",
        );
        return;
      }

      const hasTreatmentGoalOther = form.treatment_goal_options.includes("other");
      const treatmentGoalOther = clean(form.treatment_goal_other || "");
      if (hasTreatmentGoalOther && !treatmentGoalOther) {
        toast.error("Preencha o campo 'Outro' em objetivo do tratamento.");
        return;
      }

      const sex = clean(form.sex);
      const treatmentGoal = buildTreatmentGoalPayload(
        form.treatment_goal_options,
        form.treatment_goal_other,
      );
      const payload = {
        full_name: name,
        email: clean(form.email),
        phone: clean(form.phone),
        referral_source: clean(form.referral_source),
        sex: sex ? sex.toUpperCase() : null,
        birth_date: formatBirthDateForApi(form.birth_date),
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
        treatment_goal: treatmentGoal,
        treatment_goal_options: form.treatment_goal_options.length
          ? form.treatment_goal_options
          : null,
        treatment_goal_other: hasTreatmentGoalOther ? treatmentGoalOther : null,
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
        await axios.post("/patients", payload);
        toast.success("Paciente cadastrado com sucesso.");
        history.push("/pacientes/consultar");
      } catch (error) {
        const message =
          error?.response?.data?.error ||
          "Nao foi possivel salvar o paciente.";
        toast.error(message);
      } finally {
        setIsSaving(false);
      }
    },
    [form, history],
  );

  const isTreatmentGoalOtherSelected = form.treatment_goal_options.includes("other");

  return (
    <Wrapper>
      <Content>
        <Header>
          <h1 className="font40 extraBold">Novo paciente</h1>
          <p className="font15">Cadastre os dados do paciente manualmente.</p>
        </Header>

        <Card>
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
                  placeholder="Nome do paciente"
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
                  autoComplete="off"
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
                  type="text"
                  name="birth_date"
                  value={form.birth_date}
                  onChange={handleChange}
                  placeholder="dd/mm/aaaa"
                  inputMode="numeric"
                  maxLength={10}
                  autoComplete="bday"
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
                Profissão
                <input
                  name="profession"
                  value={form.profession}
                  onChange={handleChange}
                  placeholder="Profissão"
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

            <SectionTitle>Preferências de contato</SectionTitle>
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

            <SectionTitle>Endereço</SectionTitle>
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
                Número
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

            <SectionTitle>informações clinicas</SectionTitle>
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
                Doenças ou condições relevantes
                <textarea
                  name="relevant_conditions"
                  value={form.relevant_conditions}
                  onChange={handleChange}
                  placeholder="Ex.: Hipertensão, diabetes, cardiopatia, labirintite etc."
                  rows={3}
                />
              </Field>
              <TreatmentGoalField className="span-2">
                <TreatmentGoalLabel>Objetivo do tratamento</TreatmentGoalLabel>
                <TreatmentGoalOptions>
                  {TREATMENT_GOAL_OPTIONS.map((goal) => (
                    <TreatmentGoalOption key={goal.value}>
                      <input
                        type="checkbox"
                        checked={form.treatment_goal_options.includes(goal.value)}
                        onChange={() => handleTreatmentGoalToggle(goal.value)}
                      />
                      <span>{goal.label}</span>
                    </TreatmentGoalOption>
                  ))}
                  <TreatmentGoalOption>
                    <input
                      type="checkbox"
                      checked={isTreatmentGoalOtherSelected}
                      onChange={() => handleTreatmentGoalToggle("other")}
                    />
                    <span>Outro:</span>
                    {isTreatmentGoalOtherSelected && (
                      <TreatmentGoalOtherInput
                        name="treatment_goal_other"
                        value={form.treatment_goal_other}
                        onChange={handleChange}
                        placeholder="Descreva"
                      />
                    )}
                  </TreatmentGoalOption>
                </TreatmentGoalOptions>
              </TreatmentGoalField>
            </FormGrid>

            <SectionTitle>Consentimentos</SectionTitle>
            <CheckboxGroup>
              <CheckboxField>
                <input
                  type="checkbox"
                  name="consent_data_processing"
                  checked={form.consent_data_processing}
                  onChange={handleChange}
                />
                <div>
                  Autorizo a coleta e uso dos meus dados (LGPD).
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
                <div>
                  Autorizo uso de imagem/voz/depoimento para comunicação.
                </div>
              </CheckboxField>
              <CheckboxField>
                <input
                  type="checkbox"
                  name="consent_info_truth"
                  checked={form.consent_info_truth}
                  onChange={handleChange}
                />
                <div>
                  Declaro que as informações fornecidas sao verdadeiras.
                </div>
              </CheckboxField>
            </CheckboxGroup>

            <Actions>
              <BackLink to="/pacientes">Voltar</BackLink>
              <SubmitButton type="submit" disabled={isSaving}>
                {isSaving ? "Salvando..." : "Salvar paciente"}
              </SubmitButton>
            </Actions>
          </Form>
        </Card>
      </Content>
    </Wrapper>
  );
}

const Wrapper = styled.section`
  min-height: 100vh;
  background: #f7f8f4;
  padding: 90px 0 60px;
`;

const Content = styled.div`
  width: 100%;
  max-width: 1220px;
  margin: 0 auto;
  padding: 0 30px;
  @media only screen and (max-width: 859px) {
    padding: 0 15px;
  }
`;

const Header = styled.div`
  margin-bottom: 24px;
  h1 {
    color: #1b1b1b;
    margin-bottom: 6px;
  }
  p {
    color: #6a795c;
  }
`;

const Card = styled.div`
  width: 100%;
  background: #fff;
  border-radius: 18px;
  padding: 32px;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(106, 121, 92, 0.18);
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

const TreatmentGoalField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const TreatmentGoalLabel = styled.div`
  font-size: 0.95rem;
  color: #1b1b1b;
`;

const TreatmentGoalOptions = styled.div`
  display: grid;
  gap: 10px;
`;

const TreatmentGoalOption = styled.label`
  display: flex;
  align-items: center;
  gap: 10px;
  color: #1b1b1b;
  font-size: 0.95rem;

  input[type="checkbox"] {
    width: 18px;
    height: 18px;
    margin: 0;
    accent-color: #6a795c;
    flex-shrink: 0;
  }
`;

const TreatmentGoalOtherInput = styled.input`
  flex: 1;
  min-width: 180px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid rgba(106, 121, 92, 0.2);
  padding: 0 12px;
  font-size: 0.95rem;
  color: #1b1b1b;
`;

const Actions = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
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

const BackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 18px;
  border-radius: 10px;
  background: #fff;
  color: #6a795c;
  text-decoration: none;
  font-weight: 600;
  border: 1px solid rgba(106, 121, 92, 0.3);
`;

const SubmitButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 18px;
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
