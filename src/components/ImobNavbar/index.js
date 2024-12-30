import React from "react";
import { Link } from "react-router-dom";
import { useLogout } from "../../hooks/useLogout";
import { useAuth } from "../../hooks/useAuth";
import { Nav } from "./styled";
import logo from "../Images/CheckPoint.jpg";

export default function Header() {
  const { isLoggedIn, username } = useAuth();
  const handleLogout = useLogout();

  return (
    <Nav>
      <div className="brand">
        <img className="logo" src={logo} alt="Logo" />
      </div>

      <div className="navigation">
        <Link to="/">Home</Link>

        {/* Renderização condicional com base no login */}
        {isLoggedIn ? (
          <>
            <Link to="/menu">Menu</Link>
            <button type="submit" onClick={(e) => handleLogout(e)}>
              Sair
            </button>
          </>
        ) : (
          <Link to="/login">Entrar</Link>
        )}

        {/* Exibe o nome do usuário se estiver logado */}
        {isLoggedIn && (
          <div className="user-info">
            <span>Bem-vindo, {username}</span>
          </div>
        )}
      </div>
    </Nav>
  );
}
