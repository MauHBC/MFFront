import React from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { Link } from "react-router-dom";
import CloseIcon from "../../assets/svg/CloseIcon";
import Logo from "../../assets/img/Logo.png";


export default function Sidebar({ sidebarOpen, toggleSidebar }) {
  return (
    <Wrapper className="animate" sidebarOpen={sidebarOpen}>
      <SidebarHeader className="flexSpaceCenter">
        <div className="flexNullCenter">
          <img
              src={Logo}
              alt="Espaço Cuidar Logo"
              style={{ height: "40px", marginRight: "15px" }}
          />
          <h1 className="whiteColor font20" style={{ marginLeft: "15px", color: '#A2B190' }}>
            Espaço Cuidar
          </h1>
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
            to="/menu"
            style={{ padding: "10px 15px", textDecoration: "none" }}
            
          >
            Menu
          </Link>
        </li>

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
            to="/pacientes"
            style={{ padding: "10px 15px", textDecoration: "none" }}
            
          >
            Pacientes
          </Link>
        </li>

        <li className="semiBold font15 pointer flexCenter">
          <Link
            to="/laudos"
            style={{ padding: "10px 15px", textDecoration: "none" }}
            
          >
            Exames
          </Link>
        </li>

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
  background: #6a795c;
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
