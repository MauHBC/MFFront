import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { FaSearch, FaPhoneAlt, FaUser, FaList, FaThLarge } from "react-icons/fa";
import { toast } from "react-toastify";

import axios from "../../services/axios";
import Loading from "../../components/Loading";

function getPatientName(patient) {
  return (patient?.full_name || patient?.name || "Paciente").trim();
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
  return normalizeSearchValue([
    getPatientName(patient),
    patient?.email,
    patient?.phone,
    patient?.cpf,
    patient?.document,
    patient?.address_street,
    patient?.address_number,
    patient?.address_city,
    patient?.address_state,
  ].filter(Boolean).join(" "));
}

export default function PatientsSearch() {
  const [isLoading, setIsLoading] = useState(false);
  const [patients, setPatients] = useState([]);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState("list");

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
          "Nao foi possivel carregar os pacientes.";
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    }

    loadPatients();
  }, []);

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

  return (
    <Wrapper>
      <Content>
        <Header>
          <div>
            <h1 className="font40 extraBold">Consultar paciente</h1>
            <p className="font15">
              Busque pacientes cadastrados pelo nome, email ou telefone.
            </p>
          </div>
          <BackLink to="/pacientes">Voltar</BackLink>
        </Header>

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
            >
              <FaList />
              Layout lista
            </ViewButton>
            <ViewButton
              type="button"
              onClick={() => setViewMode("grid")}
              $active={viewMode === "grid"}
            >
              <FaThLarge />
              Layout grade
            </ViewButton>
          </ViewToggle>
        </Controls>

        <Loading isLoading={isLoading} />

        {!isLoading && sortedPatients.length === 0 && (
          <EmptyState>Nenhum paciente encontrado.</EmptyState>
        )}

        {viewMode === "list" ? (
          <List>
            {sortedPatients.map((patient, index) => (
              <ListItem key={patient.id || `${getPatientName(patient)}-${index}`}>
                <PatientName>{getPatientName(patient)}</PatientName>
                <DetailsButton
                  to={patient.id ? `/pacientes/${patient.id}` : "/pacientes/consultar"}
                  $disabled={!patient.id}
                >
                  Ver detalhes
                </DetailsButton>
              </ListItem>
            ))}
          </List>
        ) : (
          <Grid>
            {sortedPatients.map((patient, index) => (
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
                        : "Endereco nao informado"}
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
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;

  h1 {
    color: #1b1b1b;
    margin-bottom: 6px;
  }

  p {
    color: #6a795c;
  }

  @media (min-width: 720px) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
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
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid rgba(106, 121, 92, 0.3);
  background: ${(props) => (props.$active ? "#6a795c" : "#fff")};
  color: ${(props) => (props.$active ? "#fff" : "#6a795c")};
  font-weight: 600;
  cursor: pointer;
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
  transition: background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;

  &:hover,
  &:focus-within {
    background: rgba(162, 177, 144, 0.12);
    border-color: rgba(106, 121, 92, 0.42);
    box-shadow: 0 6px 16px rgba(106, 121, 92, 0.18);
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

const EmptyState = styled.div`
  padding: 40px 16px;
  text-align: center;
  color: #6a795c;
`;
