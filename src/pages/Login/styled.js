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
