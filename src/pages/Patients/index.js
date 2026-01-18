import React from "react";
import { Link } from "react-router-dom";
import { FaUserPlus, FaSearch } from "react-icons/fa";
import styled from "styled-components";

export default function PatientsMenu() {
  return (
    <Wrapper>
      <Content>
        <Header>
          <h1 className="font40 extraBold">Pacientes</h1>
          <p className="font15">Gerencie cadastros e consultas.</p>
        </Header>

        <Grid>
          <CardLink to="/pacientes/novo">
            <IconCircle>
              <FaUserPlus size={22} />
            </IconCircle>
            <CardTitle>Novo paciente</CardTitle>
            <CardSubtitle>Cadastrar um novo paciente.</CardSubtitle>
          </CardLink>

          <CardLink to="/pacientes/consultar">
            <IconCircle>
              <FaSearch size={20} />
            </IconCircle>
            <CardTitle>Consultar paciente</CardTitle>
            <CardSubtitle>Buscar pacientes cadastrados.</CardSubtitle>
          </CardLink>
        </Grid>
      </Content>
    </Wrapper>
  );
}

const Wrapper = styled.section`
  min-height: 100vh;
  background: #f7f8f4;
  padding: 80px 0 60px;
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
  margin-bottom: 30px;
  h1 {
    color: #1b1b1b;
    margin-bottom: 8px;
  }
  p {
    color: #6a795c;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 24px;
`;

const CardLink = styled(Link)`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 22px;
  border-radius: 16px;
  background: #fff;
  border: 1px solid rgba(106, 121, 92, 0.18);
  text-decoration: none;
  color: inherit;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.06);
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 16px 30px rgba(0, 0, 0, 0.1);
  }
`;

const IconCircle = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(162, 177, 144, 0.2);
  border: 1px solid rgba(106, 121, 92, 0.2);
  color: #6a795c;
`;

const CardTitle = styled.div`
  font-size: 1.1rem;
  font-weight: 700;
  color: #1b1b1b;
`;

const CardSubtitle = styled.div`
  font-size: 0.95rem;
  color: #6a795c;
`;
