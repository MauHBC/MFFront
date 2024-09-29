import React from "react";
import styled from "styled-components";
import { FaCheck, FaKey, FaClipboardCheck, FaDoorOpen } from "react-icons/fa";
// Assets
import PropTypes from "prop-types";

export default function ServiceBox({ icon, title, subtitle }) {
  let getIcon;

  switch (icon) {
    case "check":
      getIcon = <FaCheck size={40} color="#143610" />;
      break;
    case "stethoscope":
      getIcon = <FaClipboardCheck size={40} color="#143610" />;
      break;
    case "door":
      getIcon = <FaDoorOpen size={40} color="#143610" />;
      break;
    default:
      getIcon = <FaKey size={40} color="#143610" />;
      break;
  }

  return (
    <Wrapper className="flex flexColumn">
      <IconStyle>{getIcon}</IconStyle>
      <TitleStyle className="font20 extraBold">{title}</TitleStyle>
      <SubtitleStyle className="font13" style={{ textAlign: 'justify' }}>{subtitle}</SubtitleStyle>
    </Wrapper>
  );
}

ServiceBox.propTypes = {
  icon: PropTypes.string.isRequired, // 'icon' é uma string e é obrigatório
  title: PropTypes.string.isRequired, // 'title' é uma string e é obrigatório
  subtitle: PropTypes.string.isRequired, // 'subtitle' é uma string e é obrigatório
};

const Wrapper = styled.div`
  width: 100%;
`;
const IconStyle = styled.div`
  @media (max-width: 860px) {
    margin: 0 auto;
  }
`;
const TitleStyle = styled.h2`
  width: 100%;
  max-width: 300px;
  margin: 0 auto;
  padding: 40px 0;
  @media (max-width: 860px) {
    padding: 20px 0;
  }
`;
const SubtitleStyle = styled.p`
  width: 100%;
  max-width: 300px;
  margin: 0 auto;
`;
