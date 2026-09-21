import styled from "styled-components";

export const Form = styled.form`
  display: grid;
  gap: 20px;
  margin-top: 34px;
`;

export const Field = styled.div`
  display: grid;
  gap: 8px;

  label {
    display: grid;
    min-width: 0;
    gap: 8px;
    font-size: 0.91rem;
    font-weight: 650;
    color: #0f172a;
  }

  input {
    display: block;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    height: 52px;
    padding: 0 15px;
    border: 1px solid #aebdcd;
    border-radius: 10px;
    background: #fff;
    color: #0f172a;
    font: inherit;
    font-size: 1rem;
    transition: border-color 150ms ease, box-shadow 150ms ease;

    &::placeholder { color: #64748b; }
    &:hover { border-color: #64748b; }
    &:focus-visible {
      outline: 3px solid #0a7776;
      outline-offset: 2px;
      border-color: #0a7776;
    }
    &[aria-invalid="true"] { border-color: #b42318; }
    &:-webkit-autofill {
      -webkit-text-fill-color: #0f172a;
      -webkit-box-shadow: 0 0 0 100px #fff inset;
      box-shadow: 0 0 0 100px #fff inset;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    input { transition: none; }
  }
`;

export const PasswordControl = styled.div`
  position: relative;

  input { padding-right: 64px; }

  button {
    position: absolute;
    bottom: 4px;
    right: 4px;
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: #334155;
    cursor: pointer;

    &:hover { background: #e8f4f3; color: #0a7776; }
    &:focus-visible { outline: 3px solid #0a7776; outline-offset: 2px; }
  }
`;

export const FieldError = styled.p`
  color: #a21d15;
  font-size: 0.84rem;
  line-height: 1.4;
`;

export const SubmitButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 52px;
  border: 0;
  border-radius: 10px;
  background: #0f172a;
  color: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: background 150ms ease;

  &:hover:not(:disabled) { background: #1d3254; }
  &:focus-visible { outline: 3px solid #0a7776; outline-offset: 3px; }
  &:disabled { opacity: 0.72; cursor: wait; }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

export const LoadingStatus = styled.p`
  color: #334155;
  font-size: 0.88rem;
  line-height: 1.4;
  text-align: center;
`;
