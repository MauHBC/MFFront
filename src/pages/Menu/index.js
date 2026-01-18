import React from "react";
import { Link } from "react-router-dom";
import { FaCalendarAlt, FaUserFriends, FaFileMedical } from "react-icons/fa";
import styled from "styled-components";

export default function Menu() {
  return (
    <Wrapper>
      <Content>
        <Title>
          {/* <h1>Menu Principal</h1> */}
        </Title>
        <Nav>
          <StyledLink to="/agendamentos">
            <IconBadge $bg="#f0f3ec" $color="#6a795c">
              <FaCalendarAlt size={24} />
            </IconBadge>
            <div>
              <span>Agenda</span>
            </div>
          </StyledLink>
          <StyledLink to="/pacientes">
            <IconBadge $bg="#edf1f7" $color="#5a6e8a">
              <FaUserFriends size={24} />
            </IconBadge>
            <div>
              <span>Pacientes</span>
            </div>
          </StyledLink>
          <StyledLink to="/laudos">
            <IconBadge $bg="#f6f0ec" $color="#8a6a5a">
              <FaFileMedical size={24} />
            </IconBadge>
            <div>
              <span>Exames</span>
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
    color: #6A795C;
  }
`;

const Nav = styled.nav`
  display: flex;
  justify-content: space-around;
  padding: 20px 0;
`;

const StyledLink = styled(Link)`
  display: flex;
  flex-direction: column; /* Alinha o conteudo verticalmente */
  align-items: center;
  text-align: center; /* Centraliza o texto */
  gap: 10px;
  padding: 18px 24px;
  min-width: 160px;
  font-size: 18px;
  color: #1b1b1b;
  text-decoration: none;
  border-radius: 18px;
  background: #fff;
  border: 1px solid rgba(106, 121, 92, 0.2);
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.06);
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 14px 28px rgba(0, 0, 0, 0.1);
  }

  span {
    font-weight: 700;
  }
`;


// const Description = styled.p`
//   font-size: 14px;
//   color: #666;
//   margin-top: 8px; /* Espaço entre o nome do menu e a descrição */
// `;

const IconBadge = styled.div`
  width: 54px;
  height: 54px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${(props) => props.$bg || "#f3f5f1"};
  color: ${(props) => props.$color || "#6a795c"};
`;

