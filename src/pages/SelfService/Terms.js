import React from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import "./selfService.css";

export default function Terms() {
  return <main className="motria-onboarding">
    <Helmet><meta name="robots" content="noindex,nofollow" /></Helmet>
    <h1>Termos de Uso</h1>
    <p>Documento aguardando aprovação e publicação. Esta página é um placeholder para revisão técnica do cadastro e não apresenta termos legais aprovados.</p>
    <p>A abertura comercial do cadastro depende da publicação do conteúdo jurídico aprovado e de suas versões.</p>
    <Link to="/cadastro">Voltar ao cadastro</Link>
  </main>;
}
