import React from "react";
import LegalDocument from "./LegalDocument";
import legalContent from "./legalContent.json";

export default function Privacy() {
  return <LegalDocument legalDocument={legalContent.privacy} />;
}
