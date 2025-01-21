import React from "react";
import PropTypes from "prop-types";
import styled from "styled-components";

// Estilize o contêiner e os elementos internos
const ObservationFieldContainer = styled.div`
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
    color: #333;
    resize: vertical;
    max-width: 100%;
    min-width: 100px;

    &:focus {
      outline: none;
      border-color: #007bff;
      box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
    }
  }
`;

export default function ObservationField({ id, label, value, onChange }) {
  return (
    <ObservationFieldContainer>
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        name={id}
        rows="4"
        value={value}
        onChange={onChange}
      />
    </ObservationFieldContainer>
  );
}

ObservationField.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};
