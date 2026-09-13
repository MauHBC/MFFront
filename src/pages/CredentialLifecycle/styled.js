import styled from "styled-components";

export const Page = styled.main`
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background: #f4f6f2;
`;

export const Card = styled.section`
  width: min(100%, 460px);
  padding: 32px;
  border: 1px solid #dfe4dc;
  border-radius: 14px;
  background: white;
  box-shadow: 0 12px 34px rgba(28, 48, 26, 0.08);
  h1 { margin: 0 0 10px; color: #1f321d; font-size: 1.65rem; }
  p { color: #596456; line-height: 1.55; }
`;

export const Form = styled.form`
  display: grid;
  gap: 14px;
  margin-top: 22px;
  label { display: grid; gap: 6px; color: #293728; font-weight: 700; }
  input {
    min-height: 44px;
    border: 1px solid #ccd4c9;
    border-radius: 8px;
    padding: 9px 12px;
    font: inherit;
  }
  button {
    min-height: 44px;
    border: 0;
    border-radius: 8px;
    background: #315c2b;
    color: white;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
  button:disabled { cursor: wait; opacity: 0.65; }
`;

export const Message = styled.p`
  padding: 12px;
  border-radius: 8px;
  background: ${({ $error }) => ($error ? "#fff0ee" : "#eef7eb")};
  color: ${({ $error }) => ($error ? "#942e25" : "#285123")} !important;
`;

export const BackLink = styled.a`
  display: inline-block;
  margin-top: 18px;
  color: #315c2b;
  font-weight: 700;
`;
