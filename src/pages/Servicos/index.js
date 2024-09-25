import React from "react";
import { HeroSection, LeftColumn, RightColumn, StyledLink } from "./styled";
import maintenanceImage from "../../components/images/image2.jpg";

export default function Servicos() {
  return (
    <HeroSection>
      <LeftColumn>
        <h1>Quem somos</h1>
        <p>
          Somos uma empresa que tem o objetivo de resguardar o inquilino no
          inicio, durante e no final da sua locação.
        </p>

        <h1>Para inquilinos</h1>

        <h2>
          Check-in <span>&#10004;</span>
        </h2>
        <p>
          Realizamos a `contra-vistoria` para o inquilino que acabou de alugar
          um imóvel e recebeu uma vistoria da imobiliária.
        </p>

        <h2>
          Check-up <span>&#10004;</span>
        </h2>
        <p>
          Está há mais de um ano no imóvel alugado? Então está na hora de fazer
          uma verificação da saúde da sua locação.
        </p>

        <h2>
          Check-out <span>&#10004;</span>
        </h2>
        <p>
          Nós te preparamos para a desocupação do imóvel. Orientamos o inquilino
          sobre suas responsabilidades e o que ele precisa fazer para evitar
          cobranças indevidas!
        </p>

        <h3>Manutenções</h3>
        <p>
          Realizamos manutenção no momento da verificação dependendo da
          situação.
        </p>

        <h3>Laudos</h3>
        <p>
          Todos os nossos serviços são realizados com nosso app, registrado com
          fotos e vídeos e enviado ao cliente.
        </p>
        <StyledLink to="/contato">Contratar</StyledLink>
      </LeftColumn>
      <RightColumn>
        <img src={maintenanceImage} alt="Serviços de Manutenção" />
      </RightColumn>
    </HeroSection>
  );
}
