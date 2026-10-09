import React from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { FaTimes } from 'react-icons/fa';
import { AppDrawer } from '../../components/AppDrawer';

export const DrawerHeader = styled.div`
  padding: ${(props) => (props.$compact ? "16px 20px" : "22px 20px")};
  border-bottom: 1px solid rgba(106, 121, 92, 0.15);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  h2 { margin: 0 0 6px; }
  span { color: #6a795c; font-size: 0.9rem; }
`;
export const DrawerBody = styled.div`
  padding: ${(props) => (props.$compact ? "16px 20px 20px" : "28px 20px 20px")};
  overflow-y: auto;
  flex: 1;
`;
export const DrawerActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
  flex-wrap: ${(props) => (props.$wrap ? 'wrap' : 'nowrap')};
`;
export const IconButton = styled.button`
  border: none;
  background: transparent;
  color: #6a795c;
  font-size: 1.1rem;
`;

export function AgendaDrawerShell({ open, compact, title, subtitle, onClose, closeLabel, closeDisabled, drawerRef, dialogLabel, children }) {
  return <AppDrawer $open={open} ref={drawerRef} tabIndex={dialogLabel ? -1 : undefined}
    role={dialogLabel ? 'dialog' : undefined} aria-modal={dialogLabel ? true : undefined} aria-label={dialogLabel || undefined}>
    <DrawerHeader $compact={compact}><div><h2>{title}</h2>{subtitle}</div>
      <IconButton type="button" aria-label={closeLabel} disabled={closeDisabled} onClick={onClose}><FaTimes aria-hidden="true" /></IconButton>
    </DrawerHeader>
    <DrawerBody $compact={compact}>{children}</DrawerBody>
  </AppDrawer>;
}
AgendaDrawerShell.propTypes = {
  open: PropTypes.bool.isRequired,
  compact: PropTypes.bool,
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.node,
  onClose: PropTypes.func.isRequired,
  closeLabel: PropTypes.string,
  closeDisabled: PropTypes.bool,
  drawerRef: PropTypes.shape({}),
  dialogLabel: PropTypes.string,
  children: PropTypes.node.isRequired,
};
AgendaDrawerShell.defaultProps = { compact: false, subtitle: null, closeLabel: 'Fechar agendamento', closeDisabled: false, drawerRef: null, dialogLabel: null };
