import React from "react";
import { Link } from "react-router-dom";
import { FaClipboardList, FaBuilding, FaFileAlt } from "react-icons/fa";

import { Container } from "../../styles/GlobalStyles";
import { HomeContainer } from "./styled";

export default function Menu() {
  return (
    <Container>
      <HomeContainer>
        <div className="titulo">
          <h1>Menu</h1>
        </div>
        <Link to="/agendamentos">
          <FaClipboardList size={24} />
          <span>Agenda</span>
        </Link>
        <Link to="/imoveis">
          <FaBuilding size={24} />
          <span>Imóveis</span>
        </Link>
        <Link to="/laudos">
          <FaFileAlt size={24} />
          <span>Laudos</span>
        </Link>
      </HomeContainer>
    </Container>
  );
}
