import React from "react";
import styled from "styled-components";
import { FaCheck, FaKey, FaClipboardCheck, FaDoorOpen } from "react-icons/fa";
// Assets
import PropTypes from "prop-types";
import RollerIcon from "../../assets/svg/Services/RollerIcon";
import MonitorIcon from "../../assets/svg/Services/MonitorIcon";
import BrowserIcon from "../../assets/svg/Services/BrowserIcon";
import PrinterIcon from "../../assets/svg/Services/PrinterIcon";

export default function ServiceBox({ icon, title, subtitle }) {
  let getIcon;

  switch (icon) {
    case "roller":
      getIcon = <RollerIcon />;
      break;
    case "monitor":
      getIcon = <MonitorIcon />;
      break;
    case "browser":
      getIcon = <BrowserIcon />;
      break;
    case "printer":
      getIcon = <PrinterIcon />;
      break;
    case "check":
      getIcon = <FaCheck size={24} color="#4cd5c5" />;
      break;
    case "stethoscope":
      getIcon = <FaClipboardCheck size={24} color="#4cd5c5" />;
      break;
    case "door":
      getIcon = <FaDoorOpen size={24} color="#4cd5c5" />;
      break;
    default:
      getIcon = <FaKey size={24} color="#4cd5c5" />;
      break;
  }

  return (
    <Wrapper className="flex flexColumn">
      <IconStyle>{getIcon}</IconStyle>
      <TitleStyle className="font20 extraBold">{title}</TitleStyle>
      <SubtitleStyle className="font13">{subtitle}</SubtitleStyle>
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
