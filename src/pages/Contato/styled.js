import styled from "styled-components";
import * as colors from "../../config/colors";

export const HeroSection = styled.section`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 20px;
  padding: 40px;
  background: ${colors.backgroundColorCompany};

  @media (max-width: 768px) {
    flex-direction: column-reverse;
  }
`;

export const LeftColumn = styled.div`
  flex: 1;
  padding-right: 20px;

  h1 {
    font-size: 2.5rem;
    color: #0B3E2D;
    margin-bottom: 1rem;
  }

  p {
    font-size: 1.2rem;
    margin-bottom: 0.8rem;
    color: #333;
    text-align: justify;
  }

  @media (max-width: 768px) {
    padding-right: 0;
    text-align: center;
  }
`;

export const RightColumn = styled.div`
  flex: 1;

  img {
    align-items: right;
    width: 80%;
    max-width: 100%;
    height: auto;
    border-radius: 30px;
  }
`;

export const StyledButton = styled.a`
  display: block; /* Coloca os botões em uma coluna (um embaixo do outro) */
  align-items: center;
  justify-content: center;
  background-color: ${(props) =>
    props.bgColor || "#25D366"}; /* Cor padrão para WhatsApp */
  background-image: ${(props) => props.bgImage || "none"};
  color: white;
  padding: 10px 15px;
  border-radius: 5px;
  text-decoration: none;
  font-weight: bold;
  margin-bottom: 10px;
  transition: background-color 0.3s ease, background-image 0.3s ease;
  width: fit-content;

  &:hover {
    background-color: ${(props) => props.hoverColor || "#128C7E"};
    background-image: ${(props) => props.hoverImage || "none"};
  }
`;
