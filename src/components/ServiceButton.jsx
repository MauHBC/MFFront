import React from "react";
import PropTypes from "prop-types";
import styled from "styled-components";

// Estilização do botão
const StyledButton = styled.button`
  margin: 5px;
  margin-right: 10px;
  padding: 10px 15px;
  width: 160px;
  border: 2px solid ${({ selected }) => (selected ? "black" : "#ced4da")};
  background-color: ${({ selected }) => (selected ? "#0056b3" : "#007bff")};
  color: white;
  font-weight: ${({ selected }) => (selected ? "bold" : "normal")};
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.3s;
  text-align: center;  

  &:hover {
    background-color: #0056b3;
    color: white;
    border-color: #0056b3;
  }

  &:focus {
    outline: none;
  }
`;

// Componente funcional
export default function ServiceButton({ label, selected, onClick, isSubmit }) {
  return (
    <StyledButton
      type={isSubmit ? "submit" : "button"}
      selected={selected}
      onClick={onClick}
    >
      {label}
    </StyledButton>
  );
}

ServiceButton.propTypes = {
  label: PropTypes.string.isRequired,
  selected: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
  isSubmit: PropTypes.bool,
};

ServiceButton.defaultProps = {
  isSubmit: false,
};
