import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";

import {
  filterPatients,
  getPatientDisplayName,
} from "../../utils/patientSearch";

export default function PatientSearchField({
  mode = "filter",
  required = false,
  label,
  placeholder,
  value = "",
  onChange,
  patients = [],
  selectedPatientId = "",
  onSelect,
  disabled = false,
  inputId,
  maxSuggestions = 8,
  className,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const isFilter = mode === "filter";
  const resolvedLabel = label || (isFilter ? "Pesquisar paciente" : `Paciente${required ? " *" : ""}`);
  const resolvedPlaceholder = placeholder || (isFilter ? "Nome do paciente" : "Buscar paciente");
  const suggestions = useMemo(
    () => filterPatients(patients, value).slice(0, maxSuggestions),
    [patients, value, maxSuggestions],
  );
  const selectedPatient = useMemo(
    () => patients.find((patient) => String(patient.id) === String(selectedPatientId)),
    [patients, selectedPatientId],
  );

  const handleInputChange = (event) => {
    onChange?.(event.target.value);
    if (!isFilter) {
      setIsOpen(true);
    }
  };

  const handleSelect = (patient) => {
    onSelect?.(patient);
    setIsOpen(false);
  };

  return (
    <Wrapper className={className}>
      <Label htmlFor={inputId}>{resolvedLabel}</Label>
      {disabled && selectedPatient ? (
        <FixedValue>{getPatientDisplayName(selectedPatient)}</FixedValue>
      ) : (
        <SearchBox>
          <Input
            id={inputId}
            type="search"
            value={value}
            placeholder={resolvedPlaceholder}
            onChange={handleInputChange}
            onFocus={() => !isFilter && setIsOpen(true)}
            onBlur={() => {
              if (!isFilter) {
                setTimeout(() => setIsOpen(false), 150);
              }
            }}
            autoComplete="off"
            disabled={disabled}
            aria-autocomplete={isFilter ? undefined : "list"}
            aria-expanded={isFilter ? undefined : isOpen}
          />
          {!isFilter && isOpen && value && suggestions.length > 0 && (
            <SuggestionList role="listbox">
              {suggestions.map((patient) => (
                <SuggestionButton
                  key={patient.id}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelect(patient)}
                >
                  {getPatientDisplayName(patient)}
                </SuggestionButton>
              ))}
            </SuggestionList>
          )}
        </SearchBox>
      )}
    </Wrapper>
  );
}

PatientSearchField.propTypes = {
  mode: PropTypes.oneOf(["filter", "select"]),
  required: PropTypes.bool,
  label: PropTypes.string,
  placeholder: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func,
  patients: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  })),
  selectedPatientId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onSelect: PropTypes.func,
  disabled: PropTypes.bool,
  inputId: PropTypes.string,
  maxSuggestions: PropTypes.number,
  className: PropTypes.string,
};

PatientSearchField.defaultProps = {
  mode: "filter",
  required: false,
  label: undefined,
  placeholder: undefined,
  value: "",
  onChange: undefined,
  patients: [],
  selectedPatientId: "",
  onSelect: undefined,
  disabled: false,
  inputId: undefined,
  maxSuggestions: 8,
  className: undefined,
};

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #354a2c;
  font-size: 0.92rem;
  font-weight: 700;
  min-width: 220px;
`;

const Label = styled.label``;

const SearchBox = styled.div`
  position: relative;
`;

const Input = styled.input`
  width: 100%;
  min-height: 40px;
  border: 1px solid rgba(106, 121, 92, 0.22);
  border-radius: 8px;
  padding: 9px 11px;
  font-size: 0.9rem;
  color: #1b1b1b;
  background: #fff;
  box-sizing: border-box;

  &:disabled {
    background: #f4f5f2;
    color: #888;
  }
`;

const FixedValue = styled.div`
  min-height: 40px;
  border: 1px solid rgba(106, 121, 92, 0.18);
  border-radius: 8px;
  background: #f6f8f4;
  color: #2f3d2a;
  padding: 10px 12px;
  display: flex;
  align-items: center;
`;

const SuggestionList = styled.div`
  position: absolute;
  z-index: 80;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid rgba(106, 121, 92, 0.18);
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 12px 26px rgba(0, 0, 0, 0.12);
  padding: 4px;
`;

const SuggestionButton = styled.button`
  width: 100%;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #2f3d2a;
  padding: 9px 10px;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: rgba(106, 121, 92, 0.08);
  }
`;
