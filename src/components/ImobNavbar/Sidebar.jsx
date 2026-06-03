import React from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { Link } from "react-router-dom";
import CloseIcon from "../../assets/svg/CloseIcon";
import { useClinicContext } from "../../contexts/ClinicContext";
import { useAuth } from "../../hooks/useAuth";
import { usePublicClinicContext } from "../../contexts/PublicClinicContext";
import TenantLoading from "../TenantLoading";
import { isPlansModuleEnabled } from "../../config/features";


export default function Sidebar({ sidebarOpen, toggleSidebar }) {
  const { isLoggedIn } = useAuth();
  const {
    displayName: clinicName,
    loaded: clinicLoaded,
    loading: clinicLoading,
    logoSrc: clinicLogoSrc,
  } = useClinicContext();
  const {
    displayName: publicName,
    loaded: publicLoaded,
    loading: publicLoading,
    logoSrc: publicLogoSrc,
  } = usePublicClinicContext();
  const displayName = isLoggedIn ? clinicName : publicName;
  const logoSrc = isLoggedIn ? clinicLogoSrc : publicLogoSrc;
  const brandLoading = isLoggedIn
    ? clinicLoading || !clinicLoaded
    : publicLoading || !publicLoaded;
  let brandMark = <NeutralMark aria-hidden="true">SG</NeutralMark>;

  if (brandLoading) {
    brandMark = <TenantLoading compact />;
  } else if (logoSrc) {
    brandMark = (
      <img
        src={logoSrc}
        alt={`${displayName} Logo`}
        style={{ height: "40px", marginRight: "15px" }}
      />
    );
  }

  return (
    <Wrapper className="animate" sidebarOpen={sidebarOpen} $publicMode={!isLoggedIn}>
      <SidebarHeader className="flexSpaceCenter">
        <div className="flexNullCenter">
          {brandMark}
          {!brandLoading && (
            <h1
              className="whiteColor font20"
              style={{
                marginLeft: "15px",
                color: isLoggedIn
                  ? "var(--clinic-accent-color, #A2B190)"
                  : "var(--public-accent-color, #A2B190)",
              }}
            >
              {displayName}
            </h1>
          )}
        </div>
        <CloseBtn
          onClick={() => toggleSidebar(!sidebarOpen)}
          className="animate pointer"
        >
          <CloseIcon />
        </CloseBtn>
      </SidebarHeader>
      <UlStyle className="flexSpaceCenter">
        <li className="semiBold font15 pointer flexCenter">
          <Link
            to="/agendamentos"
            style={{ padding: "10px 15px", textDecoration: "none" }}
            
          >
            Agenda
          </Link>
        </li>

        <li className="semiBold font15 pointer flexCenter">
          <Link
            to="/painel"
            style={{ padding: "10px 15px", textDecoration: "none" }}
          >
            Painel
          </Link>
        </li>

        <li className="semiBold font15 pointer flexCenter">
          <Link
            to="/financeiro"
            style={{ padding: "10px 15px", textDecoration: "none" }}
          >
            Financeiro
          </Link>
        </li>

        <li className="semiBold font15 pointer flexCenter">
          <Link
            to="/pacientes"
            style={{ padding: "10px 15px", textDecoration: "none" }}
            
          >
            Pacientes
          </Link>
        </li>

        {isPlansModuleEnabled && (
          <li className="semiBold font15 pointer flexCenter">
            <Link
              to="/planos"
              style={{ padding: "10px 15px", textDecoration: "none" }}
            >
              Planos
            </Link>
          </li>
        )}

        {/* <li className="semiBold font15 pointer flexCenter">
          <Link
            to="/laudos"
            style={{ padding: "10px 15px", textDecoration: "none" }}
            
          >
            Exames
          </Link>
        </li> */}

      </UlStyle>
    </Wrapper>
  );
}

Sidebar.propTypes = {
  sidebarOpen: PropTypes.bool.isRequired,
  toggleSidebar: PropTypes.func.isRequired,
};

const Wrapper = styled.nav`
  width: 360px;
  height: 100vh;
  position: fixed;
  top: 0;
  padding: 0 24px;
  right: ${(props) => (props.sidebarOpen ? "0px" : "-360px")};
  z-index: 9999;
  background: ${(props) => (props.$publicMode
    ? "var(--public-primary-color, #6a795c)"
    : "var(--clinic-primary-color, #6a795c)")};
  @media (max-width: 400px) {
    width: 100%;
    right: ${(props) => (props.sidebarOpen ? "0px" : "-100%")};
  }
`;
const SidebarHeader = styled.div`
  padding: 20px 0;
`;

const CloseBtn = styled.button`
  border: 0px;
  outline: none;
  background-color: transparent;
  padding: 10px;
`;

const NeutralMark = styled.span`
  width: 40px;
  height: 40px;
  margin-right: 15px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.35);
  font-weight: 800;
  letter-spacing: 0;
`;

const UlStyle = styled.ul`
  display: flex;
  flex-direction: column; /* Organiza os itens verticalmente */
  align-items: flex-start; /* Alinha os itens a esquerda */
  padding: 30px 0 10px;
  list-style: none; /* Remove os marcadores da lista */

  li {
    width: 100%;
    margin-bottom: 16px;

    a {
      display: block;
      width: 100%;
      text-align: left;
      background: rgba(255, 255, 255, 0.14);
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.35);
      border-radius: 12px;
      font-weight: 600;
    }
  }
`;
