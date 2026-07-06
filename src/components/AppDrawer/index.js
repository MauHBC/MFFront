import React from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { alpha, colors, layout } from "../../styles/tokens";

/**
 * Drawer lateral padronizado para o app admin.
 */

export const AppDrawer = styled.aside`
  position: fixed;
  top: ${layout.topbarHeight};
  right: 0;
  width: 440px;
  max-width: 90vw;
  height: calc(100vh - ${layout.topbarHeight});
  background: ${colors.white};
  box-shadow: -12px 0 24px ${alpha.drawerShadow};
  transform: ${(props) => (props.$open ? "translateX(0)" : "translateX(100%)")};
  transition: transform 0.3s ease;
  z-index: 20;
  display: flex;
  flex-direction: column;
`;

export const DrawerBackdrop = styled.div`
  position: fixed;
  top: ${layout.topbarHeight};
  left: 0;
  right: 0;
  bottom: 0;
  background: ${alpha.overlay};
  z-index: 10;
`;

export const DrawerHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 16px;
  border-bottom: 1px solid ${alpha.brand012};
  flex-shrink: 0;
`;

export const DrawerTitle = styled.h2`
  font-size: 1rem;
  font-weight: 800;
  color: ${colors.ink};
  margin: 0;
`;

export const DrawerCloseBtn = styled.button`
  background: none;
  border: none;
  color: ${colors.softText};
  cursor: pointer;
  padding: 4px;
  font-size: 1rem;
  display: flex;
  align-items: center;
  transition: color 0.12s;

  &:hover {
    color: ${colors.ink};
  }
`;

export const DrawerBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
`;

export const DrawerFooter = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid ${alpha.brand010};
`;

export function UnsavedChangesDialog({
  open,
  onKeepEditing,
  onDiscard,
}) {
  if (!open) return null;

  return (
    <UnsavedDialogOverlay role="presentation">
      <UnsavedDialogCard role="dialog" aria-modal="true" aria-labelledby="unsaved-dialog-title">
        <UnsavedDialogTitle id="unsaved-dialog-title">
          Alterações não salvas
        </UnsavedDialogTitle>
        <UnsavedDialogBody>
          Você tem alterações não salvas. Tem certeza que deseja descartá-las?
        </UnsavedDialogBody>
        <UnsavedDialogActions>
          <UnsavedKeepButton type="button" onClick={onKeepEditing}>
            Continuar editando
          </UnsavedKeepButton>
          <UnsavedDiscardButton type="button" onClick={onDiscard}>
            Descartar alterações
          </UnsavedDiscardButton>
        </UnsavedDialogActions>
      </UnsavedDialogCard>
    </UnsavedDialogOverlay>
  );
}

UnsavedChangesDialog.propTypes = {
  open: PropTypes.bool,
  onKeepEditing: PropTypes.func.isRequired,
  onDiscard: PropTypes.func.isRequired,
};

UnsavedChangesDialog.defaultProps = {
  open: false,
};

const UnsavedDialogOverlay = styled.div`
  align-items: center;
  background: rgba(0, 0, 0, 0.38);
  display: flex;
  inset: 0;
  justify-content: center;
  padding: 18px;
  position: fixed;
  z-index: 5000;
`;

const UnsavedDialogCard = styled.div`
  background: ${colors.white};
  border: 1px solid ${alpha.brand014};
  border-radius: 10px;
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.18);
  max-width: 420px;
  overflow: hidden;
  width: min(100%, 420px);
`;

const UnsavedDialogTitle = styled.h2`
  border-bottom: 1px solid ${alpha.brand012};
  color: ${colors.ink};
  font-size: 1rem;
  font-weight: 800;
  margin: 0;
  padding: 18px 22px;
`;

const UnsavedDialogBody = styled.p`
  border-bottom: 1px solid ${alpha.brand012};
  color: ${colors.ink};
  font-size: 0.92rem;
  line-height: 1.55;
  margin: 0;
  padding: 18px 22px;
`;

const UnsavedDialogActions = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding: 14px 22px 16px;
`;

const UnsavedKeepButton = styled.button`
  background: ${colors.fieldDisabledBackground};
  border: 1px solid ${alpha.brand014};
  border-radius: 8px;
  color: ${colors.ink};
  cursor: pointer;
  font-size: 0.86rem;
  font-weight: 700;
  padding: 9px 14px;

  &:hover {
    background: ${alpha.brand006};
  }
`;

const UnsavedDiscardButton = styled.button`
  background: ${colors.brandDark};
  border: 1px solid ${colors.brandDark};
  border-radius: 8px;
  color: ${colors.white};
  cursor: pointer;
  font-size: 0.86rem;
  font-weight: 700;
  padding: 9px 14px;

  &:hover {
    background: ${colors.brand};
    border-color: ${colors.brand};
  }
`;
