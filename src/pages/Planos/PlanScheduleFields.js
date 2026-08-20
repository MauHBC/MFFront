import styled from "styled-components";

export const WeekdayPicker = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 6px;
`;

export const WeekdayButton = styled.button`
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid ${({ $active }) => ($active ? "#6a795c" : "#d4d8ce")};
  background: ${({ $active }) => ($active ? "#6a795c" : "#fff")};
  color: ${({ $active }) => ($active ? "#fff" : "#555")};
  font-size: 0.82rem;
  font-weight: ${({ $active }) => ($active ? "700" : "400")};
  cursor: pointer;
  transition: all 0.15s;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
`;

export const DayTimeList = styled.div`
  display: grid;
  gap: 8px;
  margin-top: 8px;
`;

export const DayTimeRow = styled.label`
  align-items: center;
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(86px, 1fr) 104px;

  span {
    color: #2f3d2a;
    font-size: 0.9rem;
    font-weight: 800;
    text-transform: capitalize;
  }

  input,
  select {
    min-width: 0;
  }
`;
