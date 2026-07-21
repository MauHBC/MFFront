import React from "react";
import PropTypes from "prop-types";
import Header from "../Sections/Header";
import Services from "../Sections/Services";
import About from "../Sections/About";
import Contact from "../Sections/Contact";
import Footer from "../Sections/Footer";

const COMPONENTS = Object.freeze({
  hero: Header,
  galleryContact: Contact,
  landingServices: Services,
  aboutDifferentials: About,
  footer: Footer,
});

export default function PublicLandingModuleRenderer({ modules }) {
  return modules.map((module) => {
    const Component = COMPONENTS[module.component];
    if (!Component) return null;
    if (module.component === "galleryContact") {
      return (
        <Component
          key={module.component}
          showContact={module.visibleSections.includes("contact")}
          showGallery={module.visibleSections.includes("gallery")}
        />
      );
    }
    if (module.component === "aboutDifferentials") {
      return (
        <Component
          key={module.component}
          showAbout={module.visibleSections.includes("about")}
          showDifferentials={module.visibleSections.includes("differentials")}
        />
      );
    }
    return <Component key={module.component} />;
  });
}

PublicLandingModuleRenderer.propTypes = {
  modules: PropTypes.arrayOf(PropTypes.shape({
    component: PropTypes.string,
    key: PropTypes.string.isRequired,
    visible: PropTypes.bool.isRequired,
    visibleSections: PropTypes.arrayOf(PropTypes.string).isRequired,
  })).isRequired,
};
