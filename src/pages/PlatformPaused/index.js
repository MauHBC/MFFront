import React from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";

export default function PlatformPaused() {
  return (
    <Wrapper>
      <Panel>
        <Badge>Painel SaaS</Badge>
        <h1>Módulo temporariamente indisponível</h1>
        <p>
          O console administrativo da plataforma está pausado nesta versão. A
          gestão das clínicas será retomada em uma experiência separada do
          sistema interno dos clientes.
        </p>
        <Actions>
          <PrimaryLink to="/menu">Voltar ao sistema</PrimaryLink>
        </Actions>
      </Panel>
    </Wrapper>
  );
}

const Wrapper = styled.main`
  min-height: calc(100vh - 76px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 20px;
  background: #f6f7f9;
  box-sizing: border-box;
`;

const Panel = styled.section`
  width: 100%;
  max-width: 620px;
  padding: 36px;
  border-radius: 22px;
  background: #ffffff;
  border: 1px solid rgba(148, 163, 184, 0.22);
  box-shadow: 0 22px 50px rgba(15, 23, 42, 0.08);
  box-sizing: border-box;

  h1 {
    margin: 18px 0 12px;
    color: #111827;
    font-size: 30px;
    line-height: 1.2;
    letter-spacing: 0;
  }

  p {
    margin: 0;
    color: #526071;
    font-size: 16px;
    line-height: 1.6;
  }

  @media (max-width: 640px) {
    padding: 28px 22px;

    h1 {
      font-size: 24px;
    }
  }
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 7px 12px;
  border-radius: 999px;
  background: #eef4ff;
  color: #2563eb;
  font-size: 13px;
  font-weight: 800;
`;

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 28px;
`;

const PrimaryLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 18px;
  border-radius: 12px;
  background: #2563eb;
  color: #ffffff;
  font-weight: 800;
  text-decoration: none;
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.2);

  &:hover {
    background: #1d4ed8;
  }
`;
