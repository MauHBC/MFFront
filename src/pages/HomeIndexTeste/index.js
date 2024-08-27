import React from "react";
import { HeroSection, LeftColumn, RightColumn, StyledLink } from "./styled";
import maintenanceImage from "../../components/images/Anderson.jpeg";

export default function HomeIndexTeste() {
  return (
    <HeroSection>
      <LeftColumn>
        {/* <h1>
          Soluções imobiliárias? Dê um Check <span>&#10004;</span>, CheckPoint
        </h1> */}
        <h1>
          TESTE <span>&#10004;</span>, CheckPoint.
        </h1>
        <p>
          Alugou um apartamento e vai se mudar? Facilitamos essa nova fase com
          mais segurança e conforto na locação, conte-nos sua história!
        </p>
        <StyledLink to="/register">Contratar serviço</StyledLink>
        {/* <StyledLink to="/register">Torne-se um Parceiro</StyledLink> */}
      </LeftColumn>
      <RightColumn>
        <img src={maintenanceImage} alt="Serviços de Manutenção" />
      </RightColumn>
    </HeroSection>
  );
}
