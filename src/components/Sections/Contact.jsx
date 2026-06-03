/* eslint-disable jsx-a11y/label-has-associated-control */
import React from "react";
import styled from "styled-components";
import { FaInstagram, FaLock, FaUserShield, FaWhatsapp } from "react-icons/fa";
import { getClinicPublicProfile } from "../../config/clinicPublicProfiles";
import productIdentity from "../../config/productIdentity";
import { usePublicClinicContext } from "../../contexts/PublicClinicContext";

function buildWhatsappHref(contactWhatsapp) {
  if (!contactWhatsapp) return null;
  if (/^https?:\/\//i.test(contactWhatsapp)) return contactWhatsapp;

  const digits = contactWhatsapp.replace(/\D/g, "");
  if (!digits) return null;

  const normalized = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${normalized}`;
}

export default function Contact() {
  const { publicClinic } = usePublicClinicContext();
  const publicProfile = getClinicPublicProfile(publicClinic.clinic_id);
  const hasPublicContact = Boolean(publicProfile);
  const whatsappHref = buildWhatsappHref(publicProfile?.contact_whatsapp);

  return (
    <Wrapper id="contact">
      <div className="lightBg">
        <div className="container">
          <HeaderInfo>
            <h1 className="font40 extraBold">
              {publicProfile?.contact_title || "Acesso ao sistema"}
            </h1>
          </HeaderInfo>
          <div className="row" style={{ paddingBottom: "30px" }}>
            <div className="col-xs-12 col-sm-12 col-md-6 col-lg-6">
              {hasPublicContact ? (
                <>
                  <ButtonRow>
                    <div style={{ textAlign: "center" }}>
                      {whatsappHref ? (
                        <Button
                          href={whatsappHref}
                          target="_blank"
                          rel="noreferrer"
                          style={{ background: "transparent" }}
                        >
                          <FaWhatsapp size={24} color="#25D366" />
                        </Button>
                      ) : (
                        <InfoBadge>
                          <FaWhatsapp size={24} color="#25D366" />
                        </InfoBadge>
                      )}
                      <span>{publicProfile.contact_phone}</span>
                    </div>

                    <div style={{ textAlign: "center" }}>
                      {publicProfile.contact_instagram ? (
                        <Button
                          href={publicProfile.contact_instagram}
                          target="_blank"
                          rel="noreferrer"
                          style={{ background: "transparent" }}
                        >
                          <FaInstagram size={24} color="#E1306C" />
                        </Button>
                      ) : (
                        <InfoBadge>
                          <FaInstagram size={24} color="#E1306C" />
                        </InfoBadge>
                      )}
                      <span>{publicProfile.contact_instagram_label}</span>
                    </div>
                  </ButtonRow>
                  <p style={{ textAlign: "center" }}>
                    {publicProfile.contact_address}
                  </p>
                </>
              ) : (
                <>
                  <ButtonRow>
                    <div style={{ textAlign: "center" }}>
                      <InfoBadge>
                        <FaLock size={24} />
                      </InfoBadge>
                      <span>Login seguro</span>
                    </div>

                    <div style={{ textAlign: "center" }}>
                      <InfoBadge>
                        <FaUserShield size={24} />
                      </InfoBadge>
                      <span>Dados por clínica</span>
                    </div>
                  </ButtonRow>
                  <p style={{ textAlign: "center" }}>
                    {productIdentity.supportText}
                  </p>
                </>
              )}
            </div>
            <div className="col-xs-12 col-sm-12 col-md-6 col-lg-6 flex" />
          </div>
        </div>
      </div>
    </Wrapper>
  );
}

const Wrapper = styled.section`
  width: 100%;
`;
const HeaderInfo = styled.div`
  padding: 70px 0 30px 0;
  @media (max-width: 860px) {
    text-align: center;
  }
`;
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
    width: 60px;
    height: 60px;
    margin-right: 8px;
  }
`;
const InfoBadge = styled.div`
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
  cursor: default;

  svg {
    width: 60px;
    height: 60px;
    margin-right: 8px;
    color: var(--public-primary-color, #6a795c);
  }
`;
