import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { Link as RouterLink, useHistory } from "react-router-dom";

// Components
import Sidebar from "./Sidebar";
import Backdrop from "../Elements/Backdrop";

// Assets
import Logo from "../../assets/img/Logo.png";
import BurgerIcon from "../../assets/svg/BurgerIcon";

// Hooks
import { useLogout } from "../../hooks/useLogout";
import { useAuth } from "../../hooks/useAuth";

export default function TopNavbar() {
  const { isLoggedIn, username } = useAuth();
  const handleLogout = useLogout();
  const [y, setY] = useState(window.scrollY);
  const [sidebarOpen, toggleSidebar] = useState(false);

  const history = useHistory();

  useEffect(() => {
    const handleScroll = () => setY(window.scrollY);
    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [y]);

  return (
    <>
      <Sidebar sidebarOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
      {sidebarOpen && <Backdrop toggleSidebar={toggleSidebar} />}
      <Wrapper className="flexCenter animate">
        <NavInner className="container flexSpaceCenter">
          <LogoWrapper to="/">
            <img src={Logo} alt="Espaço Cuidar Logo" />
            <h1 className="font20 extraBold">Espaço Cuidar</h1>
          </LogoWrapper>

          <BurderWrapper onClick={() => toggleSidebar(!sidebarOpen)}>
            <BurgerIcon />
          </BurderWrapper>

          <NavLinks>
            {isLoggedIn ? (
              <>

              <NavItem>
                <NavButton type="button" onClick={history.goBack}>
                  Voltar
                </NavButton>
              </NavItem>
              
              <NavItem>
                <RouterLink to="/menu">Menu</RouterLink>
              </NavItem>

              <NavItem>
                <RouterLink onClick={(e) => handleLogout(e)}>
                  Sair
                </RouterLink>
              </NavItem>

              <UserInfo>
                <span>Bem-vindo, {username}</span>
              </UserInfo>
              </>
            ) : ""}

          </NavLinks>
        </NavInner>
      </Wrapper>
    </>
  );
}

// Styled Components

const Wrapper = styled.nav`
  width: 100%;
  background: #ffffff;
  border-bottom: 1px solid rgba(106, 121, 92, 0.12);
  position: fixed;
  top: 0;
  left: 0;
  z-index: 999;
  height: 80px;
`;

const LogoWrapper = styled(RouterLink)`
  display: flex;
  align-items: center;
  margin-right: 15px;

  img {
    height: 40px;
    margin-right: 15px;
  }

  h1 {
    color: #A2B190;
  }
`;

const BurderWrapper = styled.button`
  outline: none;
  border: 0;
  background-color: transparent;
  height: 100%;
  padding: 0 15px;
  display: none;

  @media (max-width: 760px) {
    display: block;
  }
`;

const NavInner = styled.div`
  position: relative;
  height: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const NavLinks = styled.ul`
  display: flex;
  list-style-type: none;
  margin: 0;
  padding: 0;
  align-items: center;
  @media (max-width: 760px) {
    display: none;
  }
`;

const NavItem = styled.li`
  margin: 0px 15px;
  align-items: center;

  a,
  button {
    color: #6a795c;
    font-weight: 600;
  }
`;

const UserInfo = styled.div`
  padding: 10px;
  font-size: 18px;
  color: #1b1b1b;
`;


const NavButton = styled.button`
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: #6a795c;
  font-weight: 600;
`;
