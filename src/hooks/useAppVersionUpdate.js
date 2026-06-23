import { useCallback, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

import {
  APP_VERSION_CHECK_THROTTLE_MS,
  fetchAppVersion,
  getLoadedAppVersionId,
  getAppVersionId,
} from "../services/appVersion";

const EDITABLE_SELECTOR = [
  "input:not([type='button']):not([type='checkbox']):not([type='color']):not([type='file']):not([type='hidden']):not([type='image']):not([type='radio']):not([type='range']):not([type='reset']):not([type='submit'])",
  "textarea",
  "select",
  "[contenteditable='']",
  "[contenteditable='true']",
  "[contenteditable='plaintext-only']",
].join(",");

const MODAL_SELECTOR = [
  "[role='dialog']",
  "[aria-modal='true']",
  ".ReactModal__Content",
  "[data-reload-block='true']",
].join(",");

function isVisible(element) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.display !== "none" &&
    style.visibility !== "hidden"
  );
}

function hasVisibleModal() {
  if (document.querySelector(MODAL_SELECTOR)) return true;

  return Array.from(document.body.querySelectorAll("*")).some((element) => {
    const style = window.getComputedStyle(element);
    const zIndex = Number.parseInt(style.zIndex, 10);

    return (
      isVisible(element) &&
      style.position === "fixed" &&
      Number.isFinite(zIndex) &&
      zIndex >= 1000
    );
  });
}

function isEditingElement(element) {
  return Boolean(element?.matches?.(EDITABLE_SELECTOR));
}

function isSensitivePath(pathname) {
  return (
    pathname.startsWith("/cadastro/paciente/") ||
    pathname === "/pacientes/novo" ||
    /^\/pacientes\/[^/]+\/avaliacoes\/nova\/?$/.test(pathname)
  );
}

export function isSafeToReloadApp(pathname = window.location.pathname) {
  const { activeElement } = document;

  if (isSensitivePath(pathname)) return false;
  if (isEditingElement(activeElement)) return false;
  if (hasVisibleModal()) return false;

  return true;
}

export default function useAppVersionUpdate() {
  const location = useLocation();
  const currentPathRef = useRef(location.pathname);
  const loadedVersionIdRef = useRef(getLoadedAppVersionId());
  const checkingRef = useRef(false);
  const lastCheckAtRef = useRef(0);
  const pendingReloadRef = useRef(false);

  const reloadWhenSafe = useCallback(() => {
    if (!pendingReloadRef.current) return;
    if (!isSafeToReloadApp(currentPathRef.current)) return;

    window.location.reload();
  }, []);

  const checkForUpdate = useCallback(async ({ force = false } = {}) => {
    reloadWhenSafe();

    if (pendingReloadRef.current || checkingRef.current) return;

    const now = Date.now();
    if (!force && now - lastCheckAtRef.current < APP_VERSION_CHECK_THROTTLE_MS) {
      return;
    }

    checkingRef.current = true;
    lastCheckAtRef.current = now;

    try {
      const versionPayload = await fetchAppVersion();
      if (!versionPayload) return;

      const nextVersionId = getAppVersionId(versionPayload);
      const loadedVersionId =
        loadedVersionIdRef.current || getLoadedAppVersionId();

      if (!nextVersionId) return;

      if (!loadedVersionId) {
        loadedVersionIdRef.current = nextVersionId;
        return;
      }

      if (loadedVersionId !== nextVersionId) {
        pendingReloadRef.current = true;
        reloadWhenSafe();
      }
    } catch (error) {
      console.debug("App version check skipped.", error);
    } finally {
      checkingRef.current = false;
    }
  }, [reloadWhenSafe]);

  useEffect(() => {
    checkForUpdate({ force: true });

    const handleFocus = () => checkForUpdate();
    const handleOnline = () => checkForUpdate();
    const handleFocusOut = () => window.setTimeout(reloadWhenSafe, 0);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkForUpdate();
      }
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleOnline);
    document.addEventListener("focusout", handleFocusOut);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("focusout", handleFocusOut);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [checkForUpdate, reloadWhenSafe]);

  useEffect(() => {
    currentPathRef.current = location.pathname;
    checkForUpdate();
  }, [checkForUpdate, location.pathname, location.search]);
}
