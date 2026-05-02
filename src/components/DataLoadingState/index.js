import React from "react";
import PropTypes from "prop-types";
import styled, { keyframes } from "styled-components";
import { FaSpinner } from "react-icons/fa";

export default function DataLoadingState({
  children,
  text,
  tone,
  minHeight,
  compact,
}) {
  return (
    <Container $tone={tone} $minHeight={minHeight} $compact={compact} role="status">
      {tone === "loading" && <Spinner aria-hidden="true" />}
      <span>{children || text}</span>
    </Container>
  );
}

DataLoadingState.defaultProps = {
  children: null,
  text: "Carregando...",
  tone: "loading",
  minHeight: "140px",
  compact: false,
};

DataLoadingState.propTypes = {
  children: PropTypes.node,
  text: PropTypes.string,
  tone: PropTypes.oneOf(["loading", "error", "empty"]),
  minHeight: PropTypes.string,
  compact: PropTypes.bool,
};

const Container = styled.div`
  min-height: ${({ $compact, $minHeight }) => ($compact ? "86px" : $minHeight)};
  padding: ${({ $compact }) => ($compact ? "20px 16px" : "32px 16px")};
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
  color: ${({ $tone }) => ($tone === "error" ? "#9a2f2f" : "#687263")};
  font-size: 0.95rem;
  font-weight: 700;
`;

const spin = keyframes`
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
`;

const Spinner = styled(FaSpinner)`
  flex: 0 0 auto;
  animation: ${spin} 0.85s linear infinite;
`;
