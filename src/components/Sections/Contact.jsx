/* eslint-disable jsx-a11y/label-has-associated-control */
import React from "react";
import styled from "styled-components";
// Assets
import { FaWhatsapp, FaInstagram } from "react-icons/fa";
// import ContactImg1 from "../../assets/img/contact-1.png";
// import ContactImg2 from "../../assets/img/contact-2.png";
// import ContactImg3 from "../../assets/img/contact-3.png";

export default function Contact() {
  return (
    <Wrapper id="contact">
      <div className="lightBg">
        <div className="container">
          <HeaderInfo>
            <h1 className="font40 extraBold">Contatos</h1>
          </HeaderInfo>
          <div className="row" style={{ paddingBottom: "30px" }}>
            <div className="col-xs-12 col-sm-12 col-md-6 col-lg-6">
            <ButtonRow>
              <div style={{ textAlign: "center" }}>
                <Button
                  href="https://wa.me/5527988252557?text=Olá%20EspacoCuidar%2C%20gostaria%20de%20mais%20informações."
                  target="_blank"
                  style={{background: 'transparent'}}
                >
                  <FaWhatsapp size={24} color="#25D366" />
                </Button>
                <span>55 27 99999-9999</span> {/* Número abaixo do ícone do WhatsApp */}
              </div>

              <div style={{ textAlign: "center" }}>
                <Button
                  href="https://www.instagram.com/multifisioreabilitacao/"
                  target="_blank"
                  style={{background: 'transparent'}}
                >
                  <FaInstagram size={24} color="#E1306C" />
                </Button>
                <span>Instagram</span> {/* Texto abaixo do ícone do Instagram */}
              </div>
            </ButtonRow>
              <p style={{ textAlign: 'center'}}>
                Rua Marquês de Monte Alegre - nº 5, Jardim da Penha, Vitória - ES.
              </p>
            </div>
            <div className="col-xs-12 col-sm-12 col-md-6 col-lg-6 flex">
              {/* <div
                style={{ width: "50%" }}
                className="flexNullCenter flexColumn"
              >
                <ContactImgBox>
                  <img src={ContactImg1} alt="office" className="radius6" />
                </ContactImgBox>
                <ContactImgBox>
                  <img src={ContactImg2} alt="office" className="radius6" />
                </ContactImgBox>
              </div>
              <div style={{ width: "50%" }}>
                <div style={{ marginTop: "100px" }}>
                  <img src={ContactImg3} alt="office" className="radius6" />
                </div> */}
              {/* </div> */}
            </div>
          </div>
        </div>
      </div>
    </Wrapper>
  );
}

// Estilização permanece a mesma

const Wrapper = styled.section`
  width: 100%;
`;
const HeaderInfo = styled.div`
  padding: 70px 0 30px 0;
  @media (max-width: 860px) {
    text-align: center;
  }
`;

// const ContactImgBox = styled.div`
//   max-width: 180px;
//   align-self: flex-end;
//   margin: 10px 30px 10px 0;
// `;

const ButtonRow = styled.div`
  display: flex;
  justify-content: center;
  gap: 28px;
  margin: 20px 0 10px;
  flex-wrap: wrap;
`;

const Button = styled.a`
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 10px;
  padding: 18px 22px;
  border-radius: 10px;
  background-color: #fff;
  color: #1b1b1b;
  text-decoration: none;
  font-size: 18px;
  border: 1px solid rgba(106, 121, 92, 0.25);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  transition: transform 0.2s ease, box-shadow 0.2s ease,
    background-color 0.2s ease;

  &:hover {
    background-color: #f3f5f1;
    transform: translateY(-2px);
    box-shadow: 0 10px 22px rgba(0, 0, 0, 0.12);
  }

  svg {
    width: 60px;  /* Aumente o tamanho do ??cone */
    height: 60px; /* Aumente o tamanho do ??cone */
    margin-right: 8px; /* Espa??o entre ??cone e texto */
  }
`;

