import React from "react";
import styled from "styled-components";
import ServiceBox from "../Elements/ServiceBox";
import { usePublicClinicContext } from "../../contexts/PublicClinicContext";

const defaultServices = {
  title: "Recursos principais",
  items: [
    {
      icon: "physio",
      title: "Agenda",
      subtitle: "Organização dos atendimentos",
    },
    {
      icon: "pilates",
      title: "Pacientes",
      subtitle: "Cadastro e histórico clínico",
    },
    {
      icon: "functional",
      title: "Financeiro",
      subtitle: "Receitas e recebimentos",
    },
  ],
};

const defaultAbout = {
  title: "Sobre o sistema",
  paragraphs: [
    "Plataforma para centralizar a operação de clínicas em um ambiente seguro, com dados separados por clínica e fluxos essenciais para a rotina administrativa.",
    "Antes do login, a experiência permanece neutra. Após autenticação, o sistema carrega a identidade visual da clínica vinculada ao usuário.",
  ],
  cards: [
    "Isolamento por clínica",
    "Contexto carregado após login",
    "Base preparada para white label",
  ],
};

export default function Services() {
  const { publicClinic } = usePublicClinicContext();
  const publicProfile = publicClinic.public_profile;
  const servicesTitle = publicProfile?.services_title || defaultServices.title;
  const services = publicProfile?.services || defaultServices.items;
  const aboutTitle = publicProfile?.about_title || defaultAbout.title;
  const aboutText = publicProfile?.about_text || defaultAbout.paragraphs;
  const aboutImage = publicProfile?.about_image_url || null;
  const aboutImages = publicProfile?.about_image_urls || null;
  let aboutVisual = (
    <AddRightInner>
      {defaultAbout.cards.map((card) => (
        <InfoCard key={card}>{card}</InfoCard>
      ))}
    </AddRightInner>
  );

  if (aboutImages && aboutImages.length >= 4) {
    aboutVisual = (
      <AddRightInner>
        <div className="flexNullCenter">
          <AddImgWrapp1 className="flexCenter">
            <img src={aboutImages[0]} alt={`${aboutTitle} 1`} />
          </AddImgWrapp1>
          <AddImgWrapp2>
            <img src={aboutImages[1]} alt={`${aboutTitle} 2`} />
          </AddImgWrapp2>
        </div>
        <div className="flexNullCenter">
          <AddImgWrapp3>
            <img src={aboutImages[2]} alt={`${aboutTitle} 3`} />
          </AddImgWrapp3>
          <AddImgWrapp4>
            <img src={aboutImages[3]} alt={`${aboutTitle} 4`} />
          </AddImgWrapp4>
        </div>
      </AddRightInner>
    );
  }

  if (aboutImage) {
    aboutVisual = (
      <AboutImagePanel>
        <img src={aboutImage} alt={aboutTitle} />
      </AboutImagePanel>
    );
  }

  return (
    <Wrapper id="services">
      <div className="whiteBg" style={{ padding: "60px 0" }}>
        <div className="container">
          <HeaderInfo>
            <h1 className="font40 extraBold">{servicesTitle}</h1>
          </HeaderInfo>
          <ServiceBoxRow className="flex">
            {services.map((service) => (
              <ServiceBoxWrapper key={service.title} $count={services.length}>
                <ServiceBox
                  icon={service.icon}
                  title={service.title}
                  subtitle={service.subtitle}
                />
              </ServiceBoxWrapper>
            ))}
          </ServiceBoxRow>
        </div>
        <div className="lightBg">
          <div className="container">
            <Advertising className="flexSpaceCenter">
              <AddLeft>
                <h2 className="font40 extraBold">{aboutTitle}</h2>
                {aboutText.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="font13"
                    style={{ textAlign: "justify", marginBottom: "12px" }}
                  >
                    {paragraph}
                  </p>
                ))}
              </AddLeft>
              <AddRight>{aboutVisual}</AddRight>
            </Advertising>
          </div>
        </div>
      </div>
    </Wrapper>
  );
}

const Wrapper = styled.section`
  width: 100%;
`;
const ServiceBoxRow = styled.div`
  gap: 5%;
  flex-wrap: wrap;
  @media (max-width: 860px) {
    flex-direction: column;
  }
`;
const ServiceBoxWrapper = styled.div`
  width: ${(props) => (props.$count === 1 ? "320px" : "20%")};
  max-width: 100%;
  padding: 80px 0;
  @media (max-width: 860px) {
    width: 100%;
    text-align: center;
    padding: 40px 0;
  }
`;
const HeaderInfo = styled.div`
  @media (max-width: 860px) {
    text-align: center;
  }
`;
const Advertising = styled.div`
  margin: 80px 0;
  padding: 100px 0;
  position: relative;
  @media (max-width: 1160px) {
    padding: 100px 0 40px 0;
  }
  @media (max-width: 860px) {
    flex-direction: column;
    padding: 0 0 30px 0;
    margin: 80px 0 0px 0;
  }
`;
const AddLeft = styled.div`
  width: 50%;
  p {
    max-width: 475px;
  }
  @media (max-width: 860px) {
    width: 80%;
    order: 2;
    text-align: center;
    h2 {
      line-height: 3rem;
      margin: 15px 0;
    }
    p {
      margin: 0 auto;
    }
  }
`;
const AddRight = styled.div`
  width: 50%;
  position: absolute;
  top: -70px;
  right: 0;
  @media (max-width: 860px) {
    width: 80%;
    position: relative;
    order: 1;
    top: -40px;
  }
`;
const AddRightInner = styled.div`
  width: 100%;
  display: grid;
  gap: 14px;
`;
const AboutImagePanel = styled.div`
  width: min(520px, 100%);
  min-height: 420px;
  margin-left: auto;
  border-radius: 8px;
  background: #fff;
  border: 1px solid rgba(6, 67, 51, 0.12);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;

  img {
    width: 100%;
    max-height: 360px;
    object-fit: contain;
  }

  @media (max-width: 860px) {
    min-height: 300px;
    margin: 0 auto;
    padding: 28px;
  }
`;
const InfoCard = styled.div`
  min-height: 82px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid rgba(106, 121, 92, 0.16);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  padding: 0 24px;
  color: var(--public-secondary-color, #3d5230);
  font-weight: 800;
`;
const AddImgWrapp1 = styled.div`
  width: 48%;
  margin: 0 6% 10px 6%;
  img {
    width: 100%;
    height: auto;
    border-radius: 1rem;
    box-shadow: 0 2px 15px rgba(0, 0, 0, 0.3);
  }
`;
const AddImgWrapp2 = styled.div`
  width: 30%;
  margin: 0 5% 10px 5%;
  img {
    width: 100%;
    height: auto;
    border-radius: 1rem;
    box-shadow: 0 2px 15px rgba(0, 0, 0, 0.3);
  }
`;
const AddImgWrapp3 = styled.div`
  width: 20%;
  margin-left: 40%;
  img {
    width: 100%;
    height: auto;
    border-radius: 1rem;
    box-shadow: 0 2px 15px rgba(0, 0, 0, 0.3);
  }
`;
const AddImgWrapp4 = styled.div`
  width: 30%;
  margin: 0 5% auto;
  img {
    width: 100%;
    height: auto;
    border-radius: 1rem;
    box-shadow: 0 2px 15px rgba(0, 0, 0, 0.3);
  }
`;
