import styled from "styled-components";
// import { Link } from "react-router-dom";
// import * as colors from "../../config/colors";

export const Title = styled.h1`
  text-align: center;
  font-size: 24px;
  color: #333;
  margin-bottom: 20px;
`;

export const HeroSection = styled.section`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: flex-start;
  padding: 40px;
  gap: 20px;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: center;
  }
`;

export const PropertyHeader = styled.div`
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;

  p {
    font-size: 16px;
    color: #333;
    margin: 5px 0;
    strong {
      color: #007bff;
    }
  }

`;

export const Form = styled.form`
  margin-top: 10px;
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
  
  button:not([class]) {
    background-color: #007bff;
    color: white;
    font-size: 16px;
    border: none;
    cursor: pointer;
    max-width: 200px;
    
    &:hover {
      background-color: #0056b3;
    }
  }


`;

export const ListProp = styled.div`
  margin-top: 10px;
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

export const ServiceButton = styled.button`
  margin: 5px;
  margin-right: 10px;
  padding: 10px 15px;
  border: 1px solid ${({ selected }) => (selected ? "#0056b3" : "#ced4da")};
  background-color: ${({ selected }) => (selected ? "#0056b3" : "#007bff")};
  font-weight: ${({ selected }) => (selected ? "bold" : "normal")};
  border-radius: 8px;
  cursor: pointer;

  &:hover {
    background-color: ${({ selected }) => (selected ? "#0056b3" : "#f8f9fa")};
    border-color: ${({ selected }) => (selected ? "#0056b3" : "#ced4da")};
  }

  &:focus {
    outline: none;
  }

`;

export const LeftColumn = styled.div`
  flex: 0.5;
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
`;

export const RightColumn = styled.div`
  flex: 2;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 4px 8px 0 rgba(0,0,0,0.1);
  margin: 20px;
  height: calc(100vh - 480px);
  overflow-y: auto;

  @media (max-width: 768px) {
    width: 100%;
    margin-top: 0;
    height: auto;
  }

  .serviceTypeButtons {
    display: flex;
    justify-content: start;
    margin-bottom: 20px;
  }

  input[type="date"] {
    width: 100%;
    max-width: 200px;
    font-size: 15px;
  }

  .observationField {
    display: flex;
    flex-direction: column;
    margin-bottom: 20px;

    label {
      font-size: 20px;
      font-weight: bold;
      color: #333;
      margin-bottom: 5px;
    }

    textarea {
      padding: 10px;
      border: 2px solid #ced4da;
      border-radius: 4px;
      font-size: 26px;
      color: #333; // text color
      resize: vertical;
      max-width: 100%; // impede que o textarea seja redimensionado para mais largo do que o contêiner
      min-width: 100px; // opcional: define uma largura mínima se desejar

      &:focus {
        outline: none;
        border-color: #007bff;
        box-shadow: 0 0 0 0.2rem rgba(0,123,255,.25);
      }
    }
  }
`;
