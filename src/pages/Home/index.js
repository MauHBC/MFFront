import React from "react";
import TopNavbar from "../../components/Nav/TopNavbar";
import Header from "../../components/Sections/Header";
import Services from "../../components/Sections/Services";
import About from "../../components/Sections/About";
// import Projects from "../../components/Sections/Projects";
// import Blog from "../../components/Sections/Blog";
// import Pricing from "../../components/Sections/Pricing";
import Contact from "../../components/Sections/Contact";
import Footer from "../../components/Sections/Footer";
import TenantLoading from "../../components/TenantLoading";
import { usePublicClinicContext } from "../../contexts/PublicClinicContext";

export default function HomePage() {
  const { loaded, loading } = usePublicClinicContext();

  if (loading || !loaded) {
    return <TenantLoading />;
  }

  return (
    <>
      <TopNavbar />
      <Header />
      <Contact />
      <Services />
      <About />
      {/* <Projects /> */}
      {/* <Blog /> */}
      {/* <Pricing /> */}
      <Footer />
    </>
  );
}
