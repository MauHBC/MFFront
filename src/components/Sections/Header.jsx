import React from "react";
import PropTypes from "prop-types";
import { usePublicClinicContext } from "../../contexts/PublicClinicContext";
import { normalizePublicLandingConfig } from "../../utils/publicLanding";
import PublicHero from "../PublicLanding/PublicHero";

export default function Header({ content }) {
  const { displayName, publicClinic } = usePublicClinicContext();
  const config = normalizePublicLandingConfig({ publicClinic, displayName });
  const hasContentField = (field) => (
    content && Object.prototype.hasOwnProperty.call(content, field)
  );

  return <PublicHero config={{
    ...config,
    eyebrow: hasContentField("eyebrow") ? content.eyebrow || "" : config.eyebrow,
    title: hasContentField("title") ? content.title || "" : config.title,
    titleLine2: hasContentField("title_line_2") ? content.title_line_2 || "" : "",
  }} />;
}

Header.propTypes = {
  content: PropTypes.shape({
    eyebrow: PropTypes.string,
    title: PropTypes.string,
    title_line_2: PropTypes.string,
  }),
};

Header.defaultProps = { content: null };
