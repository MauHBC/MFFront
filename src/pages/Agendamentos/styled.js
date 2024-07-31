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
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 4px 8px 0 rgba(0,0,0,0.1);
  margin: 20px;
  height: calc(145vh - 410px);
  overflow-y: auto;

  @media (max-width: 768px) {
    width: 100%;
    margin-top: 0;
    height: auto;
  }
`;

export const Title = styled.h1`
  text-align: center;
  font-size: 24px;
  color: #333;
  margin-bottom: 20px;
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
  margin-top: 20px;
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
`;

export const EditIcon = styled(FaEdit)`
  color: #4c9aff;
`;

export const DeleteIcon = styled(FaWindowClose)`
  color: #ff6c6c;
`;
