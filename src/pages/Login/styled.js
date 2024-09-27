import styled from "styled-components";

export const Form = styled.form`
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  
  input {
    height: 40px;
    margin-bottom: 10px;
    padding: 0 10px;
    border-radius: 8px;
    border: 1px solid #ddd;
    font-size: 16px;
    
    &:focus {
      border-color: #7620ff;
    }
  }

  button {
    height: 40px;
    background-color: #7620ff;
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
    
    &:hover {
      background-color: #580cd2;
    }
  }
`;

export const Container = styled.div`
  max-width: 500px;
  margin: 50px auto;
  padding: 20px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);

  h1 {
    text-align: center;
    margin-bottom: 20px;
    color: #333;
  }
`;
