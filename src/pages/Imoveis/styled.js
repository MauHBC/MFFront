import styled from "styled-components";
import { Link } from "react-router-dom";
import * as colors from "../../config/colors";

export const Title = styled.h1`
  text-align: center;
  font-weight: 800;
  margin-bottom: 20px;
`;

export const MenuButtons = styled.div`
  display: flex;
  justify-content: space-between;
  flex-direction: column;
  padding: 10px 200px 0px 0px;
`;

export const Voltar = styled(Link)`
    cursor: pointer;
    background: ${colors.primaryColor};
    border: none;
    color: #fff;
    padding: 10px 20px;
    border-radius: 6px;
    font-weight: 700;
    transition: all 300ms;
    text-align: center;
`;

export const NovoImovel = styled(Link)`
    cursor: pointer;
    background: ${colors.primaryColor};
    border: none;
    color: #fff;
    padding: 10px 20px;
    border-radius: 6px;
    font-weight: 700;
    transition: all 300ms;
    margin-top: 10px;
    text-align: center;
`;

export const Form = styled.form`
  margin-top: 30px;
  display: flex;
  flex-direction: column;

  input {
    height: 40px;
    margin-bottom: 20px;
    border: 1px solid black;
    border-radius: 8px;
    padding: 0 10px;
  }
  select {
    height: 40px;
    margin-bottom: 20px;
    border: 1px solid black;
    border-radius: 8px;
    padding: 0 10px;
  }

  .tittletext {
    font-weight: bold;
    font-size: 20px;
  }

`;

export const FaExclamationClass = styled.div`
`;

export const ListProp = styled.div`
  margin-top: 30px;
  display: flex;
  flex-direction: row;
  border: 3px solid #ddd;
  border-radius: 8px;
  align-items: center;
  justify-content: space-between;
  position: relative;
  background-color: lightblue;

  a {
    background-color: pink;
    padding: 10px 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .edit {
    position: absolute;
    right: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
  }

  .delete {
    position: absolute;
    right: 0px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
  }

  .propertyListResult {
    display: flex;
    flex-direction: column;
    padding: 0 10px;
    font-weight: 700;
    font-size: 18px;
  }

  .propertylist {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    flex-direction: row;
  }

  @media only screen and (max-width: 600px) {
  .propertylist {
    flex-direction: column;
  }

  .edit, .delete {
    position: static;
    margin: 10px 0;
  }
}

`;
