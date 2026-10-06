import React from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { colors, fontSizes, spacing } from "../../styles/tokens";

const DetailsSection = styled.section`
  grid-column: 1 / -1;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${spacing.md};
  margin-top: ${spacing.sm};
  padding-top: ${spacing.lg};
  border-top: 1px solid ${colors.borderSubtle};

  && > .span-2 { grid-column: 1 / -1; }
  @media (max-width: 480px) { grid-template-columns: minmax(0, 1fr); }
`;
const DetailsTitle = styled.h3`
  grid-column: 1 / -1;
  margin: 0;
  color: ${colors.ink};
  font-size: ${fontSizes.body};
  font-weight: 800;
`;
export default function SchedulingDetails({ separated, title, children }) {
  if (!separated) return children;
  return <DetailsSection aria-labelledby="creation-details-title">
    <DetailsTitle id="creation-details-title">{title}</DetailsTitle>
    {children}
  </DetailsSection>;
}
SchedulingDetails.propTypes = {
  separated: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};
