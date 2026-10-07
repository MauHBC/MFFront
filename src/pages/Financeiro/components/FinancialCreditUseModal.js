import React, { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { v4 as uuidv4 } from "uuid";
import { GhostButton, PrimaryButton } from "../../../components/AppButton";
import { colors, fontSizes, radii, spacing, typography } from "../../../styles/tokens";
import { CurrencyInputGroup, CurrencyPrefix, CurrencyInput } from "./FinancialPaymentModal";
import { getUserFacingApiError } from "../../../services/axios";
import {
  getFinancialCreditDestinations,
  previewFinancialCreditApplication,
  confirmFinancialCreditApplication,
} from "../../../services/financialCredit";
import {
  formatCurrencyInputFromCents,
  formatCurrencyInput,
  parseCurrencyInputToCents,
  sanitizePositiveCurrencyInput,
} from "../helpers/expenseFormatters";

const STALE_MESSAGE = "Os dados mudaram. Confira os valores atualizados antes de aplicar o crédito.";
const cents = (value) => Number.isSafeInteger(value) && value >= 0;
const dateLabel = (value) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return "Data não registrada";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Date(value).toLocaleString("pt-BR", {
    timeZone: dateOnly ? "UTC" : "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric",
    ...(!dateOnly ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
};
const billingCyclePeriod = (item) => [dateLabel(item.cycle_start), dateLabel(item.cycle_end)]
  .filter(Boolean).join(" a ");
const destinationLabel = (entry) => entry.destination_kind === "billing_cycle"
  ? `${entry.plan_name || "Plano não registrado"} — ${billingCyclePeriod(entry)}`
  : `${entry.service_name || "Serviço não registrado"} — ${dateLabel(entry.session_starts_at)}`;
const destinationBalanceLabel = (entry) => entry.destination_kind === "billing_cycle"
  ? "A receber nesta mensalidade após o uso"
  : "A receber nesta sessão após o uso";
const groupLabel = (group) => group.kind === "billing_cycle"
  ? `${group.plan_name || "Plano não registrado"} — ${billingCyclePeriod(group)} · vencimento ${dateLabel(group.due_date)}`
  : `${group.kind === "package" ? "Pacote" : "Sessão avulsa"} de ${group.service_name || "serviço não registrado"} — ${dateLabel(group.reference_date)}`;
const groupTitle = (group) => group.kind === "billing_cycle"
  ? group.plan_name || "Plano não registrado"
  : `${group.kind === "package" ? "Pacote" : "Sessão avulsa"} de ${group.service_name || "serviço não registrado"}`;
const groupDescription = (group) => group.kind === "billing_cycle"
  ? `${billingCyclePeriod(group)} · vencimento ${dateLabel(group.due_date)}`
  : dateLabel(group.reference_date);
const groupBalanceContext = (group) => {
  if (group.kind === "package") return "no pacote";
  if (group.kind === "billing_cycle") return "na mensalidade";
  return "na sessão";
};

function validDestinations(data, patientId) {
  return Number(data?.patient?.id) === Number(patientId)
    && Boolean(data.patient.full_name || data.patient.name)
    && cents(data.credit_available_cents)
    && Array.isArray(data.groups)
    && data.groups.every((group) => group.key && ["package", "standalone", "billing_cycle"].includes(group.kind)
      && cents(group.open_cents) && Array.isArray(group.entries) && group.entries.length > 0
      && group.entries.every((entry) => Number.isSafeInteger(entry.entry_id) && entry.entry_id > 0
        && cents(entry.open_cents) && entry.open_cents > 0));
}

function validPreview(data, command) {
  if (!validDestinations(data, command.patient_id) || !data.preview_fingerprint
    || data.amount_cents !== command.amount_cents
    || (data.discount_cents || 0) !== (command.discount_cents || 0)
    || !cents(data.credit_remaining_cents) || !cents(data.selected_open_before_cents)
    || !cents(data.selected_open_after_cents)) return false;
  const entries = data.groups.flatMap((group) => group.entries);
  const expected = new Set(command.selected_entry_ids);
  return entries.length === expected.size
    && new Set(entries.map((entry) => entry.entry_id)).size === expected.size
    && entries.every((entry) => expected.has(entry.entry_id)
      && cents(entry.allocated_cents) && cents(entry.open_after_cents))
    && data.groups.every((group) => cents(group.open_after_cents));
}

export default function FinancialCreditUseModal({ context, formatCurrency, onClose, onCompleted }) {
  const [destinations, setDestinations] = useState(null);
  const [selected, setSelected] = useState([]);
  const [expanded, setExpanded] = useState([]);
  const [amount, setAmount] = useState("");
  const [discount, setDiscount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState("destinations");
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const mounted = useRef(false);
  const inFlight = useRef(false);
  const attempt = useRef(null);
  const command = useRef(null);
  const amountInitialized = useRef(false);
  const destinationsLoaded = useRef(false);
  const refreshDestinationsOnBack = useRef(false);
  const dialog = useRef(null);
  const heading = useRef(null);
  const closeRef = useRef(onClose);
  const stateRef = useRef({ busy, uncertain });
  closeRef.current = onClose;
  stateRef.current = { busy, uncertain };
  const query = useMemo(() => ({
    patient_id: context.patientId,
    period_start: context.periodStart,
    period_end: context.periodEnd,
    ...(context.destinationType ? { destination_type: context.destinationType } : {}),
  }), [context.destinationType, context.patientId, context.periodStart, context.periodEnd]);

  const loadDestinations = async (preserve = destinationsLoaded.current) => {
    const { data } = await getFinancialCreditDestinations(query);
    if (!mounted.current) return;
    if (!validDestinations(data, context.patientId)) throw new Error("Invalid credit destinations");
    destinationsLoaded.current = true;
    setDestinations(data);
    const availableIds = new Set(data.groups.flatMap((group) => group.entries.map((entry) => entry.entry_id)));
    setSelected((previous) => {
      if (preserve) return previous.filter((id) => availableIds.has(id));
      return data.groups.length === 1 ? [...availableIds] : [];
    });
  };

  useEffect(() => {
    mounted.current = true;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    heading.current?.focus();
    inFlight.current = true;
    loadDestinations().catch((failure) => {
      if (mounted.current) setError(getUserFacingApiError(failure, "Não foi possível consultar os destinos. Tente novamente."));
    }).finally(() => {
      inFlight.current = false;
      if (mounted.current) setBusy("");
    });
    const keydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (!stateRef.current.busy && !stateRef.current.uncertain) closeRef.current();
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialog.current?.querySelectorAll("button:not(:disabled), input:not(:disabled), [tabindex='0']") || []);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      mounted.current = false;
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keydown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
    // The parent keys this modal by patient/period and unmounts on authorization changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reviewing = Boolean(preview);
  useEffect(() => { heading.current?.focus(); }, [reviewing]);
  const selectedSet = new Set(selected);
  const eligibleEntries = new Map((destinations?.groups || []).flatMap((group) => group.entries.map((entry) => [entry.entry_id, entry])));
  const selectedOpen = [...selectedSet].reduce((sum, id) => sum + (eligibleEntries.get(id)?.open_cents || 0), 0);
  const discountCents = discount ? parseCurrencyInputToCents(discount) : 0;
  const discountValid = cents(discountCents) && discountCents < selectedOpen;
  const maximum = Math.min(destinations?.credit_available_cents || 0, Math.max(0, selectedOpen - (cents(discountCents) ? discountCents : 0)));
  const destinationsAvailable = Boolean(destinations);
  useEffect(() => {
    // Seed once per opening. A refreshed limit validates the draft, never rewrites it.
    if (!destinationsAvailable || amountInitialized.current || maximum <= 0) return;
    amountInitialized.current = true;
    setAmount(formatCurrencyInputFromCents(maximum));
  }, [maximum, destinationsAvailable]);
  const amountCents = parseCurrencyInputToCents(amount);
  const validAmount = selected.length > 0 && cents(amountCents) && amountCents > 0 && amountCents <= maximum
    && discountValid && (discountCents === 0 || Boolean(adjustmentReason.trim()));
  let amountError = "";
  if (destinationsAvailable && selected.length && !validAmount) {
    amountError = amountCents > maximum
      ? `O valor não pode ultrapassar ${formatCurrency(maximum)}.`
      : `Informe um valor maior que zero, até ${formatCurrency(maximum)}.`;
    if (maximum === 0) amountError = `Crédito disponível para esta seleção: ${formatCurrency(0)}.`;
  }

  const invalidate = () => {
    setPreview(null);
    setError("");
    attempt.current = null;
    command.current = null;
  };
  const toggleEntries = (ids, checked) => {
    invalidate();
    setSelected((previous) => [...new Set(checked ? [...previous, ...ids] : previous.filter((id) => !ids.includes(id)))]);
  };
  const requestPreview = async (body, notice = "") => {
    const { data } = await previewFinancialCreditApplication(body);
    if (!mounted.current) return;
    if (!validPreview(data, body)) throw new Error("Invalid credit preview");
    command.current = body;
    attempt.current = null;
    setPreview(data);
    setError(notice);
  };
  const advance = async () => {
    if (inFlight.current || !validAmount) return;
    inFlight.current = true;
    setBusy("preview"); setError("");
    try {
      await requestPreview({ ...query, selected_entry_ids: [...selectedSet], amount_cents: amountCents,
        ...(discountCents > 0 ? { discount_cents: discountCents, adjustment_reason: adjustmentReason.trim() } : {}),
      });
    } catch (failure) {
      if (mounted.current) setError(getUserFacingApiError(failure, "Não foi possível conferir o uso do crédito. Tente novamente."));
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy("");
    }
  };
  const retryDestinations = async () => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy("destinations"); setError("");
    try { await loadDestinations(); }
    catch (failure) { if (mounted.current) setError(getUserFacingApiError(failure, "Não foi possível consultar os destinos. Tente novamente.")); }
    finally { inFlight.current = false; if (mounted.current) setBusy(""); }
  };
  const back = async () => {
    if (inFlight.current || uncertain) return;
    if (!refreshDestinationsOnBack.current) { invalidate(); return; }
    inFlight.current = true;
    setBusy("destinations"); setError("");
    try {
      await loadDestinations(true);
      if (!mounted.current) return;
      refreshDestinationsOnBack.current = false;
      invalidate();
    } catch (failure) {
      if (mounted.current) setError(getUserFacingApiError(failure,
        "Não foi possível atualizar os destinos. A revisão foi preservada. Tente voltar novamente."));
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy("");
    }
  };
  const confirm = async () => {
    if (inFlight.current || !preview || !command.current) return;
    if (!attempt.current) attempt.current = {
      key: uuidv4(), body: { ...command.current, preview_fingerprint: preview.preview_fingerprint },
    };
    inFlight.current = true; setBusy("confirm"); setError("");
    try {
      const { data } = await confirmFinancialCreditApplication(attempt.current.body, attempt.current.key);
      if (!mounted.current) return;
      if (Number(data?.patient?.id) !== Number(context.patientId) || data?.amount_cents !== attempt.current.body.amount_cents) {
        throw new Error("Invalid credit confirmation");
      }
      onCompleted(data);
    } catch (failure) {
      if (!mounted.current) return;
      const code = failure?.response?.data?.code;
      if (code === "CREDIT_APPLICATION_PREVIEW_STALE") {
        refreshDestinationsOnBack.current = true;
        attempt.current = null; setUncertain(false); setPreview(null); setBusy("preview");
        try { await requestPreview(command.current, STALE_MESSAGE); }
        catch (refreshFailure) {
          if (!mounted.current) return;
          setError(STALE_MESSAGE);
          try { await loadDestinations(true); refreshDestinationsOnBack.current = false; }
          catch (loadFailure) { if (mounted.current) setDestinations(null); }
        }
      } else {
        const ambiguous = !failure?.response || failure.response.status >= 500;
        setUncertain(ambiguous);
        if (!ambiguous) { attempt.current = null; setPreview(null); }
        setError(getUserFacingApiError(failure, ambiguous
          ? "Não foi possível conferir o resultado. Tente aplicar novamente para verificar a mesma operação."
          : "Não foi possível aplicar o crédito. Confira os destinos e tente novamente."));
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy("");
    }
  };
  const displayed = preview || destinations;
  return (
    <Overlay>
      <Dialog ref={dialog} role="dialog" aria-modal="true" aria-labelledby="credit-use-title" aria-busy={Boolean(busy)}>
        <Header>
          <h2 ref={heading} tabIndex={-1} id="credit-use-title">{preview ? "Conferir uso do crédito" : "Onde usar o crédito?"}</h2>
          <PatientName>{displayed?.patient?.full_name || displayed?.patient?.name || context.patientName}</PatientName>
          {context.periodLabel && <small>Período consultado: {context.periodLabel}</small>}
          <CreditAvailable><strong>Crédito disponível:</strong><span>{displayed ? formatCurrency(displayed.credit_available_cents) : "—"}</span></CreditAvailable>
        </Header>
        <Body>
          {error && <Notice role="alert">{error}</Notice>}
          {busy === "destinations" && <p role="status">Consultando destinos...</p>}
          {!destinations && !busy && <GhostButton type="button" onClick={retryDestinations}>Tentar novamente</GhostButton>}
          {!preview && destinations && <>
            {!destinations.groups.length && <p>Nenhuma cobrança elegível neste período.</p>}
            <GroupList aria-label="Destinos do crédito">
              {destinations.groups.map((group) => {
                const ids = [...new Set(group.entries.map((entry) => entry.entry_id))];
                const checked = ids.every((id) => selectedSet.has(id));
                const partial = !checked && ids.some((id) => selectedSet.has(id));
                const isExpanded = expanded.includes(group.key);
                return <Group key={group.key}>
                  <label htmlFor={`credit-select-${group.key}`}>
                    <input id={`credit-select-${group.key}`} type="checkbox" checked={checked} aria-checked={partial ? "mixed" : checked}
                      ref={(input) => { const checkbox = input; if (checkbox) checkbox.indeterminate = partial; }} disabled={Boolean(busy)}
                      onChange={(event) => toggleEntries(ids, event.target.checked)} />
                    <span>{groupLabel(group)}<small>A receber {groupBalanceContext(group)}: {formatCurrency(group.open_cents)}</small></span>
                  </label>
                  {group.kind === "package" && <GhostButton type="button" aria-expanded={isExpanded} aria-controls={`credit-group-${group.key}`} disabled={Boolean(busy)}
                    onClick={() => setExpanded((current) => isExpanded ? current.filter((key) => key !== group.key) : [...current, group.key])}>
                    {isExpanded ? "Recolher sessões" : "Escolher sessões"}
                  </GhostButton>}
                  {isExpanded && <SessionList id={`credit-group-${group.key}`}>
                    {group.entries.map((entry) => <li key={entry.entry_id}><label htmlFor={`credit-select-${group.key}-${entry.entry_id}`}>
                      <input id={`credit-select-${group.key}-${entry.entry_id}`} type="checkbox" checked={selectedSet.has(entry.entry_id)} disabled={Boolean(busy)}
                        onChange={(event) => toggleEntries([entry.entry_id], event.target.checked)} />
                      <span>{destinationLabel(entry)}<small>A receber na sessão: {formatCurrency(entry.open_cents)}</small></span>
                    </label></li>)}
                  </SessionList>}
                </Group>;
              })}
            </GroupList>
            <AmountField>
              <AmountLabel htmlFor="credit-use-amount">Valor a usar</AmountLabel>
              <CreditCurrencyInputGroup>
                <CurrencyPrefix aria-hidden="true">R$</CurrencyPrefix>
                <CurrencyInput id="credit-use-amount" inputMode="decimal" placeholder="0,00" value={amount} disabled={Boolean(busy) || !selected.length}
                  aria-invalid={Boolean(amountError)} aria-describedby={amountError ? "credit-use-limit" : undefined}
                  onBlur={() => setAmount((current) => current ? formatCurrencyInput(current) : "")}
                  onChange={(event) => { amountInitialized.current = true; setAmount(sanitizePositiveCurrencyInput(event.target.value)); invalidate(); }} />
              </CreditCurrencyInputGroup>
              {amountError && <AmountError id="credit-use-limit" role="alert">{amountError}</AmountError>}
            </AmountField>
            <AmountField>
              <AmountLabel htmlFor="credit-use-discount">Desconto nesta aplicação</AmountLabel>
              <CreditCurrencyInputGroup><CurrencyPrefix aria-hidden="true">R$</CurrencyPrefix>
                <CurrencyInput id="credit-use-discount" inputMode="decimal" placeholder="0,00" value={discount} disabled={Boolean(busy) || !selected.length}
                  onBlur={() => setDiscount((current) => current ? formatCurrencyInput(current) : "")}
                  onChange={(event) => { setDiscount(sanitizePositiveCurrencyInput(event.target.value)); invalidate(); }} />
              </CreditCurrencyInputGroup>
              <small>Desconto não consome crédito. Esta ação exige uso de crédito maior que zero.</small>
              {discountCents > 0 && <><AmountLabel htmlFor="credit-use-adjustment-reason">Motivo do desconto</AmountLabel>
                <textarea id="credit-use-adjustment-reason" rows={2} maxLength={1000} value={adjustmentReason} disabled={Boolean(busy)}
                  onChange={(event) => { setAdjustmentReason(event.target.value); invalidate(); }} /></>}
              {selected.length > 0 && !discountValid && <AmountError role="alert">O desconto deve ser menor que a dívida selecionada.</AmountError>}
            </AmountField>
          </>}
          {preview && <>
            <GroupList aria-label="Destinos conferidos">
              {preview.groups.map((group) => {
                const receiving = group.entries.filter((entry) => entry.allocated_cents > 0);
                return <ReviewGroup key={group.key}>
                  <strong>{groupTitle(group)}</strong>
                  <small>{groupDescription(group)}</small>
                  {group.kind === "package" ? <>
                    {receiving.length > 0 && <>
                    <DistributionLabel>Sessões que receberão o crédito</DistributionLabel>
                    <DistributionList aria-label="Sessões que receberão o crédito">
                      {receiving.map((entry) => <li key={entry.entry_id}>
                        <SummaryLine>
                          <span>{entry.service_name && entry.service_name !== group.service_name ? `${entry.service_name} · ` : ""}Sessão <SessionDate>{dateLabel(entry.session_starts_at)}</SessionDate></span>
                          <span>{formatCurrency(entry.allocated_cents)}</span>
                        </SummaryLine>
                        <small>{destinationBalanceLabel(entry)}: {formatCurrency(entry.open_after_cents)}</small>
                      </li>)}
                    </DistributionList>
                    </>}
                    <small>A receber no pacote após o uso: {formatCurrency(group.open_after_cents)}</small>
                  </> : receiving.map((entry) => <DirectDestination key={entry.entry_id}>
                    <SummaryLine><span>Crédito neste destino</span><span>{formatCurrency(entry.allocated_cents)}</span></SummaryLine>
                    <small>{destinationBalanceLabel(entry)}: {formatCurrency(entry.open_after_cents)}</small>
                  </DirectDestination>)}
                </ReviewGroup>;
              })}
            </GroupList>
            <Totals>
              <PrimaryTotal><span>Crédito a aplicar</span><strong>{formatCurrency(preview.amount_cents)}</strong></PrimaryTotal>
              {preview.discount_cents > 0 && <SummaryLine><span>Desconto nesta baixa</span><strong>{formatCurrency(preview.discount_cents)}</strong></SummaryLine>}
              <SummaryLine><span>Crédito restante</span><strong>{formatCurrency(preview.credit_remaining_cents)}</strong></SummaryLine>
            </Totals>
          </>}
          {busy === "preview" && <p role="status">Conferindo uso do crédito...</p>}
        </Body>
        <Footer>
          {preview ? <>
            <GhostButton type="button" disabled={Boolean(busy) || uncertain} onClick={back}>Voltar</GhostButton>
            <PrimaryButton type="button" disabled={Boolean(busy)} onClick={confirm}>
              {busy === "confirm" ? "Aplicando..." : "Confirmar"}
            </PrimaryButton>
          </> : <>
            <GhostButton type="button" disabled={Boolean(busy)} onClick={onClose}>Cancelar</GhostButton>
            <PrimaryButton type="button" disabled={Boolean(busy) || !validAmount} onClick={advance}>Avançar</PrimaryButton>
          </>}
        </Footer>
      </Dialog>
    </Overlay>
  );
}

FinancialCreditUseModal.propTypes = {
  context: PropTypes.shape({
    patientId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    patientName: PropTypes.string.isRequired,
    periodStart: PropTypes.string.isRequired,
    periodEnd: PropTypes.string.isRequired,
    periodLabel: PropTypes.string,
    destinationType: PropTypes.oneOf(["per_session", "billing_cycle", "all"]),
  }).isRequired,
  formatCurrency: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onCompleted: PropTypes.func.isRequired,
};

const Overlay = styled.div`
  position: fixed; inset: 0; z-index: 1400; background: rgba(0, 0, 0, .38);
  display: flex; align-items: center; justify-content: center; padding: 16px;
`;
const Dialog = styled.div`
  width: min(100%, 620px); max-height: 92dvh; min-height: 0; color: #28372c;
  background: white; border-radius: 16px; display: flex; flex-direction: column; overflow: hidden;
  h2 { margin: 0 0 12px; font-size: 20px; }
  p { margin: 8px 0; }
  small { display: block; color: #536257; line-height: 1.5; }
  input[type="checkbox"] { margin: 3px 0 0; width: 17px; height: 17px; flex-shrink: 0; }
  button:focus-visible, input:focus-visible { outline: 2px solid #28643e; outline-offset: 3px; }
`;
const Header = styled.header`padding: 22px 24px 14px; border-bottom: 1px solid #e3e9e4; flex-shrink: 0;`;
const PatientName = styled.p`font-size: ${fontSizes.body}; color: ${colors.textSecondary};`;
const CreditAvailable = styled.p`
  display: flex; flex-wrap: wrap; align-items: baseline; gap: ${spacing.xs};
  font-size: ${fontSizes.body};
  strong { font-weight: ${typography.weightSemibold}; }
  span { font-weight: ${typography.weightRegular}; }
`;
const Body = styled.div`padding: 16px 24px; overflow-y: auto; min-height: 0;`;
const Footer = styled.footer`
  padding: 16px 24px; border-top: 1px solid #e3e9e4; display: flex; justify-content: flex-end; gap: 10px; flex-shrink: 0;
  @media (max-width: 440px) { padding: 12px; button { white-space: normal; } }
`;
const GroupList = styled.ul`list-style: none; margin: 0; padding: 0;`;
const Group = styled.li`
  padding: 12px 0; border-bottom: 1px solid #e3e9e4; overflow-wrap: anywhere;
  label { display: flex; align-items: flex-start; gap: 9px; cursor: pointer; }
  > button { margin: 8px 0 0 26px; padding: 5px 8px; font-size: 12px; }
`;
const SessionList = styled.ul`
  list-style: none; padding: 0 0 0 26px; margin: 8px 0;
  li { padding: 8px 0; }
`;
const AmountField = styled.div`
  display: flex; flex-direction: column; gap: 6px; margin: ${spacing.lg} 0 6px;
`;
const AmountLabel = styled.label`font-weight: ${typography.weightSemibold}; color: ${colors.textSecondary};`;
const CreditCurrencyInputGroup = styled(CurrencyInputGroup)`
  width: 240px; max-width: 100%; border-radius: ${radii.md};
  input { width: 100%; height: 42px; font-family: inherit; font-size: ${fontSizes.body}; font-weight: ${typography.weightRegular}; }
`;
const AmountError = styled.small`&& { color: ${colors.danger}; }`;
const ReviewGroup = styled.li`
  padding: ${spacing.md} 0; overflow-wrap: anywhere;
  & + & { border-top: 1px solid ${colors.borderSubtle}; }
  > strong { font-size: ${fontSizes.body}; font-weight: ${typography.weightSemibold}; }
`;
const DistributionLabel = styled.p`font-size: ${fontSizes.small}; color: ${colors.textSecondary};`;
const DistributionList = styled.ul`
  list-style: none; padding: 0 0 0 ${spacing.md}; margin: ${spacing.xs} 0 ${spacing.sm};
  li { padding: ${spacing.xs} 0; font-size: ${fontSizes.body}; }
  small { font-size: ${fontSizes.small}; }
`;
const SessionDate = styled.span`font-size: ${fontSizes.small}; color: ${colors.textSecondary};`;
const DirectDestination = styled.div`margin-top: ${spacing.sm}; font-size: ${fontSizes.body};`;
const SummaryLine = styled.div`display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin: 5px 0;`;
const Totals = styled.div`
  border-top: 1px solid ${colors.borderSubtle}; padding-top: ${spacing.md}; margin-top: ${spacing.xs};
  font-size: ${fontSizes.body}; color: ${colors.textSecondary};
`;
const PrimaryTotal = styled(SummaryLine)`font-size: 1rem; color: ${colors.textPrimary}; font-weight: ${typography.weightSemibold};`;
const Notice = styled.p`padding: 10px 12px; background: #fff4e8; color: #80401d; border-radius: 8px;`;
