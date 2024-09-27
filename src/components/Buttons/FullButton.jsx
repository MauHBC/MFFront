import React from "react";
import styled from "styled-components";
import PropTypes from "prop-types";

export default function FullButton({ title, action, border }) {
  return (
    <Wrapper
      className="animate pointer radius8"
      onClick={action ? () => action() : null}
      border={border}
    >
      {title}
    </Wrapper>
  );
}

FullButton.propTypes = {
  title: PropTypes.string.isRequired,
  action: PropTypes.func,
  border: PropTypes.bool,
};

FullButton.defaultProps = {
  action: () => {},
  border: false,
};

const Wrapper = styled.button`
  border: 1px solid ${(props) => (props.border ? "#707070" : "")};
  background-color: ${(props) => (props.border ? "transparent" : "#143610")};
  width: 100%;
  padding: 15px;
  outline: none;
  color: ${(props) => (props.border ? "#707070" : "#fff")};
  :hover {
    background-color: ${(props) => (props.border ? "transparent" : "#580cd2")};
    border: 1px solid #143610;
    color: ${(props) => (props.border ? "#143610" : "#fff")};
  }
`;
