import React from "react";
import { usePublicClinicContext } from "../../contexts/PublicClinicContext";
import { normalizePublicLandingConfig } from "../../utils/publicLanding";
import PublicHero from "../PublicLanding/PublicHero";

export default function Header() {
  const { displayName, publicClinic } = usePublicClinicContext();
  const config = normalizePublicLandingConfig({ publicClinic, displayName });

  return <PublicHero config={config} />;
}
