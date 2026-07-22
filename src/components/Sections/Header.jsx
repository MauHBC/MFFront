import React from "react";
import PropTypes from "prop-types";
import { usePublicClinicContext } from "../../contexts/PublicClinicContext";
import { normalizePublicLandingConfig } from "../../utils/publicLanding";
import PublicHero from "../PublicLanding/PublicHero";

export default function Header({ content }) {
  const { displayName, publicClinic } = usePublicClinicContext();
  const config = normalizePublicLandingConfig({ publicClinic, displayName });

  return <PublicHero config={{
    ...config,
    title: content?.title || config.title,
    titleLine2: content?.title_line_2 || "",
  }} />;
}

Header.propTypes = {
  content: PropTypes.shape({
    title: PropTypes.string,
    title_line_2: PropTypes.string,
  }),
};

Header.defaultProps = { content: null };
