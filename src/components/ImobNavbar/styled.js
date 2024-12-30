import styled from "styled-components";
import * as colors from "../../config/colors";

export const Nav = styled.nav`
  background: ${colors.primaryColor};
  padding: 1rem 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;

  .brand {
    display: flex;
    align-items: center;

    .logo {
      max-height: 60px;
      margin-right: 1rem;
    }

    .title {
      color: ${colors.textColor};
      font-size: 1.5rem;
      font-weight: bold;
    }
  }

  .navigation {
    display: flex;
    align-items: center;

    a, button {
      color: ${colors.textColor};
      background: ${colors.primaryColor};
      padding: 0.625rem 1.25rem;
      margin: 0 1rem;
      font-size: 1rem;
      border-radius: 5px;
      border: 2px solid
      transition: background-color 0.3s ease;
      box-shadow: 0 2px 4px rgba(0.2,0.2,0.2,0.2);

      &:hover {
        background-color: ${colors.buttonHoverColor};
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }
   }

    .user-info {
      color: ${colors.textColor};
    }
  }
  
  @media (max-width: 768px) {
    flex-direction: column;

    .brand {
      justify-content: center;
      margin-bottom: 1rem;
    }
  }
`;
