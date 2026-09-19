import styled from "styled-components";

// Kept for clinic-branded legacy hosts; the central SaaS login uses PublicAuthShell.
export const LegacyForm = styled.form`
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
    color: #333; /* Define a cor padrão do texto */

    &:focus {
      border-color: var(--public-primary-color, #143610);
    }

    /* Corrige o preenchimento automático do navegador */
    &:-webkit-autofill {
      -webkit-text-fill-color: #333; /* Define a cor do texto */
      background-color: #fff !important; /* Garante fundo branco */
      transition: background-color 5000s ease-in-out 0s; /* Previne alteração de cor */
    }
  }

  button {
    height: 40px;
    background-color: var(--public-primary-color, #143610);
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
    
    &:hover {
      background-color: var(--public-secondary-color, #3d5230);
    }
  }

  a {
    margin-top: 12px;
    color: var(--public-primary-color, #143610);
    text-align: center;
    font-weight: 700;
  }
`;

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

export const RecoveryRow = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: -6px;

  a {
    color: #0a7776;
    font-size: 0.9rem;
    font-weight: 650;
    text-decoration: underline !important;
    text-underline-offset: 3px;

    &:hover { color: #075e5d; }
    &:focus-visible { outline: 3px solid #0a7776; outline-offset: 3px; }
  }
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

export const TrialPrompt = styled.p`
  margin-top: 28px;
  padding-top: 24px;
  border-top: 1px solid #cbd5e1;
  color: #475569;
  font-size: 0.91rem;
  line-height: 1.55;
  text-align: center;

  a {
    color: #0a7776;
    font-weight: 700;
    text-decoration: underline !important;
    text-underline-offset: 3px;

    &:hover { color: #075e5d; }
    &:focus-visible { outline: 3px solid #0a7776; outline-offset: 3px; }
  }
`;
