import React from "react";
import { FaWhatsapp, FaInstagram } from "react-icons/fa";
import { HeroSection, LeftColumn, RightColumn, StyledButton } from "./styled";
import maintenanceImage from "../../components/images/chaves.jpg";

export default function Contato() {
  return (
    <HeroSection>
      <LeftColumn>
        <h1>Mande uma mensagem!</h1>

        <StyledButton
          href="https://wa.me/5527997448834?text=Olá%20Checkpoint%2C%20gostaria%20de%20mais%20informações.
"
          target="_blank"
        >
          <FaWhatsapp size={20} style={{ marginRight: "8px" }} />
          WhatsApp
        </StyledButton>

        <StyledButton
          href="https://www.instagram.com/checkpoint.si/"
          target="_blank"
          bgColor="none"
          bgImage="linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)"
          hoverImage="linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)"
        >
          <FaInstagram size={20} style={{ marginRight: "8px" }} />
          Instagram
        </StyledButton>
      </LeftColumn>
      <RightColumn>
        <img src={maintenanceImage} alt="Serviços de Manutenção" />
      </RightColumn>
    </HeroSection>
  );
}
