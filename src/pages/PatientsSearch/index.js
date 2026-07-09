import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useHistory } from "react-router-dom";
import styled from "styled-components";
import {
  FaLink,
  FaSearch,
  FaPhoneAlt,
  FaUser,
  FaUserPlus,
  FaList,
  FaThLarge,
} from "react-icons/fa";
import { toast } from "react-toastify";

import axios from "../../services/axios";
import DataLoadingState from "../../components/DataLoadingState";
import { PageWrapper, PageContent } from "../../components/AppLayout";
import { ModuleHeader, ModuleTitle } from "../../components/AppModuleShell";
import { getPatientDisplayName, getPatientSearchText } from "../../utils/patientSearch";

const PATIENTS_PER_PAGE = 10;

function getPatientName(patient) {
  return getPatientDisplayName(patient).trim();
}

function normalizeSearchValue(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function buildPatientSearchIndex(patient) {
  return normalizeSearchValue(`${getPatientSearchText(patient)} ${[
    patient?.address_street,
    patient?.address_number,
    patient?.address_city,
    patient?.address_state,
  ].filter(Boolean).join(" ")}`);
}

export default function PatientsSearch() {
  const history = useHistory();
  const [isLoading, setIsLoading] = useState(false);
  const [patients, setPatients] = useState([]);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState("list");
  const [currentPage, setCurrentPage] = useState(1);
  const [inviteLink, setInviteLink] = useState("");
  const [inviteExpiresAt, setInviteExpiresAt] = useState("");
  const [isInviteLoading, setIsInviteLoading] = useState(false);

  useEffect(() => {
    async function loadPatients() {
      setIsLoading(true);
      try {
        const response = await axios.get("/patients");
        const list = Array.isArray(response.data) ? response.data : [];
        setPatients(list);
      } catch (error) {
        const message =
          error?.response?.data?.error ||
          "Não foi possível carregar os pacientes.";
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    }

    loadPatients();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [query]);

  const filteredPatients = useMemo(() => {
    const value = normalizeSearchValue(query);
    if (!value) return patients;
    const terms = value.split(" ").filter(Boolean);

    return patients.filter((patient) => {
      const searchIndex = buildPatientSearchIndex(patient);
      return terms.every((term) => searchIndex.includes(term));
    });
  }, [patients, query]);

  const sortedPatients = useMemo(() => {
    return [...filteredPatients].sort((patientA, patientB) =>
      getPatientName(patientA).localeCompare(getPatientName(patientB), "pt-BR", {
        sensitivity: "base",
      })
    );
  }, [filteredPatients]);

  const totalPages = Math.max(1, Math.ceil(sortedPatients.length / PATIENTS_PER_PAGE));
  const visiblePatients = useMemo(() => {
    const firstPatientIndex = (currentPage - 1) * PATIENTS_PER_PAGE;
    return sortedPatients.slice(firstPatientIndex, firstPatientIndex + PATIENTS_PER_PAGE);
  }, [currentPage, sortedPatients]);
  const firstVisiblePatient = sortedPatients.length === 0
    ? 0
    : (currentPage - 1) * PATIENTS_PER_PAGE + 1;
  const lastVisiblePatient = Math.min(currentPage * PATIENTS_PER_PAGE, sortedPatients.length);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const handleGenerateInvite = useCallback(async () => {
    setIsInviteLoading(true);
    try {
      const response = await axios.post("/patient-invites", {
        expires_in_days: 7,
      });
      const code = response?.data?.code;
      const inviteUrl =
        response?.data?.invite_url ||
        (code ? `${window.location.origin}/cadastro/paciente/${code}` : "");
      setInviteLink(inviteUrl);
      setInviteExpiresAt(response?.data?.expires_at || "");
      toast.success("Link gerado.");
    } catch (error) {
      const message =
        error?.response?.data?.error || "Não foi possível gerar o link.";
      toast.error(message);
    } finally {
      setIsInviteLoading(false);
    }
  }, []);

  const handleCopyInvite = useCallback(async () => {
    if (!inviteLink) return;

    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success("Link copiado.");
    } catch (error) {
      toast.error("Não foi possível copiar o link.");
    }
  }, [inviteLink]);

  return (
    <PageWrapper $paddingTop="90px" $paddingBottom="60px">
      <PageContent
        $maxWidth="1220px"
        $paddingTop="0"
        $paddingX="30px"
        $paddingBottom="0"
        $mobileBreakpoint="859px"
        $mobilePaddingX="15px"
        $mobilePaddingTop="0"
        $mobilePaddingBottom="0"
      >
        <Header>
          <HeaderTitle>Consultar paciente</HeaderTitle>
          <HeaderActions>
            <PrimaryActionLink to="/pacientes/novo">
              <FaUserPlus />
              Novo paciente
            </PrimaryActionLink>
            <HeaderSecondaryAction
              type="button"
              onClick={handleGenerateInvite}
              disabled={isInviteLoading}
            >
              <FaLink />
              {isInviteLoading ? "Gerando..." : "Gerar link"}
            </HeaderSecondaryAction>
          </HeaderActions>
        </Header>

        {inviteLink && (
          <InvitePanel>
            <InviteInfo>
              <strong>Link de cadastro gerado</strong>
              {inviteExpiresAt && (
                <span>
                  Expira em {new Date(inviteExpiresAt).toLocaleDateString("pt-BR")}
                </span>
              )}
            </InviteInfo>
            <LinkBox>
              <LinkInput value={inviteLink} readOnly />
              <SecondaryAction type="button" onClick={handleCopyInvite}>
                Copiar
              </SecondaryAction>
            </LinkBox>
          </InvitePanel>
        )}

        <Controls>
          <SearchBar>
            <FaSearch />
            <input
              type="text"
              placeholder="Digite para buscar"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </SearchBar>

          <ViewToggle>
            <ViewButton
              type="button"
              onClick={() => setViewMode("list")}
              $active={viewMode === "list"}
              $buttonSize="list"
            >
              <FaList />
              Layout lista
            </ViewButton>
            <ViewButton
              type="button"
              onClick={() => setViewMode("grid")}
              $active={viewMode === "grid"}
              $buttonSize="grid"
            >
              <FaThLarge />
              Layout grade
            </ViewButton>
          </ViewToggle>
        </Controls>

        <ResultsSummary>
          <span>
            {patients.length} paciente{patients.length === 1 ? "" : "s"} cadastrado
            {patients.length === 1 ? "" : "s"}
          </span>
          {query.trim() && (
            <strong>
              {sortedPatients.length} resultado{sortedPatients.length === 1 ? "" : "s"} na busca
            </strong>
          )}
        </ResultsSummary>

        {isLoading && (
          <ResultsPanel>
            <DataLoadingState text="Carregando pacientes..." />
          </ResultsPanel>
        )}

        {!isLoading && sortedPatients.length === 0 && (
          <EmptyState>Nenhum paciente encontrado.</EmptyState>
        )}

        {!isLoading && (viewMode === "list" ? (
          <List>
            {visiblePatients.map((patient, index) => (
              <ListItem
                key={patient.id || `${getPatientName(patient)}-${index}`}
                role={patient.id ? "link" : undefined}
                tabIndex={patient.id ? 0 : undefined}
                $clickable={!!patient.id}
                onClick={() => {
                  if (patient.id) history.push(`/pacientes/${patient.id}`);
                }}
                onKeyDown={(event) => {
                  if (!patient.id) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    history.push(`/pacientes/${patient.id}`);
                  }
                }}
              >
                <PatientName>{getPatientName(patient)}</PatientName>
                <DetailsButton
                  to={patient.id ? `/pacientes/${patient.id}` : "/pacientes/consultar"}
                  $disabled={!patient.id}
                  onClick={(event) => event.stopPropagation()}
                >
                  Ver detalhes
                </DetailsButton>
              </ListItem>
            ))}
          </List>
        ) : (
          <Grid>
            {visiblePatients.map((patient, index) => (
              <Card key={patient.id || `${getPatientName(patient)}-${index}`}>
                <CardHeader>
                  <Avatar>
                    <FaUser />
                  </Avatar>
                  <div>
                    <h3>{getPatientName(patient)}</h3>
                    <span>{patient.email || "Sem email"}</span>
                  </div>
                </CardHeader>

                <CardBody>
                  <InfoRow>
                    <FaPhoneAlt />
                    <span>{patient.phone || "Sem telefone"}</span>
                  </InfoRow>
                  <InfoRow>
                    <span>
                      {patient.address_street
                        ? `${patient.address_street}${patient.address_number
                          ? `, ${patient.address_number}`
                          : ""
                        }`
                        : "Endereço não informado"}
                    </span>
                  </InfoRow>
                </CardBody>

                <CardActions>
                  <DetailsButton
                    to={patient.id ? `/pacientes/${patient.id}` : "/pacientes/consultar"}
                    $disabled={!patient.id}
                  >
                    Ver detalhes
                  </DetailsButton>
                </CardActions>
              </Card>
            ))}
          </Grid>
        ))}

        {!isLoading && sortedPatients.length > 0 && (
          <PaginationBar>
            <PaginationInfo>
              Mostrando {firstVisiblePatient}-{lastVisiblePatient} de {sortedPatients.length}
            </PaginationInfo>
            <PaginationControls>
              <PaginationButton
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              >
                Anterior
              </PaginationButton>
              <PaginationPage>
                Página {currentPage} de {totalPages}
              </PaginationPage>
              <PaginationButton
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              >
                Próxima
              </PaginationButton>
            </PaginationControls>
          </PaginationBar>
        )}
      </PageContent>
    </PageWrapper>
  );
}

const Header = styled(ModuleHeader)`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;

  @media (min-width: 720px) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
`;

const HeaderTitle = styled(ModuleTitle)`
  margin-bottom: 0;
`;

const HeaderActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`;

const PrimaryActionLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-sizing: border-box;
  width: 136px;
  height: 42px;
  padding: 0 10px;
  border-radius: 10px;
  border: 1px solid rgba(106, 121, 92, 0.3);
  background: #6a795c;
  color: #fff;
  text-decoration: none;
  font-size: 0.92rem;
  font-weight: 600;
  white-space: nowrap;
  transition: background-color 0.18s ease, box-shadow 0.18s ease;

  &:hover,
  &:focus-visible {
    color: #fff;
    text-decoration: none;
    background: #59694d;
    box-shadow: 0 0 0 3px rgba(106, 121, 92, 0.2);
  }
`;

const SecondaryAction = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 42px;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid rgba(106, 121, 92, 0.3);
  background: #fff;
  color: #516046;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.18s ease, box-shadow 0.18s ease;

  &:hover:not(:disabled),
  &:focus-visible:not(:disabled) {
    background: #f5f7f1;
    box-shadow: 0 0 0 3px rgba(106, 121, 92, 0.14);
  }

  &:disabled {
    opacity: 0.62;
    cursor: not-allowed;
  }
`;

const HeaderSecondaryAction = styled(SecondaryAction)`
  box-sizing: border-box;
  width: 146px;
  height: 42px;
  min-height: 42px;
  padding: 0 14px;
  font-size: 0.92rem;
  font-weight: 600;
  white-space: nowrap;
`;

const InvitePanel = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin: -8px 0 20px;
  padding: 14px;
  border: 1px solid rgba(106, 121, 92, 0.18);
  border-radius: 12px;
  background: #fff;

  @media (max-width: 760px) {
    align-items: stretch;
    flex-direction: column;
  }
`;

const InviteInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;

  strong {
    color: #1b1b1b;
    font-size: 0.95rem;
  }

  span {
    color: #6a795c;
    font-size: 0.86rem;
  }
`;

const LinkBox = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: min(100%, 420px);

  @media (max-width: 620px) {
    align-items: stretch;
    flex-direction: column;
  }
`;

const LinkInput = styled.input`
  flex: 1;
  min-width: 0;
  height: 42px;
  border-radius: 10px;
  border: 1px solid rgba(106, 121, 92, 0.2);
  padding: 0 12px;
  font-size: 0.94rem;
  color: #1b1b1b;
  background: #f9faf7;
`;

const Controls = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;

  @media (min-width: 860px) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
`;

const SearchBar = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  background: #fff;
  border-radius: 12px;
  border: 1px solid rgba(106, 121, 92, 0.2);
  padding: 12px 16px;
  color: #6a795c;
  flex: 1;

  input {
    border: none;
    outline: none;
    flex: 1;
    font-size: 1rem;
    color: #1b1b1b;
    background: transparent;
  }
`;

const ViewToggle = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
`;

const ViewButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-sizing: border-box;
  width: ${(props) => (props.$buttonSize === "grid" ? "146px" : "136px")};
  height: 42px;
  padding: 0 10px;
  border-radius: 10px;
  border: 1px solid rgba(106, 121, 92, 0.3);
  background: ${(props) => (props.$active ? "#6a795c" : "#fff")};
  color: ${(props) => (props.$active ? "#fff" : "#6a795c")};
  font-weight: 600;
  cursor: pointer;
`;

const ResultsSummary = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0 0 14px;
  color: #6a795c;
  font-size: 0.95rem;

  strong {
    color: #1b1b1b;
    font-weight: 700;
  }

  @media (max-width: 620px) {
    align-items: flex-start;
    flex-direction: column;
  }
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const ListItem = styled.div`
  background: #fff;
  border: 1px solid rgba(106, 121, 92, 0.18);
  border-radius: 12px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  cursor: ${(props) => (props.$clickable ? "pointer" : "default")};
  transition: background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;

  &:hover,
  &:focus-within {
    background: rgba(162, 177, 144, 0.12);
    border-color: rgba(106, 121, 92, 0.42);
    box-shadow: 0 6px 16px rgba(106, 121, 92, 0.18);
  }

  &:focus-visible {
    outline: 3px solid rgba(106, 121, 92, 0.28);
    outline-offset: 2px;
  }

  @media (max-width: 620px) {
    flex-direction: column;
    align-items: flex-start;
  }
`;

const PatientName = styled.h3`
  margin: 0;
  color: #1b1b1b;
  font-size: 1rem;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 18px;
`;

const Card = styled.div`
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(106, 121, 92, 0.18);
  padding: 18px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const CardHeader = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;

  h3 {
    margin: 0;
    color: #1b1b1b;
  }

  span {
    color: #6a795c;
    font-size: 0.9rem;
  }
`;

const Avatar = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(162, 177, 144, 0.25);
  border: 1px solid rgba(106, 121, 92, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6a795c;
`;

const CardBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: #6a795c;
  font-size: 0.92rem;
`;

const InfoRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const CardActions = styled.div`
  margin-top: auto;
`;

const DetailsButton = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  border-radius: 10px;
  background: ${(props) => (props.$disabled ? "#cbd3c1" : "#6a795c")};
  color: #fff;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.9rem;
  transition: background-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
  pointer-events: ${(props) => (props.$disabled ? "none" : "auto")};

  &:hover,
  &:focus-visible {
    color: #fff;
    text-decoration: none;
    background: ${(props) => (props.$disabled ? "#cbd3c1" : "#59694d")};
    box-shadow: ${(props) =>
      props.$disabled ? "none" : "0 0 0 3px rgba(106, 121, 92, 0.2)"};
  }
`;

const EmptyState = styled.div`
  padding: 40px 16px;
  text-align: center;
  color: #6a795c;
`;

const ResultsPanel = styled.div`
  min-height: 240px;
  border: 1px solid rgba(106, 121, 92, 0.16);
  border-radius: 12px;
  background: #fff;
`;

const PaginationBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-top: 18px;
  color: #6a795c;

  @media (max-width: 620px) {
    align-items: stretch;
    flex-direction: column;
  }
`;

const PaginationInfo = styled.span`
  font-size: 0.92rem;
`;

const PaginationControls = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;

  @media (max-width: 620px) {
    justify-content: space-between;
  }
`;

const PaginationButton = styled.button`
  border: 1px solid rgba(106, 121, 92, 0.3);
  border-radius: 10px;
  background: #fff;
  color: #6a795c;
  cursor: pointer;
  font-weight: 700;
  min-width: 92px;
  padding: 9px 12px;

  &:disabled {
    background: #f2f4ef;
    color: #a3ad99;
    cursor: not-allowed;
  }

  &:not(:disabled):hover,
  &:not(:disabled):focus-visible {
    border-color: rgba(106, 121, 92, 0.55);
    box-shadow: 0 0 0 3px rgba(106, 121, 92, 0.14);
    outline: none;
  }
`;

const PaginationPage = styled.span`
  min-width: 108px;
  text-align: center;
  font-size: 0.92rem;
  font-weight: 700;
`;
