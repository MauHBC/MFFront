import React from "react";
import { Link } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import * as actions from "../../store/modules/auth/actions";
import { Nav } from "./styled";
import logo from "../images/CheckPoint.jpg";
import history from "../../services/history";

export default function Header() {
  const dispatch = useDispatch();
  const isLoggedIn = useSelector((state) => state.auth.isLoggedIn);
  const username = useSelector((state) =>
    state.auth.user ? state.auth.user.name : "",
  );

  function handleLogout(e) {
    e.preventDefault();
    dispatch(actions.loginFailure());
    history.push("/");
  }

  return (
    <Nav>
      <div className="brand">
        <img className="logo" src={logo} alt="Logo" />
      </div>

      {/* <button type="submit" className="hamburguer-menu" onClick={toggleMenu}>
        ☰
      </button> */}

      <div className="navigation">
        <Link to="/">Home</Link>
        {isLoggedIn ? (
          <>
            <Link to="/menu">Menu</Link>
            <button type="submit" onClick={(e) => handleLogout(e)}>
              Sair
            </button>
          </>
        ) : (
          <>
            {/* <Link to="/register">Registrar</Link> */}
            <Link to="/login">Entrar</Link>
          </>
        )}
        {isLoggedIn && (
          <div className="user-info">
            <span>Bem-vindo, {username}</span>
          </div>
        )}
      </div>
    </Nav>
  );
}
