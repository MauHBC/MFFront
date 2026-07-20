/* eslint-disable react/require-default-props */
import React from "react";
import PropTypes from "prop-types";

const PUBLIC_NAV_ITEMS = [
  { label: "Início", target: "home" },
  { label: "Estrutura", target: "contact", requiresContact: true },
  { label: "Serviços", target: "services", requiresServices: true },
  { label: "Sobre", target: "about", requiresAbout: true },
];

export default function PublicNavLinks({
  className = "",
  onNavigate = undefined,
  showAbout = false,
  showContact = false,
  showServices = true,
}) {
  const handleNavigate = (target) => (event) => {
    const targetElement = typeof document !== "undefined"
      ? document.getElementById(target)
      : null;
    if (targetElement) {
      event.preventDefault();
      const prefersReducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      const top = targetElement.getBoundingClientRect().top + window.scrollY - 104;
      window.scrollTo({
        top,
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });
      if (window.history?.pushState) {
        window.history.pushState(null, "", `#${target}`);
      }
    }
    onNavigate?.();
  };

  return (
    <ul className={className}>
      {PUBLIC_NAV_ITEMS
        .filter((item) => !item.requiresServices || showServices)
        .filter((item) => !item.requiresAbout || showAbout)
        .filter((item) => !item.requiresContact || showContact)
        .map((item) => (
          <li key={item.target}>
            <a href={`#${item.target}`} onClick={handleNavigate(item.target)}>
              {item.label}
            </a>
          </li>
        ))}
    </ul>
  );
}

PublicNavLinks.propTypes = {
  className: PropTypes.string,
  onNavigate: PropTypes.func,
  showAbout: PropTypes.bool,
  showContact: PropTypes.bool,
  showServices: PropTypes.bool,
};
