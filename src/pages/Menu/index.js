import React from "react";
import { Link } from "react-router-dom";
import { FaClipboardList, FaBuilding, FaFileAlt } from "react-icons/fa";
import styled from "styled-components";

export default function Menu() {
  return (
    <Wrapper>
      <Content>
        <Title>
          <h1>Menu Principal</h1>
        </Title>
        <Nav>
          <StyledLink to="/agendamentos">
            <FaClipboardList size={24} />
            <div>
              <span>Agenda</span>
              <Description>Checklists disponíveis para serem realizados</Description>
            </div>
          </StyledLink>
          <StyledLink to="/imoveis">
            <FaBuilding size={24} />
            <div>
              <span>Novo Agendamento e Imóveis</span>
              <Description>Agendar um novo checklist e cadastrar um novo imóvel</Description>
            </div>
          </StyledLink>
          <StyledLink to="/laudos">
            <FaFileAlt size={24} />
            <div>
              <span>Laudos Realizados</span>
              <Description>Download de Checklists realizados</Description>
            </div>
          </StyledLink>
        </Nav>
      </Content>
    </Wrapper>
  );
}

// Styled-components
const Wrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 20px;
  background-color: #fff;
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

const Title = styled.div`
  margin-bottom: 30px;

  h1 {
    font-size: 24px;
    font-weight: 800; /* Extra bold */
    color: #143610;
  }
`;

const Nav = styled.nav`
  display: flex;
  justify-content: space-around;
  padding: 20px 0;
`;

const StyledLink = styled(Link)`
  display: flex;
  flex-direction: column; /* Alinha o conteúdo verticalmente */
  align-items: center;
  text-align: center; /* Centraliza o texto */
  padding: 10px 20px;
  font-size: 18px;
  color: #143610;
  text-decoration: none;
  transition: background-color 0.3s ease, color 0.3s ease;

  &:hover {
    background-color: #123f2d;
    color: white;
  }

  span {
    margin-top: 8px; /* Espaço entre o ícone e o texto */
    font-weight: bold;
  }
`;

const Description = styled.p`
  font-size: 14px;
  color: #666;
  margin-top: 8px; /* Espaço entre o nome do menu e a descrição */
`;
