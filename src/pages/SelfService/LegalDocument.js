import React from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import "./selfService.css";

export default function LegalDocument({ legalDocument }) {
  return <main className="motria-onboarding motria-legal">
    <Helmet><meta name="robots" content="noindex,nofollow" /></Helmet>
    <h1>{legalDocument.title}</h1>
    <p className="motria-legal-updated">{legalDocument.updated}</p>
    <article className="motria-legal-content">
      {legalDocument.blocks.map((block) => {
        if (block.type === "heading") return <h2 key={block.text}>{block.text}</h2>;
        if (block.type === "list") return <ul key={block.items[0]}>{block.items.map((item) => <li key={item}>{item}</li>)}</ul>;
        return <p key={block.text}>{block.text}</p>;
      })}
    </article>
    <p className="motria-legal-back"><Link to="/cadastro">Voltar ao cadastro</Link></p>
  </main>;
}

LegalDocument.propTypes = {
  legalDocument: PropTypes.shape({
    title: PropTypes.string.isRequired,
    updated: PropTypes.string.isRequired,
    blocks: PropTypes.arrayOf(PropTypes.shape({
      type: PropTypes.oneOf(["heading", "list", "paragraph"]).isRequired,
      text: PropTypes.string,
      items: PropTypes.arrayOf(PropTypes.string),
    })).isRequired,
  }).isRequired,
};
