import React from "react";
import styled from "styled-components";
import QuotesIcon from "../../assets/svg/Quotes";
import Dots from "../../assets/svg/Dots";
import { getClinicPublicProfile } from "../../config/clinicPublicProfiles";
import productIdentity from "../../config/productIdentity";
import { usePublicClinicContext } from "../../contexts/PublicClinicContext";

export default function Header() {
  const { displayName, publicClinic } = usePublicClinicContext();
  const publicProfile = getClinicPublicProfile(publicClinic.clinic_id);

  return (
    <Wrapper id="home" className="container flexSpaceCenter">
      <LeftSide className="flexCenter">
        <div>
          <h1 className="extraBold font60">
            {publicProfile?.hero_title || displayName}
          </h1>
          <HeaderP className="font13 semiBold" style={{ textAlign: "justify" }}>
            {publicProfile?.hero_subtitle || productIdentity.subtitle}
          </HeaderP>
        </div>
      </LeftSide>
      <RightSide>
        <ImageWrapper>
          {publicProfile?.hero_image_url ? (
            <Img
              className="radius8"
              src={publicProfile.hero_image_url}
              alt={displayName}
              style={{ zIndex: 9 }}
            />
          ) : (
            <ProductPanel className="radius8" style={{ zIndex: 9 }}>
              <PanelTitle>Gestão operacional</PanelTitle>
              <PanelItem>Agenda integrada</PanelItem>
              <PanelItem>Cadastro de pacientes</PanelItem>
              <PanelItem>Controle financeiro</PanelItem>
            </ProductPanel>
          )}
          <QuoteWrapper className="flexCenter darkBg radius8">
            <QuotesWrapper>
              <QuotesIcon />
            </QuotesWrapper>
            <div>
              <p className="font15 whiteColor">
                <em>
                  {publicProfile?.hero_quote || "Organize a rotina da clínica com dados consistentes e acesso seguro."}
                </em>
              </p>
              <p
                className="font13 textRight"
                style={{
                  color: "var(--public-accent-color, #A2B190)",
                  marginTop: "10px",
                }}
              >
                {publicProfile?.hero_quote_author || "Plataforma multi-clínica"}
              </p>
            </div>
          </QuoteWrapper>
          <DotsWrapper>
            <Dots />
          </DotsWrapper>
        </ImageWrapper>
        <GreyDiv className="lightBg" />
      </RightSide>
    </Wrapper>
  );
}

const Wrapper = styled.section`
  padding-top: 80px;
  width: 100%;
  min-height: 840px;
  @media (max-width: 960px) {
    flex-direction: column;
  }
`;
const LeftSide = styled.div`
  width: 50%;
  height: 100%;
  @media (max-width: 960px) {
    width: 100%;
    order: 2;
    margin: 50px 0;
    text-align: center;
  }
  @media (max-width: 560px) {
    margin: 80px 0 50px 0;
  }
`;
const RightSide = styled.div`
  width: 50%;
  height: 100%;
  @media (max-width: 960px) {
    width: 100%;
    order: 1;
    margin-top: 30px;
  }
`;
const HeaderP = styled.div`
  max-width: 470px;
  padding: 15px 0 50px 0;
  line-height: 1.5rem;
  @media (max-width: 960px) {
    padding: 15px 0 50px 0;
    text-align: center;
    max-width: 100%;
  }
`;
const GreyDiv = styled.div`
  width: 30%;
  height: 700px;
  position: absolute;
  top: 0;
  right: 0;
  z-index: 0;
  background: linear-gradient(180deg, #F7F8F4 0%, color-mix(in srgb, var(--public-primary-color, #6a795c) 14%, #fff) 100%);
  border-left: 1px solid rgba(106, 121, 92, 0.12);
  @media (max-width: 960px) {
    display: none;
  }
`;
const ImageWrapper = styled.div`
  display: flex;
  justify-content: flex-end;
  position: relative;
  z-index: 9;
  @media (max-width: 960px) {
    width: 100%;
    justify-content: center;
  }
`;
const Img = styled.img`
  @media (max-width: 560px) {
    width: 80%;
    height: auto;
  }
`;
const ProductPanel = styled.div`
  width: min(460px, 100%);
  min-height: 360px;
  padding: 42px;
  background: #fff;
  border: 1px solid rgba(106, 121, 92, 0.16);
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 16px;
  @media (max-width: 560px) {
    width: 80%;
    min-height: 300px;
    padding: 28px;
  }
`;
const PanelTitle = styled.h2`
  font-size: 1.6rem;
  color: #1b1b1b;
`;
const PanelItem = styled.div`
  padding: 14px 16px;
  border-radius: 8px;
  background: #f7f8f4;
  color: var(--public-secondary-color, #3d5230);
  font-weight: 700;
`;
const QuoteWrapper = styled.div`
  position: absolute;
  left: 0;
  bottom: 50px;
  max-width: 330px;
  padding: 30px;
  z-index: 99;
  @media (max-width: 960px) {
    left: 20px;
  }
  @media (max-width: 560px) {
    bottom: -50px;
  }
`;
const QuotesWrapper = styled.div`
  position: absolute;
  left: -20px;
  top: -10px;
`;
const DotsWrapper = styled.div`
  position: absolute;
  right: -100px;
  bottom: 100px;
  z-index: 2;
  @media (max-width: 960px) {
    right: 100px;
  }
  @media (max-width: 560px) {
    display: none;
  }
`;
