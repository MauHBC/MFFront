import React from "react";
import LegalDocument from "./LegalDocument";
import legalContent from "./legalContent.json";

export default function Terms() {
  return <LegalDocument legalDocument={legalContent.terms} />;
}
