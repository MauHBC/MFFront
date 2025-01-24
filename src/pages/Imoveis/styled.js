import styled from "styled-components";

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

  margin: 0 auto; /* Centraliza horizontalmente */
  display: block; /* Garante que o elemento respeite o margin */
  text-align: center; /* Centraliza o texto dentro do botão */

  &:hover {
    background-color: #0056b3;
  }
}

`;

export const RightColumn = styled.div`
  flex: 2;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  padding: 0px 10px;
  border-radius: 10px;
  box-shadow: 0 4px 8px 0 rgba(0,0,0,0.1);
  margin: 50px 20px 20px 20px;
  height: calc(145vh - 610px);
  overflow-y: auto;

  @media (max-width: 768px) {
    width: 100%;
    margin-top: 0;
    height: auto;
  }
`;

export const Title = styled.h2`
  text-align: center;
  font-size: 24px;
  color: #333;
  margin-bottom: 20px;
  margin: 0;
  /* flex: 1; */
  text-align: center;
`;

export const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 10px;

  input, select, button {
    height: 48px;
    margin-bottom: 0px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    padding: 0 15px;
    font-size: 16px;
  }

  button {
    background-color: #007bff;
    color: white;
    font-size: 16px;
    border: none;
    cursor: pointer;
    margin-bottom: 20px;
    
    &:hover {
      background-color: #0056b3;
    }
  }
`;

export const ListProp = styled.div`
  margin-top: 10px;
  padding: 15px;
  border: 2px solid black;
  border-radius: 8px;
  background-color: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  .propertylist {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;

    .propertyListResult {
      display: flex;
      flex-direction: column;
      font-size: 16px;
      color: #333;
      line-height: 1.5;
    }

    .action-buttons {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px; /* Espaço entre os botões */

      .schedule-btn,
      .edit,
      .delete {
        padding: 8px 12px;
        font-size: 14px;
        border-radius: 4px;
        text-align: center;
        text-decoration: none;
        color: white;
        width: 100px;
        transition: background-color 0.3s;
      }

      .schedule-btn {
        background-color: #007bff;

        &:hover {
          background-color: #0056b3;
        }
      }

      .edit {
        background-color: #007bff;

        &:hover {
          background-color:rgb(33, 109, 14);
        }
      }

      .delete {
        background-color: #007bff;

        &:hover {
          background-color: #c82333;
        }
      }
    }
  }
`;

export const PaginationContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px; /* Espaçamento entre os itens */
  margin-top: 20px; /* Espaço acima da paginação */
`;

export const PaginationButton = styled.button`
  padding: 10px 20px;
  background-color: #007bff;
  color: #fff;
  border: none;
  border-radius: 5px;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.3s ease;

  &:hover {
    background-color: #0056b3;
  }

  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
`;

export const PaginationInfo = styled.span`
  font-size: 16px;
  color: #333;
`;