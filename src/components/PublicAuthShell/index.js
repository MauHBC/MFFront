import React from "react";
import PropTypes from "prop-types";

import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/sora/wght.css";

import wordmark from "../../assets/brand/motria-wordmark.png";
import {
  BrandImage,
  Content,
  FormPanel,
  Institution,
  InstitutionCopy,
  InstitutionVisual,
  Shell,
} from "./styled";

// Presentation only: authentication, navigation and tenant authority stay with each page/provider.
export default function PublicAuthShell({ title, description, children, footer }) {
  return (
    <Shell>
      <Institution aria-label="Motria">
        <BrandImage src={wordmark} alt="Motria" />
        <InstitutionVisual aria-hidden="true">
          <svg viewBox="0 0 560 400" focusable="false">
            <ellipse cx="280" cy="201" rx="245" ry="165" fill="#D9EFEC" />
            <path d="M42 264c50-127 149-190 265-181 83 6 151 53 198 127" fill="none" stroke="#B6DDDA" strokeWidth="2" />
            <path d="M58 301c76 42 157 45 238 12 74-31 132-90 179-176" fill="none" stroke="#B6DDDA" strokeWidth="2" />
            <rect x="73" y="71" width="414" height="258" rx="32" fill="#F9FCFC" stroke="#C0DFDC" strokeWidth="2" />
            <path d="M114 268c68 27 111 9 159-47 48-55 93-108 172-91" fill="none" stroke="#E5F4F2" strokeWidth="58" strokeLinecap="round" />
            <path d="M115 272c60 25 112 4 157-48 49-57 96-104 169-92" fill="none" stroke="#0F3159" strokeWidth="17" strokeLinecap="round" />
            <path d="M116 227c62-28 106-33 149 10 48 48 100 33 171-64" fill="none" stroke="#0EA5A4" strokeWidth="17" strokeLinecap="round" />
            <circle cx="439" cy="171" r="21" fill="#F9FCFC" stroke="#0EA5A4" strokeWidth="4" />
            <circle cx="439" cy="171" r="8" fill="#0EA5A4" />
            <circle cx="114" cy="268" r="5" fill="#F9FCFC" />
            <circle cx="116" cy="227" r="5" fill="#F9FCFC" />
          </svg>
        </InstitutionVisual>
        <InstitutionCopy>
          <h2>Movimento com direção.</h2>
          <p>Sua rotina de gestão começa aqui.</p>
        </InstitutionCopy>
      </Institution>

      <FormPanel>
        <Content>
          <BrandImage src={wordmark} alt="Motria" $compact />
          <header>
            <h1>{title}</h1>
            {description && <p>{description}</p>}
          </header>
          {children}
          {footer && <div>{footer}</div>}
        </Content>
      </FormPanel>
    </Shell>
  );
}

PublicAuthShell.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  children: PropTypes.node.isRequired,
  footer: PropTypes.node,
};

PublicAuthShell.defaultProps = {
  description: "",
  footer: null,
};
