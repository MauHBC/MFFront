import styled from "styled-components";

export const Title = styled.h1`
  text-align: center;
  font-size: 24px;
  color: #333;
  margin-bottom: 20px;
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
    font-size: 18px; /* Aumenta o tamanho do texto */
    border: none;
    cursor: pointer;
    max-width: 300px; /* Aumenta a largura máxima */
    padding: 15px 20px; /* Aumenta o espaçamento interno */
    border-radius: 8px;

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
  height: calc(100vh - 200px);
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
`;
