import styled from "styled-components";
import { Link } from "react-router-dom";
import * as colors from "../../config/colors";

export const Title = styled.h1`
  text-align: center;
  font-weight: 800;
  margin-bottom: 20px;
`;

export const Voltar = styled(Link)`
  cursor: pointer;
  background: ${colors.primaryColor};
  border: none;
  color: #fff;
  padding: 10px 25px 10px 25px;
  border-radius: 6px;
  font-weight: 700;
  transition: all 300ms;
  text-align: center;
  margin-bottom: 20px;
  width: 50%;
`;

export const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;

  fieldset {
    border: 1px solid #ddd;
    padding: 20px;
    border-radius: 8px;
  }

  legend {
    font-size: 18px;
    font-weight: bold;
    margin-bottom: 10px;
    color: #333;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 20px;

    label {
      font-size: 14px;
      color: #555;
    }

    input {
      padding: 10px;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 14px;
    }

    input:focus {
      border-color: #007bff;
      box-shadow: 0 0 4px rgba(0, 123, 255, 0.5);
    }
  }

  button {
    padding: 10px 15px;
    background-color: #007bff;
    color: #fff;
    font-size: 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  button:hover {
    background-color: #0056b3;
  }
`;

export const ImovelContainer = styled.div`
  margin-top: 20px;

  div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 5px 0;
  }

  div + div {
    border-top: 1px solid #eee;
  }

`;

export const NovoImovel = styled(Link)`
  display: block;
  padding: 20px 0 10px 0;
`;

export const ListProp = styled.div`
  margin-top: 30px;
  display: flex;
  flex-direction: row;
  border: 3px solid #ddd;
  border-radius: 4px;
  align-items: center;
  justify-content: space-between;
  position: relative;

  background-color: lightblue;

  .propertylist {
    padding: 0 10px;
  }

  .propertylist {
    justify-content: space-between;
    flex-direction: row;
  }
`;

export const Button = styled.button`
`;

export const LeftColumn = styled.div`
  flex: 1;
  background: #ffffff;
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 4px 8px 0 rgba(0,0,0,0.1);
  margin: 20px;
 
  h1 {
    font-size: 2rem;
    color: #333;
    margin-bottom: 1rem;
  }
  
  @media (max-width: 768px) {
    width: 100%;
    margin: 20px 0;
  }

  .schedule-btn {
    padding: 10px 15px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
    transition: background-color 0.2s;
    margin: 60px;

    &:hover {
      background-color: #0056b3;
    }
  }
`;
