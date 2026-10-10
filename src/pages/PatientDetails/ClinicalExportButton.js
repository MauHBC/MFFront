import PropTypes from 'prop-types';
import React, { useEffect, useId, useRef, useState } from "react";
import styled from "styled-components";
import { GhostButton, PrimaryButton } from "../../components/AppButton";
import { colors, fontSizes, radii, spacing } from "../../styles/tokens";
import api, { getUserFacingApiError } from "../../services/axios";
import { downloadPdfResponse } from "../../services/documents";

const Action = styled(GhostButton)`
  display: inline-flex; align-items: center; align-self: flex-start;
  width: auto; flex: 0 0 auto; white-space: nowrap; font-size: ${fontSizes.compact};
`;
const Backdrop = styled.div`
  position: fixed; inset: 0; background: rgba(20, 35, 40, .4);
  z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 20px;
`;
const Panel = styled.div`
  background: ${colors.surface}; color: ${colors.textPrimary}; border-radius: ${radii.xl};
  padding: ${spacing.xl}; width: min(480px, 100%); max-height: 85vh; overflow: auto;
  box-shadow: 0 16px 60px rgba(20, 35, 40, .2);
  h2 { margin: 0 0 ${spacing.xl}; font-size: 20px; }
  p { line-height: 1.5; }
`;
const Controls = styled.div`
  display: grid; gap: ${spacing.lg};
  label { display: grid; gap: ${spacing.sm}; font-size: ${fontSizes.compact}; font-weight: 600; }
  input[type="date"] { box-sizing: border-box; width: 100%; height: 40px; border: 1px solid ${colors.borderSubtle}; border-radius: ${radii.sm}; padding: 9px 10px; font: inherit; line-height: 20px; background: ${colors.surface}; color: ${colors.textPrimary}; }
  input:disabled { opacity: .65; }
  input:focus-visible { outline: 2px solid ${colors.textPrimary}; outline-offset: 2px; }
`;
const Choices = styled.fieldset`
  border: 0; padding: 0; margin: 0;
  legend { padding: 0; margin-bottom: ${spacing.sm}; font-size: ${fontSizes.compact}; font-weight: 600; }
  div { display: flex; gap: ${spacing.lg}; flex-wrap: wrap; }
  label { display: inline-flex; align-items: center; gap: ${spacing.sm}; font-weight: 400; min-height: 28px; cursor: pointer; }
  input { margin: 0; }
`;
const Dates = styled.div`
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: ${spacing.md};
  @media (max-width: 480px) { grid-template-columns: 1fr; }
`;
const Result = styled.div`
  margin-top: ${spacing.xl};
  p { margin: 0; line-height: 1.5; }
  p + p { margin-top: ${spacing.sm}; font-size: ${fontSizes.compact}; color: ${colors.textSecondary}; }
`;const Footer = styled.div`display: flex; gap: ${spacing.md}; justify-content: flex-end; margin-top: ${spacing.xl}; flex-wrap: wrap;`;
const message = (error) => getUserFacingApiError(error, "Não foi possível exportar o prontuário. Tente novamente.");

export default function ClinicalExportButton({ patientId = null, recordId = null, buttonComponent: ButtonComponent = Action }) {
  const [open, setOpen] = useState(false);
  const [manifest, setManifest] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("all");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [retry, setRetry] = useState(0);
  const [bounds, setBounds] = useState({ start: "", end: "" });
  const generation = useRef(0);
  const trigger = useRef(null);
  const panel = useRef(null);
  const titleId = useId();
  const route = recordId ? `/evaluations/${recordId}/export` : `/patients/${patientId}/clinical-export`;
  const valid = mode === "all" || Boolean(start && end && end >= start);
  const params = mode === "all" ? null : { date_mode: mode, start_date: start, end_date: end };
  useEffect(() => {
    generation.current += 1;
    if (!open) return undefined;
    const {current} = generation;
    setManifest(null);
    setError("");
    if (!valid) { setBusy(false); return undefined; }
    setBusy(true);
    const query = mode === "all" ? undefined : { params: { date_mode: mode, start_date: start, end_date: end } };
    const request = query ? api.get(`${route}/preview`, query) : api.get(`${route}/preview`);
    request.then((response) => {
      if (current !== generation.current) return;
      setManifest(response.data);
      if (mode === "all") {
        const dates = response.data.period?.match(/(\d{2})\/(\d{2})\/(\d{4})/g) || [];
        const iso = (date) => date ? date.split("/").reverse().join("-") : "";
        setBounds({ start: iso(dates[0]), end: iso(dates[1] || dates[0]) });
      }
    })
      .catch((failure) => { if (current === generation.current) setError(message(failure)); })
      .finally(() => { if (current === generation.current) setBusy(false); });
    return () => { generation.current += 1; };
  }, [open, route, mode, start, end, retry, valid]);
  useEffect(() => { if (open) panel.current?.focus(); }, [open]);
  const close = () => { generation.current += 1; setOpen(false); setBusy(false); trigger.current?.focus(); };
  const download = async () => {
    const {current} = generation;
    setBusy(true); setError("");
    try {
      const response = await api.get(`${route}/pdf`, { responseType: "blob", ...(params ? { params } : {}) });
      if (current === generation.current) { downloadPdfResponse(response, recordId ? "registro-clinico" : "prontuario"); close(); }
    } catch (failure) { if (current === generation.current) setError(message(failure)); }
    finally { if (current === generation.current) setBusy(false); }
  };
  const handleKeys = (event) => {
    if (event.key === "Escape" && !busy) close();
    if (event.key !== "Tab") return;
    const items = panel.current?.querySelectorAll("button:not(:disabled), input:not(:disabled), select:not(:disabled)");
    if (!items?.length) { event.preventDefault(); return; }
    const first = items[0]; const last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  const empty = manifest && (manifest.empty ?? (!manifest.count && !manifest.references && !manifest.cases));
  return <>
    <ButtonComponent ref={trigger} type="button" onClick={() => { setMode("all"); setOpen(true); }} disabled={open}>
      {recordId ? "Exportar PDF" : "Exportar prontuário"}
    </ButtonComponent>
    {open && <Backdrop><Panel ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={handleKeys}>
      <h2 id={titleId}>{recordId ? "Exportar registro" : "Exportar prontuário"}</h2>
      {!recordId && <Controls>
        <Choices><legend>Registros</legend><div>
          <label htmlFor={`${titleId}-all`}><input id={`${titleId}-all`} type="radio" name={`${titleId}-scope`} value="all" checked={mode === "all"} onChange={() => setMode("all")} />Todo o prontuário</label>
          <label htmlFor={`${titleId}-period`}><input id={`${titleId}-period`} type="radio" name={`${titleId}-scope`} value="period" checked={mode === "period"} onChange={() => { setStart((value) => value || bounds.start); setEnd((value) => value || bounds.end); setMode("period"); }} />Período</label>
        </div></Choices>
        <Dates>
          <label htmlFor={`${titleId}-start`}>Data inicial<input id={`${titleId}-start`} type="date" disabled={mode === "all"} value={mode === "all" ? bounds.start : start} onInput={(event) => setStart(event.currentTarget.value)} onChange={(event) => setStart(event.target.value)} /></label>
          <label htmlFor={`${titleId}-end`}>Data final<input id={`${titleId}-end`} type="date" disabled={mode === "all"} min={start || undefined} value={mode === "all" ? bounds.end : end} onInput={(event) => setEnd(event.currentTarget.value)} onChange={(event) => setEnd(event.target.value)} /></label>
        </Dates>
      </Controls>}      {!valid && <p role="status">{start && end && end < start ? "O fim deve ser igual ou posterior ao início." : "Selecione as datas."}</p>}
      {busy && <p role="status">Consultando registros...</p>}
      {error && <p role="alert">{error}</p>}
      {manifest && !busy && <Result>
        <p><strong>{manifest.count} {manifest.count === 1 ? "registro" : "registros"}</strong>{manifest.references > 0 ? ` · ${manifest.references} referências` : ""}</p>
        {empty && <p role="status">Nenhum registro encontrado nas datas selecionadas.</p>}
        {manifest.states?.draft > 0 && <p>Inclui rascunhos não assinados.</p>}
      </Result>}
      <Footer>
        <Action type="button" onClick={close}>Cancelar</Action>
        {error && !manifest && <Action type="button" onClick={() => setRetry((value) => value + 1)}>Tentar novamente</Action>}
        <PrimaryButton type="button" disabled={busy || !valid || !manifest || Boolean(empty)} onClick={download}>Baixar PDF</PrimaryButton>
      </Footer>
    </Panel></Backdrop>}
  </>;
}
ClinicalExportButton.propTypes = { buttonComponent: PropTypes.elementType, patientId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), recordId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]) };
ClinicalExportButton.defaultProps = { patientId: null, recordId: null, buttonComponent: Action };
