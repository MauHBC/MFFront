import React, {
  Children,
  cloneElement,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { RowActionButton } from "../AppButton";
import { colors, radii, shadows, spacing } from "../../styles/tokens";

const MENU_ITEM_SELECTOR = '[role="menuitem"]:not(:disabled)';

export default function AppActionMenu({
  label,
  visibleLabel = "Ações",
  compact = false,
  disabled = false,
  showIndicator = true,
  agendaAppearance = false,
  children,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const closeAndRestoreFocus = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (disabled && open) setOpen(false);
  }, [disabled, open]);

  useEffect(() => {
    if (!open) return undefined;

    menuRef.current?.querySelector(MENU_ITEM_SELECTOR)?.focus();
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") closeAndRestoreFocus();
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [closeAndRestoreFocus, open]);

  const handleMenuKeyDown = (event) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = Array.from(menuRef.current?.querySelectorAll(MENU_ITEM_SELECTOR) || []);
    if (!items.length) return;
    event.preventDefault();
    const currentIndex = items.indexOf(document.activeElement);
    let nextIndex = currentIndex;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;
    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1 + items.length) % items.length;
    if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + items.length) % items.length;
    items[nextIndex]?.focus();
  };

  const enhanceMenuItem = (child) => {
    if (!isValidElement(child)) return child;
    if (child.type === Fragment) {
      return cloneElement(child, {}, Children.map(child.props.children, enhanceMenuItem));
    }
    const actionable = child.props.onClick
      || child.props.type === "button"
      || child.props.href;
    if (!actionable) return child;
    return cloneElement(child, {
      role: "menuitem",
      tabIndex: -1,
      onClick: (event) => {
        child.props.onClick?.(event);
        if (!event.defaultPrevented) setOpen(false);
      },
    });
  };

  const items = Children.map(children, enhanceMenuItem);

  return (
    <MenuRoot ref={rootRef}>
      <MenuTrigger
        ref={triggerRef}
        type="button"
        $compact={compact}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={disabled ? false : open}
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen((current) => !current);
        }}
      >
        {!compact && visibleLabel}
        {showIndicator && <span aria-hidden="true">⋯</span>}
      </MenuTrigger>
      {open && !disabled && (
        <MenuPopover
          ref={menuRef}
          $agendaAppearance={agendaAppearance}
          role="menu"
          aria-label={label}
          onKeyDown={handleMenuKeyDown}
        >
          {items}
        </MenuPopover>
      )}
    </MenuRoot>
  );
}

AppActionMenu.propTypes = {
  label: PropTypes.string.isRequired,
  visibleLabel: PropTypes.string,
  compact: PropTypes.bool,
  disabled: PropTypes.bool,
  children: PropTypes.node.isRequired,
  showIndicator: PropTypes.bool,
  agendaAppearance: PropTypes.bool,
};

AppActionMenu.defaultProps = {
  compact: false,
  disabled: false,
  visibleLabel: "Ações",
  showIndicator: true,
  agendaAppearance: false,
};

const MenuRoot = styled.div`
  position: relative;
  display: inline-flex;
`;

const MenuTrigger = styled(RowActionButton)`
  min-width: ${(props) => (props.$compact ? "36px" : "auto")};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;

  span {
    font-size: 1.1rem;
    line-height: 0.7;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`;

const MenuPopover = styled.div`
  position: absolute;
  z-index: 60;
  top: calc(100% + ${spacing.xs});
  right: 0;
  display: grid;
  min-width: 210px;
  padding: ${spacing.xs};
  border: 1px solid ${colors.borderSubtle};
  border-radius: ${radii.md};
  background: ${colors.surface};
  box-shadow: ${shadows.elevated};

  button {
    width: 100%;
    display: inline-flex;
    justify-content: flex-start;
    border-color: transparent;
    text-align: left;
  }

  ${(props) => props.$agendaAppearance && `
    top: calc(100% + 4px); z-index: 200; background: #fff;
    border: 1px solid rgba(106, 121, 92, 0.18); border-radius: 12px;
    box-shadow: 0 12px 30px rgba(32, 43, 27, 0.16);
    padding: 6px; min-width: 164px; display: flex; flex-direction: column; gap: 2px;
  `}

  @media (max-width: 620px) {
    min-width: min(240px, calc(100vw - 64px));
  }
`;

export const AppActionMenuItem = styled(RowActionButton)``;

// Same neutral action item as Agenda's day dropdown; no status tone is applied.
export const AgendaActionMenuItem = styled.button`
  background: none; border: none; text-align: left; padding: 7px 14px;
  font-size: 0.82rem; font-weight: 500; color: #1b1b1b; cursor: pointer;
  &:disabled { cursor: not-allowed; opacity: 0.45; }
  &:not(:disabled):hover { background: rgba(106, 121, 92, 0.07); }
`;
