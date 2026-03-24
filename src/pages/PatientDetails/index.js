import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import styled from "styled-components";
import { toast } from "react-toastify";
import { FaInfoCircle, FaListAlt, FaUserAlt, FaPhoneAlt } from "react-icons/fa";

import axios from "../../services/axios";
import Loading from "../../components/Loading";

const TABS = {
  resumo: "resumo",
  historico: "historico",
  dados: "dados",
};

const TREATMENT_GOAL_LABELS = {
  reduce_pain: "Reduzir dor",
  recover_movement: "Recuperar movimento",
  rehabilitation: "Reabilitacao",
  strength_flex_mob: "Forca/Flex/Mob",
  other: "Outro",
};

function valueOrDash(value) {
  if (value === null || value === undefined) return "-";
  const normalized = String(value).trim();
  return normalized.length ? normalized : "-";
}

function formatDate(value) {
  if (!value) return "--/--/----";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--/--/----";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatDateTime(value) {
  if (!value) return "--/--/---- --:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--/--/---- --:--";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBoolean(value) {
  if (value === true) return "Sim";
  if (value === false) return "Nao";
  return "-";
}

function calcAge(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  let years = now.getFullYear() - date.getFullYear();
  const hadBirthday =
    now.getMonth() > date.getMonth() ||
    (now.getMonth() === date.getMonth() && now.getDate() >= date.getDate());
  if (!hadBirthday) years -= 1;
  return years < 0 ? 0 : years;
}

function resolveAddress(patient) {
  if (!patient) return "";
  const direct = patient.address || patient.endereco || "";
  if (direct) return direct;

  const street = patient.address_street || "";
  const number = patient.address_number || "";
  const complement = patient.address_complement || "";
  const neighborhood = patient.address_neighborhood || "";
  const city = patient.address_city || "";
  const state = patient.address_state || "";
  const zip = patient.address_zip || "";

  let line1 = street;
  if (number) line1 = line1 ? `${line1}, ${number}` : number;
  if (complement) line1 = line1 ? `${line1} ${complement}` : complement;

  const parts = [];
  if (line1) parts.push(line1);
  if (neighborhood) parts.push(neighborhood);

  const cityState = [city, state].filter(Boolean).join(" - ");
  if (cityState) parts.push(cityState);
  if (zip) parts.push(`CEP ${zip}`);

  return parts.join(", ");
}

export default function PatientDetails() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState(TABS.resumo);
  const [isLoading, setIsLoading] = useState(false);
  const [patient, setPatient] = useState(null);
  const [evaluations, setEvaluations] = useState([]);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [patientResponse, evalResponse] = await Promise.all([
          axios.get(`/patients/${id}`),
          axios.get(`/evaluations?patient_id=${id}`),
        ]);
        setPatient(patientResponse.data);
        setEvaluations(Array.isArray(evalResponse.data) ? evalResponse.data : []);
      } catch (error) {
        const message =
          error?.response?.data?.error ||
          "Nao foi possivel carregar os dados do paciente.";
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    }

    if (id) {
      loadData();
    }
  }, [id]);

  const latestEval = evaluations[0] || null;
  const summaryText =
    latestEval?.summary_text || latestEval?.summaryText || "";
  const planText = latestEval?.plan_text || latestEval?.planText || "";
  const lastNote = summaryText || planText || "Nenhum registro encontrado.";
  const lastDate = latestEval ? formatDate(latestEval.created_at || latestEval.createdAt) : "--/--/----";

  const age = useMemo(
    () => (patient ? calcAge(patient.birth_date || patient.birthDate) : null),
    [patient],
  );

  const address = useMemo(() => resolveAddress(patient || {}), [patient]);
  const createdAtLabel = useMemo(
    () => formatDateTime(patient?.created_at || patient?.createdAt),
    [patient],
  );
  const treatmentGoalDisplay = useMemo(() => {
    if (!patient) return "-";
    const goalOptions = Array.isArray(patient.treatment_goal_options)
      ? patient.treatment_goal_options
      : [];

    const labels = goalOptions
      .filter((item) => item !== "other")
      .map((item) => TREATMENT_GOAL_LABELS[item] || item);

    if (goalOptions.includes("other")) {
      if (patient.treatment_goal_other) {
        labels.push(`Outro: ${patient.treatment_goal_other}`);
      } else {
        labels.push("Outro");
      }
    }

    if (labels.length) return labels.join(" | ");
    return valueOrDash(patient.treatment_goal);
  }, [patient]);

  const showResumo = useCallback(() => setActiveTab(TABS.resumo), []);
  const showHistorico = useCallback(() => setActiveTab(TABS.historico), []);
  const showDados = useCallback(() => setActiveTab(TABS.dados), []);

  return (
    <Wrapper>
      <Content>
        <Header>
          <div>
            <h1 className="font40 extraBold">
              {patient?.full_name || patient?.name || "Paciente"}
            </h1>
            <p className="font15">Detalhes do paciente</p>
          </div>
          <HeaderActions>
            <AddLink to={`/pacientes/${id}/avaliacoes/nova`}>
              Adicionar registro
            </AddLink>
            <BackLink to="/pacientes/consultar">Voltar</BackLink>
          </HeaderActions>
        </Header>

        <Tabs>
          <TabButton
            type="button"
            onClick={showResumo}
            $active={activeTab === TABS.resumo}
          >
            Resumo
          </TabButton>
          <TabButton
            type="button"
            onClick={showHistorico}
            $active={activeTab === TABS.historico}
          >
            Historico
          </TabButton>
          <TabButton
            type="button"
            onClick={showDados}
            $active={activeTab === TABS.dados}
          >
            Dados
          </TabButton>
        </Tabs>

        <Loading isLoading={isLoading} />

        {!isLoading && activeTab === TABS.resumo && (
          <Section>
            <InfoCard>
              <CardTitle>
                <FaInfoCircle /> Resumo clinico
              </CardTitle>
              <CardText>
                {summaryText || "Sem resumo clinico."}
              </CardText>
            </InfoCard>
            <InfoCard>
              <CardTitle>
                <FaListAlt /> Ultimo registro
              </CardTitle>
              <CardText>
                {lastDate} - {lastNote}
              </CardText>
            </InfoCard>
          </Section>
        )}

        {!isLoading && activeTab === TABS.historico && (
          <Section>
            {evaluations.length === 0 && (
              <EmptyState>Nenhuma avaliação encontrada.</EmptyState>
            )}
            {evaluations.map((evaluation) => {
              const title = evaluation.summary_text || evaluation.summaryText || "Avaliacao";
              const note =
                evaluation.plan_text ||
                evaluation.planText ||
                evaluation.summary_text ||
                evaluation.summaryText ||
                "Sem observações.";
              const createdAt = formatDate(evaluation.created_at || evaluation.createdAt);

              return (
                <HistoryCardLink
                  key={evaluation.id || `${createdAt}-${title}`}
                  to={`/pacientes/${id}/avaliacoes/${evaluation.id}`}
                >
                  <HistoryHeader>
                    <span>{createdAt}</span>
                    <h3>{title}</h3>
                  </HistoryHeader>
                  <p>{note}</p>
                </HistoryCardLink>
              );
            })}
          </Section>
        )}

        {!isLoading && activeTab === TABS.dados && (
          <Section>
            <InfoCard>
              <CardTitle>Cadastro</CardTitle>
              <DataList>
                <DataRow>
                  <DataLabel>Criado em</DataLabel>
                  <DataValue>{createdAtLabel}</DataValue>
                </DataRow>
              </DataList>
            </InfoCard>
            <InfoCard>
              <CardTitle>
                <FaUserAlt /> Informacoes pessoais
              </CardTitle>
              <DataList>
                <DataRow>
                  <DataLabel>Nome completo</DataLabel>
                  <DataValue>{valueOrDash(patient?.full_name || patient?.name)}</DataValue>
                </DataRow>
                <DataRow>
                  <DataLabel>Sexo</DataLabel>
                  <DataValue>{valueOrDash(patient?.sex)}</DataValue>
                </DataRow>
                <DataRow>
                  <DataLabel>Data de nascimento</DataLabel>
                  <DataValue>{formatDate(patient?.birth_date || patient?.birthDate)}</DataValue>
                </DataRow>
                <DataRow>
                  <DataLabel>Idade</DataLabel>
                  <DataValue>{age !== null ? `${age} anos` : "-"}</DataValue>
                </DataRow>
                <DataRow>
                  <DataLabel>CPF</DataLabel>
                  <DataValue>{valueOrDash(patient?.cpf)}</DataValue>
                </DataRow>
                <DataRow>
                  <DataLabel>RG</DataLabel>
                  <DataValue>{valueOrDash(patient?.rg)}</DataValue>
                </DataRow>
                <DataRow>
                  <DataLabel>Estado civil</DataLabel>
                  <DataValue>{valueOrDash(patient?.marital_status)}</DataValue>
                </DataRow>
                <DataRow>
                  <DataLabel>Profissao</DataLabel>
                  <DataValue>{valueOrDash(patient?.profession)}</DataValue>
                </DataRow>
                <DataRow>
                  <DataLabel>Origem</DataLabel>
                  <DataValue>{valueOrDash(patient?.referral_source)}</DataValue>
                </DataRow>
              </DataList>
            </InfoCard>
            <InfoCard>
              <CardTitle>
                <FaPhoneAlt /> Contato
              </CardTitle>
              <DataList>
                <DataRow>
                  <DataLabel>Email</DataLabel>
                  <DataValue>{valueOrDash(patient?.email)}</DataValue>
                </DataRow>
                <DataRow>
                  <DataLabel>Telefone</DataLabel>
                  <DataValue>{valueOrDash(patient?.phone)}</DataValue>
                </DataRow>
                <DataRow>
                  <DataLabel>Instagram</DataLabel>
                  <DataValue>{valueOrDash(patient?.instagram)}</DataValue>
                </DataRow>
                <DataRow>
                  <DataLabel>Contato via WhatsApp</DataLabel>
                  <DataValue>{formatBoolean(patient?.contact_via_whatsapp)}</DataValue>
                </DataRow>
                <DataRow>
                  <DataLabel>Contato via telefone</DataLabel>
                  <DataValue>{formatBoolean(patient?.contact_via_phone)}</DataValue>
                </DataRow>
                <DataRow>
                  <DataLabel>Contato via email</DataLabel>
                  <DataValue>{formatBoolean(patient?.contact_via_email)}</DataValue>
                </DataRow>
              </DataList>
            </InfoCard>
            <InfoCard>
              <CardTitle>Endereço</CardTitle>
              <DataList>
                <DataRow>
                  <DataLabel>Endereço completo</DataLabel>
                  <DataValue>{valueOrDash(address)}</DataValue>
                </DataRow>
                <DataRow>
                  <DataLabel>Rua</DataLabel>
                  <DataValue>{valueOrDash(patient?.address_street)}</DataValue>
                </DataRow>
                <DataRow>
                  <DataLabel>Número</DataLabel>
                  <DataValue>{valueOrDash(patient?.address_number)}</DataValue>
                </DataRow>
                <DataRow>
                  <DataLabel>Complemento</DataLabel>
                  <DataValue>{valueOrDash(patient?.address_complement)}</DataValue>
                </DataRow>
                <DataRow>
                  <DataLabel>Bairro</DataLabel>
                  <DataValue>{valueOrDash(patient?.address_neighborhood)}</DataValue>
                </DataRow>
                <DataRow>
                  <DataLabel>Cidade</DataLabel>
                  <DataValue>{valueOrDash(patient?.address_city)}</DataValue>
                </DataRow>
                <DataRow>
                  <DataLabel>UF</DataLabel>
                  <DataValue>{valueOrDash(patient?.address_state)}</DataValue>
                </DataRow>
                <DataRow>
                  <DataLabel>CEP</DataLabel>
                  <DataValue>{valueOrDash(patient?.address_zip)}</DataValue>
                </DataRow>
              </DataList>
            </InfoCard>
            <InfoCard>
              <CardTitle>Contato de emergência</CardTitle>
              <DataList>
                <DataRow>
                  <DataLabel>Nome</DataLabel>
                  <DataValue>{valueOrDash(patient?.emergency_contact_name)}</DataValue>
                </DataRow>
                <DataRow>
                  <DataLabel>Parentesco</DataLabel>
                  <DataValue>{valueOrDash(patient?.emergency_contact_relationship)}</DataValue>
                </DataRow>
                <DataRow>
                  <DataLabel>Telefone</DataLabel>
                  <DataValue>{valueOrDash(patient?.emergency_contact_phone)}</DataValue>
                </DataRow>
              </DataList>
            </InfoCard>
            <InfoCard>
              <CardTitle>Informações clínicas</CardTitle>
              <DataList>
                <DataRow>
                  <DataLabel>Queixa principal</DataLabel>
                  <DataValue>{valueOrDash(patient?.main_complaint)}</DataValue>
                </DataRow>
                <DataRow>
                  <DataLabel>Doenças/condições relevantes</DataLabel>
                  <DataValue>{valueOrDash(patient?.relevant_conditions)}</DataValue>
                </DataRow>
                <DataRow>
                  <DataLabel>Objetivo do tratamento</DataLabel>
                  <DataValue>{treatmentGoalDisplay}</DataValue>
                </DataRow>
                <DataRow>
                  <DataLabel>Objetivo (Outro)</DataLabel>
                  <DataValue>{valueOrDash(patient?.treatment_goal_other)}</DataValue>
                </DataRow>
              </DataList>
            </InfoCard>
            <InfoCard>
              <CardTitle>Consentimentos</CardTitle>
              <DataList>
                <DataRow>
                  <DataLabel>Consentimento LGPD</DataLabel>
                  <DataValue>{formatBoolean(patient?.consent_data_processing)}</DataValue>
                </DataRow>
                <DataRow>
                  <DataLabel>Consentimento de imagem</DataLabel>
                  <DataValue>{formatBoolean(patient?.consent_image_use)}</DataValue>
                </DataRow>
                <DataRow>
                  <DataLabel>Veracidade das informações</DataLabel>
                  <DataValue>{formatBoolean(patient?.consent_info_truth)}</DataValue>
                </DataRow>
              </DataList>
            </InfoCard>
          </Section>
        )}
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
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;

  h1 {
    color: #1b1b1b;
    margin-bottom: 6px;
  }

  p {
    color: #6a795c;
  }

  @media (max-width: 720px) {
    flex-direction: column;
  }
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
`;

const AddLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 18px;
  border-radius: 10px;
  background: #6a795c;
  color: #fff;
  text-decoration: none;
  font-weight: 700;
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

const Tabs = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
`;

const TabButton = styled.button`
  padding: 10px 16px;
  border-radius: 999px;
  border: 1px solid rgba(106, 121, 92, 0.3);
  background: ${(props) => (props.$active ? "#6a795c" : "#fff")};
  color: ${(props) => (props.$active ? "#fff" : "#6a795c")};
  font-weight: 600;
  cursor: pointer;
`;

const Section = styled.div`
  display: grid;
  gap: 16px;
`;

const InfoCard = styled.div`
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(106, 121, 92, 0.18);
  padding: 18px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.06);
`;

const CardTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  color: #1b1b1b;
  margin-bottom: 10px;
`;

const CardText = styled.div`
  color: #6a795c;
  line-height: 1.5;
`;

const DataList = styled.div`
  display: grid;
  gap: 8px;
`;

const DataRow = styled.div`
  display: grid;
  grid-template-columns: minmax(170px, 240px) minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(106, 121, 92, 0.12);

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  @media (max-width: 680px) {
    grid-template-columns: 1fr;
    gap: 2px;
  }
`;

const DataLabel = styled.span`
  color: #55644c;
  font-size: 0.87rem;
  font-weight: 700;
`;

const DataValue = styled.span`
  color: #2d3629;
  font-size: 0.92rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
`;

const HistoryCardLink = styled(Link)`
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(106, 121, 92, 0.18);
  padding: 16px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.06);
  text-decoration: none;
  transition: transform 0.15s ease, box-shadow 0.15s ease;

  p {
    color: #6a795c;
    margin-top: 8px;
  }

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 12px 26px rgba(0, 0, 0, 0.08);
  }
`;

const HistoryHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;

  span {
    font-size: 0.85rem;
    color: #6a795c;
  }

  h3 {
    margin: 0;
    color: #1b1b1b;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  color: #6a795c;
  padding: 24px 12px;
`;
