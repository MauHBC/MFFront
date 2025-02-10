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
                  href="https://wa.me/5527988252557?text=Olá%20Checkpoint%2C%20gostaria%20de%20mais%20informações."
                  target="_blank"
                  style={{background: 'transparent'}}
                >
                  <FaWhatsapp size={24} color="#25D366" />
                </Button>
                <span>55 27 988252557</span> {/* Número abaixo do ícone do WhatsApp */}
              </div>

              <div style={{ textAlign: "center" }}>
                <Button
                  href="https://www.instagram.com/checkpoint.si/"
                  target="_blank"
                  style={{background: 'transparent'}}
                >
                  <FaInstagram size={24} color="#E1306C" />
                </Button>
                <span>Instagram</span> {/* Texto abaixo do ícone do Instagram */}
              </div>
            </ButtonRow>
              <p style={{ textAlign: 'center'}}>
                <p>Espírito Santo</p> {/* Novo texto adicionado */}
                Atendemos nas cidades de: Vitória, Vila Velha, Serra e Cariacica.
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
  margin: 20px 0;
`;

const Button = styled.a`
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 10px;
  padding: 15px 20px;
  border-radius: 6px;
  background-color: #f0f0f0;
  color: #333;
  text-decoration: none;
  font-size: 18px;

  &:hover {
    background-color: #e0e0e0;
  }

  svg {
    width: 60px;  /* Aumente o tamanho do ícone */
    height: 60px; /* Aumente o tamanho do ícone */
    margin-right: 8px; /* Espaço entre ícone e texto */
  }
`;
