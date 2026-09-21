import styled from "styled-components";

export const Message = styled.p`
  margin-top: ${({ $error }) => ($error ? "0" : "24px")};
  padding: 14px 16px;
  border-radius: 10px;
  background: ${({ $error }) => ($error ? "#fff0ee" : "#e8f4f3")};
  color: ${({ $error }) => ($error ? "#a21d15" : "#0f5353")};
  font-size: 0.94rem;
  line-height: 1.55;
`;

export const Help = styled.p`
  color: #475569;
  font-size: 0.88rem;
  line-height: 1.4;
`;

export const ActionRow = styled.div`
  margin-top: 24px;

  a {
    color: #0a7776;
    font-size: 0.91rem;
    font-weight: 650;
    text-decoration: underline;
    text-underline-offset: 3px;

    &:hover { color: #075e5d; }
    &:focus-visible { outline: 3px solid #0a7776; outline-offset: 3px; }
  }
`;

export const StandaloneAction = styled.div`
  margin-top: 28px;
`;
