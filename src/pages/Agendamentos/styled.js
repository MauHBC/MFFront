import styled from "styled-components";
import { FaEdit, FaWindowClose } from "react-icons/fa";

export const HeroSection = styled.section`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: flex-start;
  padding: 40px;
  gap: 20px;
  background: #f7f7f7;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: center;
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
  padding: 0px 10px 50px 10px;
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

  .DateTitle {
    padding-top: 40px;
    font-weight: bold;
    font-size: 18px;
  }

  .filter-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.filter-container button {
  background-color: #007bff;
  color: white;
  border: none;
  padding: 10px 10px 10px 10px;
  cursor: pointer;
}

.filter-container span {
  font-size: 16px;
  font-weight: bold;
  padding: 0 10px 0 10px;
}

`;

export const Title = styled.h2`
  text-align: center;
  font-size: 40px;
  color: #333;
  margin-bottom: 20px;
  margin: 0;
  flex: 1;
  text-align: center;
`;

export const TitleContainer = styled.div`
  position: sticky;
  top: 0;
  background: #ffffff;
  z-index: 1;
  padding: 10;
  margin-top: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
`;

export const ButtonWrapper = styled.div`
  position: absolute;
  right: 20px;
`;

export const Actions = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px; /* Espaçamento entre checkbox e botão */
`;

export const StyledCheckbox = styled.input`
  transform: scale(1.5); /* Aumenta o tamanho do checkbox */
  margin-bottom: 10px; /* Espaçamento abaixo do checkbox */
`;

export const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 10px;

  input, select, button {
    height: 48px;
    margin-bottom: 10px;
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
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .propertyListResult {
    display: flex;
    flex-direction: column;
    font-size: 16px;
    color: #333;
    line-height: 1.5;
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

    &:hover {
      background-color: #0056b3;
    }
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

  
`;

export const EditIcon = styled(FaEdit)`
  color: #4c9aff;
`;

export const DeleteIcon = styled(FaWindowClose)`
  color: #ff6c6c;
`;
