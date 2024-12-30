import styled, { createGlobalStyle } from "styled-components";
import * as colors from "../config/colors";
import "react-toastify/dist/ReactToastify.css";

export default createGlobalStyle`
  * {
    margin: 0;
    padding: 0;
    outline: none;
    box-sizing: border-box;
  }

  body {
    font-family: sans-serif;
    background: ${colors.backgroundColorCompany};
    color: ${colors.primaryDarkColor};
  }

  html, body, #root {
    height: 100%;
  }

  button, a { /* Agrupando estilos de botões e links */
    cursor: pointer;
    background: ${colors.primaryColor};
    color: ${colors.textColor}; /* Mesma cor para ambos */
    padding: 10px 20px;
    border: 2px solid ${colors.textColor}; /* Certifique-se de aplicar a borda */
    border-radius: 6px;
    font-weight: 700;
    transition: all 300ms;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    text-decoration: none; /* Para garantir que links fiquem consistentes */

    &:hover {
      filter: brightness(85%);
    }
  }
  
  ul {
    list-style: none;
  }

  .img-button {
    cursor: pointer;
    /* background: none;
    border: none; */
    padding: 0;
    max-width: 100%;
    height: auto;
    border: 1px solid #fff;

  }

  .newItem {
    margin-top: 12px;
    background:  none;
    border: 1px solid #000;
    border-radius: 6px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.2)
  }
  
  img {
    padding: 10px;
    max-width: 100%;
    height: auto;
  }

  .itemobs {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;  
  }

  .input-file {
    width: 0.1px;
    height: 0.1px;
    opacity: 10;
    overflow: hidden; 
    position: absolute;
    z-index: -1;
  }

  .input-file + label {
    font-size: 1.25em;
    font-weight: 700;
    color: white;
    background-color: black;
    display: inline-block;
    padding: 10px 20px;
    cursor: pointer;
  }

  .input-file:focus + label, .input-file + label:hover {
    background-color: red;
  }

  .input-file { 
  display: none;
  }

  .custom-file-upload {
    border: 1px solid #ccc;
    display: inline-block;
    cursor: pointer;
    background: ${colors.primaryColor};
    color: #fff;
    padding: 5px;
    border-radius: 6px;
    font-weight: 700;
    transition: all 300ms;
    justify-content: space-between;
    flex-direction: row;
    margin-bottom: 10px;
  }

`;

/* body .Toastify .Toastify__toast-container .toastify__toats--success {
    background: ${colors.sucessColor}
  }

  body .Toastify .Toastify__toast-container .toastify__toats--error {
    background: ${colors.sucessColor}
  } */

export const Container = styled.section`
  max-width: 480px;
  background: #fff;
  margin: 30px auto;
  padding: 30px;
  border-radius: 6px;
  /* box-shadow: 0 0 10px rgba(0, 0, 0, 0.2) */
  border: 2px solid #000;
`;

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
