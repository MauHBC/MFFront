import React from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { Link } from "react-scroll";
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
          <h1 className="whiteColor font20" style={{ marginLeft: "15px" }}>
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
          <Link
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
          </Link>
        </li>
        <li className="semiBold font15 pointer">
          <Link
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
          </Link>
        </li>
        {/* <li className="semiBold font15 pointer">
          <Link
            onClick={() => toggleSidebar(!sidebarOpen)}
            activeClass="active"
            className="whiteColor"
            style={{ padding: "10px 15px" }}
            to="projects"
            spy
            smooth
            offset={-60}
          >
            Projects
          </Link>
        </li>
        <li className="semiBold font15 pointer">
          <Link
            onClick={() => toggleSidebar(!sidebarOpen)}
            activeClass="active"
            className="whiteColor"
            style={{ padding: "10px 15px" }}
            to="blog"
            spy
            smooth
            offset={-60}
          >
            Blog
          </Link>
        </li>
        <li className="semiBold font15 pointer">
          <Link
            onClick={() => toggleSidebar(!sidebarOpen)}
            activeClass="active"
            className="whiteColor"
            style={{ padding: "10px 15px" }}
            to="pricing"
            spy
            smooth
            offset={-60}
          >
            Pricing
          </Link>
        </li> */}
        <li className="semiBold font15 pointer">
          <Link
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
          </Link>
        </li>
      </UlStyle>
      {/* <UlStyle className="flexSpaceCenter">
        <li className="semiBold font15 pointer">
          <a
            href="http://localhost:3000/login"
            style={{ padding: "10px 30px 10px 0" }}
            className="whiteColor"
          >
            Log in
          </a>
        </li>
        <li className="semiBold font15 pointer flexCenter">
          <a
            href="http://localhost:3000/register"
            className="radius8 lightBg"
            style={{ padding: "10px 15px" }}
          >
            Menu
          </a>
        </li>
      </UlStyle> */}
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
  padding: 40px;
  li {
    margin: 20px 0;
  }
`;
