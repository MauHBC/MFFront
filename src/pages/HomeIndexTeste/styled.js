import styled from "styled-components";
import { Link } from "react-router-dom";
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
    margin-bottom: 2rem;
    color: #333;
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

export const StyledLink = styled(Link)`
  background-color: #C3073F;
  color: white;
  padding: 10px 15px;
  border-radius: 5px;
  text-decoration: none;
  transition: background-color 0.3s ease;

  &:hover {
    background-color: #9B1C31;
  }

`;
