import React, { useCallback, useState } from "react";
import { Link, useHistory } from "react-router-dom";
import styled from "styled-components";
import { toast } from "react-toastify";

import axios from "../../services/axios";
import Loading from "../../components/Loading";

const clean = (value) => {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
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
    address_street: "",
    address_number: "",
    address_complement: "",
    address_neighborhood: "",
    address_city: "",
    address_state: "",
    address_zip: "",
  });

  const handleChange = useCallback((event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();

      const name = form.full_name.trim();
      if (name.length < 3) {
        toast.error("Informe o nome completo do paciente.");
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

  return (
    <Wrapper>
      <Content>
        <Header>
          <h1 className="font40 extraBold">Novo paciente</h1>
          <p className="font15">Cadastre os dados principais do paciente.</p>
        </Header>

        <Card>
          <Loading isLoading={isSaving} />
          <Form onSubmit={handleSubmit}>
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
              <Field>
                Sexo
                <select name="sex" value={form.sex} onChange={handleChange}>
                  <option value="">Selecionar</option>
                  <option value="F">Feminino</option>
                  <option value="M">Masculino</option>
                </select>
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
            </FormGrid>

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
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.95rem;
  color: #1b1b1b;

  input,
  select {
    height: 42px;
    border-radius: 10px;
    border: 1px solid rgba(106, 121, 92, 0.2);
    padding: 0 12px;
    font-size: 0.95rem;
    color: #1b1b1b;
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
