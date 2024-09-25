import React from "react";
import { HeroSection, LeftColumn, RightColumn, StyledLink } from "./styled";
import maintenanceImage from "../../components/images/Anderson.jpeg";

export default function Prestador() {
  return (
    <HeroSection>
      <LeftColumn>
        <h1>
          Seja um parceiro da Checkpoint <span>&#10004;</span>
        </h1>
        <p>Nós te preparamos para atuar na parceria com os inquilinos!</p>

        <StyledLink to="/contato">Enviar uma mensagem</StyledLink>
      </LeftColumn>
      <RightColumn>
        <img src={maintenanceImage} alt="Serviços de Manutenção" />
      </RightColumn>
    </HeroSection>
  );
}
