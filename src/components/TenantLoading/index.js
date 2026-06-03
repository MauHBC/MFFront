import React from "react";
import PropTypes from "prop-types";
import styled, { keyframes } from "styled-components";

export default function TenantLoading({ compact, label }) {
  return (
    <Wrapper $compact={compact} aria-label={label} role="status">
      <Spinner aria-hidden="true" $compact={compact} />
      <span>{label}</span>
    </Wrapper>
  );
}

TenantLoading.defaultProps = {
  compact: false,
  label: "Carregando...",
};

TenantLoading.propTypes = {
  compact: PropTypes.bool,
  label: PropTypes.string,
};

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

const Wrapper = styled.div`
  min-height: ${(props) => (props.$compact ? "auto" : "100vh")};
  width: ${(props) => (props.$compact ? "auto" : "100%")};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: ${(props) => (props.$compact ? "transparent" : "#fff")};
  color: #647067;
  font-size: ${(props) => (props.$compact ? "0.88rem" : "0.95rem")};
  font-weight: 600;
`;

const Spinner = styled.span`
  width: ${(props) => (props.$compact ? "18px" : "24px")};
  height: ${(props) => (props.$compact ? "18px" : "24px")};
  border: 2px solid rgba(100, 112, 103, 0.22);
  border-top-color: #647067;
  border-radius: 50%;
  animation: ${spin} 0.75s linear infinite;
`;
