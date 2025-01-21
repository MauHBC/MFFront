import React from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { Link as ScrollLink } from "react-scroll"; // Renomeando o Link do react-scroll
import { Link as RouterLink } from "react-router-dom"; // Renomeando o Link do react-router-dom
import CloseIcon from "../../assets/svg/CloseIcon";
import Logo from "../../assets/img/Logo.png";

export default function Sidebar({ sidebarOpen, toggleSidebar }) {
  return (
    <Wrapper className="animate darkBg" sidebarOpen={sidebarOpen}>
      <SidebarHeader className="flexSpaceCenter">
        <div className="flexNullCenter">
          <img
              src={Logo}
              alt="Checkpoint Logo"
              style={{ height: "40px", marginRight: "15px" }}
          />
          <h1 className="whiteColor font20" style={{ marginLeft: "15px", color: '#af9b55' }}>
            Checkpoint
          </h1>
        </div>
        <CloseBtn
          onClick={() => toggleSidebar(!sidebarOpen)}
          className="animate pointer"
        >
          <CloseIcon />
        </CloseBtn>
      </SidebarHeader>
      <UlStyle className="flexNullCenter flexColumn">

        <li className="semiBold font15 pointer">
          <ScrollLink
            onClick={() => toggleSidebar(!sidebarOpen)}
            activeClass="active"
            className="whiteColor"
            style={{ padding: "10px 15px" }}
            to="home"
            spy
            smooth
            offset={-60}
          >
            Home
          </ScrollLink>
        </li>

        <li className="semiBold font15 pointer">
          <ScrollLink
            onClick={() => toggleSidebar(!sidebarOpen)}
            activeClass="active"
            className="whiteColor"
            style={{ padding: "10px 15px" }}
            to="services"
            spy
            smooth
            offset={-60}
          >
            Serviços
          </ScrollLink>
        </li>

        <li className="semiBold font15 pointer">
          <ScrollLink
            onClick={() => toggleSidebar(!sidebarOpen)}
            activeClass="active"
            className="whiteColor"
            style={{ padding: "10px 15px" }}
            to="contact"
            spy
            smooth
            offset={-60}
          >
            Contato
          </ScrollLink>
        </li>
        
      </UlStyle>

      <UlStyle className="flexSpaceCenter">
        <li className="semiBold font15 pointer">
        <RouterLink
            to="/login"
            style={{ padding: "10px 15px", textDecoration: "none" }}
            className="radius8 lightBg"
          >
            Login
          </RouterLink>

        </li>
        <li className="semiBold font15 pointer flexCenter">
          <RouterLink
            to="/menu"
            style={{ padding: "10px 15px", textDecoration: "none" }}
            className="radius8 lightBg"
          >
            Menu
          </RouterLink>

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
  width: 400px;
  height: 100vh;
  position: fixed;
  top: 0;
  padding: 0 30px;
  right: ${(props) => (props.sidebarOpen ? "0px" : "-400px")};
  z-index: 9999;
  @media (max-width: 400px) {
    width: 100%;
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
  align-items: flex-start; /* Alinha os itens à esquerda */
  padding: 40px 0; /* Espaço no topo e embaixo */
  list-style: none; /* Remove os marcadores da lista */

  li {
    width: 100%; /* Para os links ocuparem toda a largura */
    margin-bottom: 20px; /* Espaço entre os itens */
    
    a {
      display: block; /* Garante que o link seja tratado como bloco */
      width: 100%; /* Ocupa toda a largura disponível */
      text-align: left; /* Alinha o texto à esquerda */
    }
  }
`;
