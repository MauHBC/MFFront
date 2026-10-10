import styled from "styled-components";

export const ClinicalRecordButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid rgba(106, 121, 92, 0.28);
  background: ${(props) => (props.$primary ? "#6a795c" : "#fff")};
  color: ${(props) => (props.$primary ? "#fff" : "#6a795c")};
  font-weight: 700;
  cursor: pointer;
  transition: filter 0.2s ease, opacity 0.2s ease;

  &:hover:not(:disabled) {
    filter: brightness(0.97);
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;
