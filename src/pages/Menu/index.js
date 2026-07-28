import React from "react";
import { Link } from "react-router-dom";
import { FaCalendarAlt, FaUserFriends, FaMoneyBillWave, FaClipboardList, FaChartLine } from "react-icons/fa";
// Icone para exames: FaFileMedical
import styled from "styled-components";
import { isPlansModuleEnabled } from "../../config/features";
import AppShell from "../../components/AppShell";
import {
  colors,
  layout,
  radii,
  shadows,
  spacing,
  typography,
} from "../../styles/tokens";

export default function Menu() {
  return (
    <AppShell pageTitle="Atalhos">
      <Wrapper>
        <Content>
          <Title>
            <span>Visão geral</span>
            <h1>O que você precisa acessar?</h1>
            <p>Use os atalhos abaixo ou a navegação lateral para trocar de módulo.</p>
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
          <StyledLink to="/painel">
            <IconBadge $bg="#edf4f2" $color="#517268">
              <FaChartLine size={24} />
            </IconBadge>
            <div>
              <span>Painel</span>
            </div>
          </StyledLink>
          {/* <StyledLink to="/laudos">
            <IconBadge $bg="#f6f0ec" $color="#8a6a5a">
              <FaFileMedical size={24} />
            </IconBadge>
            <div>
              <span>Exames</span>
            </div>
          </StyledLink> */}
          <StyledLink to="/financeiro">
            <IconBadge $bg="#e9f1ee" $color="#4f6b45">
              <FaMoneyBillWave size={24} />
            </IconBadge>
            <div>
              <span>Financeiro</span>
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
          {isPlansModuleEnabled && (
            <StyledLink to="/planos">
              <IconBadge $bg="#eef3ec" $color="#3d5a30">
                <FaClipboardList size={24} />
              </IconBadge>
              <div>
                <span>Planos</span>
              </div>
            </StyledLink>
          )}
        </Nav>
        </Content>
      </Wrapper>
    </AppShell>
  );
}

// Styled-components
const Wrapper = styled.div`
  min-height: calc(100vh - ${layout.appHeaderHeight});
  padding: ${spacing.xxl} ${spacing.xl};
  background: ${colors.appBackground};

  @media only screen and (max-width: ${layout.mobileBreakpoint}) {
    padding: ${spacing.xl} ${spacing.lg};
  }
`;

const Content = styled.div`
  width: 100%;
  max-width: ${layout.pageMaxWidth};
  margin: 0 auto;
`;

const Title = styled.div`
  margin-bottom: ${spacing.xl};

  h1 {
    margin: ${spacing.xs} 0;
    color: ${colors.textPrimary};
    font-size: 2rem;
    line-height: 1.15;
    font-weight: ${typography.weightBold};
  }

  span {
    color: ${colors.brand};
    font-size: 0.75rem;
    font-weight: ${typography.weightBold};
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  p {
    color: ${colors.textSecondary};
    font-size: 0.96rem;
  }
`;

const Nav = styled.nav`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: ${spacing.lg};

  @media only screen and (max-width: 900px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media only screen and (max-width: 560px) {
    grid-template-columns: 1fr;
  }
`;

const StyledLink = styled(Link)`
  display: flex;
  flex-direction: column; /* Alinha o conteudo verticalmente */
  align-items: center;
  text-align: center; /* Centraliza o texto */
  gap: 10px;
  padding: ${spacing.xl};
  min-width: 160px;
  font-size: 18px;
  color: ${colors.textPrimary};
  text-decoration: none;
  border-radius: ${radii.xl};
  background: ${colors.surfaceElevated};
  border: 1px solid ${colors.borderSubtle};
  box-shadow: ${shadows.subtle};
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover,
  &:focus-visible {
    transform: translateY(-3px);
    box-shadow: ${shadows.elevated};
  }

  &:focus-visible {
    outline: 3px solid ${colors.focus};
    outline-offset: 2px;
  }

  span {
    font-weight: 700;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    &:hover,
    &:focus-visible {
      transform: none;
    }
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
