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

export const PrivacyPolicySection = styled.section`
  padding: 20px;
  background: #f9f9f9;
  border-radius: 10px;
  margin-top: 30px;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;

  h2, h3 {
    color: ${colors.primaryColor};
  }

  p, ul {
    margin: 10px 0;
    line-height: 1.6;
  }

  ul {
    list-style-type: disc;
    margin-left: 20px;
  }

  a {
    color: ${colors.linkColor};
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }
`;
