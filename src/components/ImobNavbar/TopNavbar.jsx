import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { Link as RouterLink, useHistory, useLocation } from "react-router-dom";

// Components
import Sidebar from "./Sidebar";
import Backdrop from "../Elements/Backdrop";
import TenantLoading from "../TenantLoading";

import BurgerIcon from "../../assets/svg/BurgerIcon";

// Hooks
import { useLogout } from "../../hooks/useLogout";
import { useAuth } from "../../hooks/useAuth";
import { useClinicContext } from "../../contexts/ClinicContext";
import { usePublicClinicContext } from "../../contexts/PublicClinicContext";

export default function TopNavbar() {
  const { isLoggedIn, username } = useAuth();
  const location = useLocation();
  const isPlatformRoute = location.pathname.startsWith("/platform");
  const {
    displayName: clinicName,
    loaded: clinicLoaded,
    loading: clinicLoading,
    logoSrc: clinicLogoSrc,
    brandInitials: clinicInitials,
  } = useClinicContext();
  const {
    displayName: publicName,
    loaded: publicLoaded,
    loading: publicLoading,
    logoSrc: publicLogoSrc,
  } = usePublicClinicContext();
  let displayName = publicName;
  let logoSrc = publicLogoSrc;
  let brandLoading = publicLoading || !publicLoaded;
  let brandInitials = "SG";

  if (isLoggedIn) {
    displayName = clinicName;
    logoSrc = clinicLogoSrc;
    brandLoading = clinicLoading || !clinicLoaded;
    brandInitials = clinicInitials;
  }

  if (isPlatformRoute) {
    displayName = "Painel SaaS";
    logoSrc = null;
    brandLoading = false;
    brandInitials = "SaaS";
  }

  let brandMark = (
    <NeutralMark aria-hidden="true" $publicMode={!isLoggedIn} $platformMode={isPlatformRoute}>
      {brandInitials}
    </NeutralMark>
  );

  if (brandLoading) {
    brandMark = <TenantLoading compact />;
  } else if (logoSrc) {
    brandMark = <img src={logoSrc} alt={`${displayName} Logo`} />;
  }

  const handleLogout = useLogout();
  const [y, setY] = useState(window.scrollY);
  const [sidebarOpen, toggleSidebar] = useState(false);

  const history = useHistory();
  let authenticatedLinks = null;

  if (isLoggedIn) {
    authenticatedLinks = (
      <>
        {isPlatformRoute ? (
          <NavItem>
            <RouterLink to="/menu">Voltar ao sistema</RouterLink>
          </NavItem>
        ) : (
          <>
            <NavItem>
              <NavButton type="button" onClick={history.goBack}>
                Voltar
              </NavButton>
            </NavItem>

            <NavItem>
              <RouterLink to="/menu">Menu</RouterLink>
            </NavItem>
          </>
        )}

        <NavItem>
          <RouterLink onClick={(e) => handleLogout(e)}>
            Sair
          </RouterLink>
        </NavItem>

        <UserInfo>
          <span>Bem-vindo, {username}</span>
        </UserInfo>
      </>
    );
  }

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
      <Wrapper className="flexCenter animate" $platformMode={isPlatformRoute}>
        <NavInner className="container flexSpaceCenter">
          <LogoWrapper to={isPlatformRoute ? "/menu" : "/"} $publicMode={!isLoggedIn} $platformMode={isPlatformRoute}>
            {brandMark}
            {!brandLoading && (
              <BrandText>
                <h1 className="font20 extraBold">{displayName}</h1>
                {isPlatformRoute && <small>Admin interno</small>}
              </BrandText>
            )}
          </LogoWrapper>

          <BurderWrapper onClick={() => toggleSidebar(!sidebarOpen)}>
            <BurgerIcon />
          </BurderWrapper>

          <NavLinks $platformMode={isPlatformRoute}>
            {authenticatedLinks}
          </NavLinks>
        </NavInner>
      </Wrapper>
    </>
  );
}

// Styled Components

function getLogoTitleColor(props) {
  if (props.$platformMode) return "#111827";
  if (props.$publicMode) return "var(--public-accent-color, #A2B190)";
  return "var(--clinic-accent-color, #A2B190)";
}

function getNeutralMarkBackground(props) {
  if (props.$platformMode) return "#2563eb";
  if (props.$publicMode) return "var(--public-primary-color, #6a795c)";
  return "var(--clinic-primary-color, #6a795c)";
}

const Wrapper = styled.nav`
  width: 100%;
  background: ${({ $platformMode }) => ($platformMode ? "rgba(255, 255, 255, 0.92)" : "#ffffff")};
  backdrop-filter: ${({ $platformMode }) => ($platformMode ? "blur(14px)" : "none")};
  border-bottom: 1px solid ${({ $platformMode }) => ($platformMode ? "rgba(148, 163, 184, 0.18)" : "rgba(106, 121, 92, 0.12)")};
  position: fixed;
  top: 0;
  left: 0;
  z-index: 999;
  height: 80px;
  box-shadow: ${({ $platformMode }) => ($platformMode ? "0 10px 30px rgba(15, 23, 42, 0.04)" : "none")};
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
    color: ${getLogoTitleColor};
  }
`;

const NeutralMark = styled.span`
  width: ${(props) => (props.$platformMode ? "48px" : "40px")};
  height: 40px;
  margin-right: 15px;
  border-radius: ${(props) => (props.$platformMode ? "12px" : "8px")};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: ${getNeutralMarkBackground};
  color: #fff;
  font-size: ${(props) => (props.$platformMode ? "0.78rem" : "1rem")};
  font-weight: 800;
  letter-spacing: 0;
  box-shadow: ${(props) => (props.$platformMode ? "0 10px 22px rgba(37, 99, 235, 0.18)" : "none")};
`;

const BrandText = styled.span`
  display: grid;
  gap: 2px;

  small {
    color: #64748b;
    font-size: 0.72rem;
    font-weight: 800;
    line-height: 1;
    text-transform: uppercase;
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

  a,
  button {
    color: ${({ $platformMode }) => ($platformMode ? "#334155" : "var(--clinic-primary-color, #6a795c)")};
    font-weight: ${({ $platformMode }) => ($platformMode ? "700" : "600")};
    font-size: ${({ $platformMode }) => ($platformMode ? "0.94rem" : "inherit")};
  }

  @media (max-width: 760px) {
    display: none;
  }
`;

const NavItem = styled.li`
  margin: 0px 15px;
  align-items: center;

  a,
  button {
    color: inherit;
    font-weight: inherit;
    font-size: inherit;
  }
`;

const UserInfo = styled.div`
  padding: 10px;
  font-size: 0.94rem;
  color: #64748b;
  font-weight: 650;
`;


const NavButton = styled.button`
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: var(--clinic-primary-color, #6a795c);
  font-weight: 600;
`;
