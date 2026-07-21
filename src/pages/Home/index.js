import React from "react";
import TopNavbar from "../../components/Nav/TopNavbar";
import TenantLoading from "../../components/TenantLoading";
import { usePublicClinicContext } from "../../contexts/PublicClinicContext";
import PublicLandingModuleRenderer from "../../components/PublicLanding/PublicLandingModuleRenderer";
import { getRenderableLandingModules } from "../../components/PublicLanding/publicLandingModules";

export default function HomePage() {
  const { loaded, loading, publicClinic } = usePublicClinicContext();

  if (loading || !loaded) {
    return <TenantLoading />;
  }

  return (
    <>
      <TopNavbar />
      <PublicLandingModuleRenderer modules={getRenderableLandingModules(publicClinic)} />
    </>
  );
}
