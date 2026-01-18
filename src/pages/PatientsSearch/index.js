import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { FaSearch, FaPhoneAlt, FaUser } from "react-icons/fa";
import { toast } from "react-toastify";

import axios from "../../services/axios";
import Loading from "../../components/Loading";

export default function PatientsSearch() {
  const [isLoading, setIsLoading] = useState(false);
  const [patients, setPatients] = useState([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    async function loadPatients() {
      setIsLoading(true);
      try {
        const response = await axios.get("/api/patients");
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
    const value = query.trim().toLowerCase();
    if (!value) return patients;

    return patients.filter((patient) => {
      const name = (patient.full_name || patient.name || "").toLowerCase();
      const email = (patient.email || "").toLowerCase();
      const phone = (patient.phone || "").toLowerCase();
      return (
        name.includes(value) ||
        email.includes(value) ||
        phone.includes(value)
      );
    });
  }, [patients, query]);

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

        <SearchBar>
          <FaSearch />
          <input
            type="text"
            placeholder="Digite para buscar"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </SearchBar>

        <Loading isLoading={isLoading} />

        {!isLoading && filteredPatients.length === 0 && (
          <EmptyState>
            Nenhum paciente encontrado.
          </EmptyState>
        )}

        <Grid>
          {filteredPatients.map((patient) => (
            <Card key={patient.id || patient.full_name}>
              <CardHeader>
                <Avatar>
                  <FaUser />
                </Avatar>
                <div>
                  <h3>{patient.full_name || patient.name || "Paciente"}</h3>
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
                      ? `${patient.address_street}${
                          patient.address_number
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

const SearchBar = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  background: #fff;
  border-radius: 12px;
  border: 1px solid rgba(106, 121, 92, 0.2);
  padding: 12px 16px;
  margin-bottom: 20px;
  color: #6a795c;

  input {
    border: none;
    outline: none;
    flex: 1;
    font-size: 1rem;
    color: #1b1b1b;
    background: transparent;
  }
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
  padding: 8px 14px;
  border-radius: 10px;
  background: ${(props) => (props.$disabled ? "#cbd3c1" : "#6a795c")};
  color: #fff;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.9rem;
  pointer-events: ${(props) => (props.$disabled ? "none" : "auto")};
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
