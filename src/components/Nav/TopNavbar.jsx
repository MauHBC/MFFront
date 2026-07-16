import React from "react";
import { usePublicClinicContext } from "../../contexts/PublicClinicContext";
import { normalizePublicLandingConfig } from "../../utils/publicLanding";
import PublicLandingHeader from "../PublicLanding/PublicLandingHeader";

export default function TopNavbar() {
  const { displayName, publicClinic } = usePublicClinicContext();
  const config = normalizePublicLandingConfig({ publicClinic, displayName });

  return <PublicLandingHeader config={config} />;
}
