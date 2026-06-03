import React from "react";
import styled from "styled-components";
import TopNavbar from "../../components/Nav/TopNavbar";
import Header from "../../components/Sections/Header";
import Services from "../../components/Sections/Services";
// import Projects from "../../components/Sections/Projects";
// import Blog from "../../components/Sections/Blog";
// import Pricing from "../../components/Sections/Pricing";
import Contact from "../../components/Sections/Contact";
import Footer from "../../components/Sections/Footer";
import { usePublicClinicContext } from "../../contexts/PublicClinicContext";

export default function HomePage() {
  const { loading } = usePublicClinicContext();

  if (loading) {
    return <PublicLandingLoading aria-label="Carregando identidade da clínica" />;
  }

  return (
    <>
      <TopNavbar />
      <Header />
      <Services />
      {/* <Projects /> */}
      {/* <Blog /> */}
      {/* <Pricing /> */}
      <Contact />
      <Footer />
    </>
  );
}

const PublicLandingLoading = styled.div`
  min-height: 100vh;
  width: 100%;
  background: #fff;
`;
