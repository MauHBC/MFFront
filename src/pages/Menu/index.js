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
            <span>Agenda</span>
          </StyledLink>
          <StyledLink to="/imoveis">
            <FaBuilding size={24} />
            <span>Imóveis</span>
          </StyledLink>
          <StyledLink to="/laudos">
            <FaFileAlt size={24} />
            <span>Laudos</span>
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
  align-items: center;
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
    margin-left: 10px;
  }
`;