import styled from "styled-components";
import * as colors from "../../config/colors";

export const HomeContainer = styled.div`
  margin-top: 20px;
  display: grid;
  place-items: center;
  gap: 20px; // Espaçamento entre os itens da grid

  .titulo {
    margin-bottom: 20px;
    text-align: center;
    font-size: 2rem; // Tamanho maior para o título
    color: ${colors.primaryDarkColor};
  }

  a {
    cursor: pointer;
    background: ${colors.primaryColor};
    border: none;
    color: #fff;
    padding: 0.625rem 1.25rem; // Padding em rem para escalabilidade
    border-radius: 10px;
    font-weight: 700;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    text-align: center;
    margin-bottom: 10px;
    width: 100%;
    max-width: 200px;

    display: flex;
    align-items: center;
    justify-content: center;
    text-decoration: none; // Remove o sublinhado dos links

    &:hover {
      transform: translateY(-5px); // Levanta o botão ao passar o mouse
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2); // Sombra para efeito 3D
    }

    svg {
      margin-right: 8px; // Espaço entre o ícone e o texto
    }
  }

  @media (max-width: 768px) {
    a {
      width: auto; // Torna os botões mais flexíveis em telas menores
    }
  }
`;
