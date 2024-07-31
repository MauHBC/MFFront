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
  margin-top: 30px;
  display: flex;
  flex-direction: column;

  input {
    height: 40px;
    margin-bottom: 20px;
    border: 1px bold;
    border-radius: 8px;
    padding: 0 10px;
  }
  select {
    height: 40px;
    margin-bottom: 20px;
    border: 1px bold;
    border-radius: 8px;
    padding: 0 10px;
  }

  .tittletext {
    font-weight: bold;
    font-size: 20px;
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
