import React from "react";
import { HeroSection, LeftColumn, RightColumn, StyledLink } from "./styled";
import maintenanceImage from "../../components/images/image1.jpg";

export default function HomeIndex() {
  return (
    <HeroSection>
      <LeftColumn>
        <h1>
          A empresa parceira dos inquilinos <span>&#10004;</span>
        </h1>
        <p>
          Focada em proteger seus interesses durante o processo de locação. Não
          ajudamos a encontrar imóveis, mas sim, garantimos uma contra-vistoria
          que resguarda você dos riscos da vistoria da imobiliária.
        </p>

        <StyledLink to="/contato">Fale conosco</StyledLink>
      </LeftColumn>
      <RightColumn>
        <img src={maintenanceImage} alt="Serviços de Manutenção" />
      </RightColumn>
    </HeroSection>
  );
}
