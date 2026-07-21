import React from "react";
import PropTypes from "prop-types";
import Header from "../Sections/Header";
import Services from "../Sections/Services";
import About from "../Sections/About";
import Contact from "../Sections/Contact";
import Footer from "../Sections/Footer";
import Gallery from "../Sections/Gallery";
import Differentials from "../Sections/Differentials";
import {
  Approach,
  Audience,
  Conversion,
  Professionals,
  Testimonials,
  WhatIs,
} from "../Sections/ModularSections";
import { LandingBackgroundVariantProvider } from "./publicLandingPrimitives";

const COMPONENTS = Object.freeze({
  hero: Header,
  gallery: Gallery,
  whatIs: WhatIs,
  landingServices: Services,
  differentials: Differentials,
  audience: Audience,
  conversion: Conversion,
  about: About,
  approach: Approach,
  professionals: Professionals,
  testimonials: Testimonials,
  contact: Contact,
  footer: Footer,
});

export default function PublicLandingModuleRenderer({ modules }) {
  return modules.map((module) => {
    const Component = COMPONENTS[module.component];
    if (!Component) return null;
    return (
      <LandingBackgroundVariantProvider key={module.key} variant={module.backgroundVariant}>
        <Component content={module.content} />
      </LandingBackgroundVariantProvider>
    );
  });
}

PublicLandingModuleRenderer.propTypes = {
  modules: PropTypes.arrayOf(PropTypes.shape({
    component: PropTypes.string,
    backgroundVariant: PropTypes.string,
    content: PropTypes.shape({}).isRequired,
    key: PropTypes.string.isRequired,
    visible: PropTypes.bool.isRequired,
  })).isRequired,
};
