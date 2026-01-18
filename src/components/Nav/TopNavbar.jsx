import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { Link as ScrollLink } from "react-scroll";
import { Link as RouterLink } from "react-router-dom";

// Components
import Sidebar from "./Sidebar";
import Backdrop from "../Elements/Backdrop";
// Assets
import Logo from "../../assets/img/Logo.png";
import BurgerIcon from "../../assets/svg/BurgerIcon";

export default function TopNavbar() {
  const [y, setY] = useState(window.scrollY);
  const [sidebarOpen, toggleSidebar] = useState(false);

  useEffect(() => {
    window.addEventListener("scroll", () => setY(window.scrollY));
    return () => {
      window.removeEventListener("scroll", () => setY(window.scrollY));
    };
  }, [y]);

  return (
    <>
      <Sidebar sidebarOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
      {sidebarOpen && <Backdrop toggleSidebar={toggleSidebar} />}
      <Wrapper
        className="flexCenter animate whiteBg"
        style={y > 100 ? { height: "60px" } : { height: "80px" }}
      >
        <NavInner className="container flexSpaceCenter">
          <ScrollLink className="pointer flexNullCenter" to="home" smooth>
            <img
              src={Logo}
              alt="Espaço Cuidar Logo"
              style={{ height: "40px", marginRight: "15px" }}
            />
            <h1
              style={{ marginLeft: "15px", color: "#A2B190" }}
              className="font20 extraBold"
            >
              Espaço Cuidar
            </h1>
          </ScrollLink>
          <BurderWrapper
            className="pointer"
            onClick={() => toggleSidebar(!sidebarOpen)}
          >
            <BurgerIcon />
          </BurderWrapper>
          <UlWrapper className="flexNullCenter">
            <li className="semiBold font15 pointer">
              <ScrollLink
                activeClass="active"
                style={{ padding: "10px 15px", color: "#6A795C" }}
                to="home"
                spy
                smooth
                offset={-80}
              >
                Home
              </ScrollLink>
            </li>
            <li className="semiBold font15 pointer">
              <ScrollLink
                activeClass="active"
                style={{ padding: "10px 15px", color: "#6A795C" }}
                to="services"
                spy
                smooth
                offset={-80}
              >
                Serviços
              </ScrollLink>
            </li>
            <li className="semiBold font15 pointer">
              <ScrollLink
                activeClass="active"
                style={{ padding: "10px 15px", color: "#6A795C" }}
                to="contact"
                spy
                smooth
                offset={-80}
              >
                Contato
              </ScrollLink>
            </li>
            <li className="semiBold font15 pointer">
              <RouterLink
                to="/login"
                style={{
                  padding: "10px 15px",
                  color: "#6A795C",
                  textDecoration: "none",
                }}
              >
                Login
              </RouterLink>
            </li>
          </UlWrapper>
        </NavInner>
      </Wrapper>
    </>
  );
}

const Wrapper = styled.nav`
  width: 100%;
  background: #ffffff;
  border-bottom: 1px solid rgba(106, 121, 92, 0.12);
  position: fixed;
  top: 0;
  left: 0;
  z-index: 999;
`;
const NavInner = styled.div`
  position: relative;
  height: 100%;
`;
const BurderWrapper = styled.button`
  outline: none;
  border: 0px;
  background-color: transparent;
  height: 100%;
  padding: 0 15px;
  display: none;
  @media (max-width: 760px) {
    display: block;
  }
`;
const UlWrapper = styled.ul`
  display: flex;
  @media (max-width: 760px) {
    display: none;
  }
`;
