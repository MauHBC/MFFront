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

function formatDate(value) {
  if (!value) return "--/--/----";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--/--/----";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
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
          axios.get(`/api/patients/${id}`),
          axios.get(`/api/evaluations?patient_id=${id}`),
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
          <BackLink to="/pacientes/consultar">Voltar</BackLink>
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
              <EmptyState>Nenhuma avaliacao encontrada.</EmptyState>
            )}
            {evaluations.map((evaluation) => {
              const title = evaluation.summary_text || evaluation.summaryText || "Avaliacao";
              const note =
                evaluation.plan_text ||
                evaluation.planText ||
                evaluation.summary_text ||
                evaluation.summaryText ||
                "Sem observacoes.";
              const createdAt = formatDate(evaluation.created_at || evaluation.createdAt);

              return (
                <HistoryCard key={evaluation.id || `${createdAt}-${title}`}>
                  <HistoryHeader>
                    <span>{createdAt}</span>
                    <h3>{title}</h3>
                  </HistoryHeader>
                  <p>{note}</p>
                </HistoryCard>
              );
            })}
          </Section>
        )}

        {!isLoading && activeTab === TABS.dados && (
          <Section>
            <InfoCard>
              <CardTitle>
                <FaUserAlt /> Informacoes pessoais
              </CardTitle>
              <InfoList>
                <li>Sexo: {patient?.sex || "-"}</li>
                <li>Idade: {age !== null ? `${age} anos` : "-"}</li>
                <li>Origem: {patient?.referral_source || "-"}</li>
              </InfoList>
            </InfoCard>
            <InfoCard>
              <CardTitle>
                <FaPhoneAlt /> Contato
              </CardTitle>
              <InfoList>
                <li>Telefone: {patient?.phone || "-"}</li>
                <li>Endereco: {address || "-"}</li>
              </InfoList>
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

const InfoList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #6a795c;
`;

const HistoryCard = styled.div`
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(106, 121, 92, 0.18);
  padding: 16px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.06);

  p {
    color: #6a795c;
    margin-top: 8px;
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
