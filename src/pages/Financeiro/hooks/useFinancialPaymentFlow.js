import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { v4 as uuidv4 } from "uuid";

import { getUserFacingApiError } from "../../../services/axios";
import {
  createFinancialEntry,
  createFinancialPayment,
} from "../../../services/financial";
import { getPatientDisplayName } from "../../../utils/patientSearch";
import { formatCurrencyInputFromCents } from "../helpers/expenseFormatters";

const emptyPayment = {
  patient_id: "",
  payment_method_id: "",
  amount: "",
  discount: "0,00",
  paid_at: "",
  note: "",
};

const STANDALONE_PAYMENT_ANCHOR_DESCRIPTION = "Recebimento por sessão (sistema)";
const STANDALONE_PAYMENT_ANCHOR_NOTE =
  "Entrada técnica automática para viabilizar recebimento por sessão.";

const parseCurrencyInputToNumber = (value) => {
  if (value === null || value === undefined) return Number.NaN;
  const normalized = String(value)
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const formatCurrencyInput = (value) => {
  const parsed = parseCurrencyInputToNumber(value);
  if (Number.isNaN(parsed)) return "";
  return parsed.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const sanitizeCurrencyInput = (value) => {
  const source = String(value || "");
  const validChars = source.replace(/[^\d,.-]/g, "");
  const lastComma = validChars.lastIndexOf(",");
  const lastDot = validChars.lastIndexOf(".");
  const decimalSeparatorIndex = lastComma > lastDot ? lastComma : -1;
  const onlyValidChars = decimalSeparatorIndex >= 0
    ? `${validChars.slice(0, decimalSeparatorIndex).replace(/[.,]/g, "")},${validChars
      .slice(decimalSeparatorIndex + 1)
      .replace(/[.,]/g, "")}`
    : validChars.replace(/[.,]/g, "");
  const unsigned = onlyValidChars.replace(/-/g, "");
  const [integerRaw = "", ...decimalParts] = unsigned.split(",");
  const integer = integerRaw.replace(/\D/g, "");
  const decimal = decimalParts.join("").replace(/\D/g, "").slice(0, 2);

  if (!integer && !decimal) return "";

  const normalizedInteger = integer.replace(/^0+(?=\d)/, "") || "0";
  if (onlyValidChars.includes(",")) return `${normalizedInteger},${decimal}`;
  return normalizedInteger;
};

const splitCentsByBase = (totalCents, baseList = []) => {
  const total = Math.max(0, Number(totalCents || 0));
  if (total <= 0 || !baseList.length) return baseList.map(() => 0);

  const normalizedBase = baseList.map((value) => Math.max(0, Number(value || 0)));
  const baseTotal = normalizedBase.reduce((sum, value) => sum + value, 0);
  if (baseTotal <= 0) {
    const equal = Math.floor(total / normalizedBase.length);
    const remainder = total - equal * normalizedBase.length;
    return normalizedBase.map((_, index) => (
      index === normalizedBase.length - 1 ? equal + remainder : equal
    ));
  }

  const result = [];
  let distributed = 0;
  normalizedBase.forEach((base, index) => {
    if (index === normalizedBase.length - 1) {
      result.push(total - distributed);
      return;
    }
    const share = Math.floor((total * base) / baseTotal);
    distributed += share;
    result.push(share);
  });
  return result;
};

const buildScopedAllocationItems = (scopedEntries = [], amountCents = 0, discountCents = 0) => {
  const entries = scopedEntries
    .map((item) => ({
      entry_id: Number(item.entryId || item.entry_id || 0),
      openCents: Math.max(0, Number(item.openCents || item.open_cents || 0)),
    }))
    .filter((item) => item.entry_id > 0 && item.openCents > 0);

  if (!entries.length) return [];

  const discountSplit = splitCentsByBase(
    Math.max(0, Number(discountCents || 0)),
    entries.map((item) => item.openCents),
  );
  let remaining = Math.max(0, Number(amountCents || 0));

  return entries
    .map((item, index) => {
      if (remaining <= 0) return null;
      const targetOpen = Math.max(0, item.openCents - Math.max(0, Number(discountSplit[index] || 0)));
      const amount = Math.min(targetOpen, remaining);
      remaining -= amount;
      if (amount <= 0) return null;
      return { entry_id: item.entry_id, amount_cents: amount };
    })
    .filter(Boolean);
};

const toDateInputValue = (date) => date.toISOString().slice(0, 10);

export default function useFinancialPaymentFlow({ onPaymentSaved }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState(emptyPayment);
  const [context, setContext] = useState(null);
  const [step, setStep] = useState(1);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [selectionStale, setSelectionStale] = useState(false);
  const amountEditedRef = useRef(false);
  const paymentAttemptRef = useRef(null);
  const savingRef = useRef(false);

  const openScopedPatientPaymentModal = useCallback((patient, scopedPayment) => {
    const patientId = patient?.id ? String(patient.id) : String(scopedPayment?.patientId || "");
    const patientName = patientId
      ? getPatientDisplayName(patient) || scopedPayment?.patientName || "Paciente"
      : scopedPayment?.patientName || "Paciente";
    const totalOpenCents = Math.max(0, Number(scopedPayment?.totalOpenCents || 0));
    const groups = scopedPayment?.groups || [];
    setStep(Array.isArray(scopedPayment?.groups) ? 1 : 2);
    setSelectedKeys(groups.length === 1 ? [groups[0].key] : []);
    setSelectionStale(false);
    amountEditedRef.current = false;

    setForm({
      ...emptyPayment,
      patient_id: patientId,
      amount: !Array.isArray(scopedPayment?.groups) && totalOpenCents > 0
        ? formatCurrencyInputFromCents(totalOpenCents) : "",
      paid_at: toDateInputValue(new Date()),
    });
    setContext({
      patientName,
      scopedPayment: {
        ...scopedPayment,
        patientId,
        patientName,
      },
    });
    paymentAttemptRef.current = null;
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    if (savingRef.current) return;
    paymentAttemptRef.current = null;
    savingRef.current = false;
    setIsOpen(false);
    setIsSaving(false);
    setContext(null);
  }, []);

  useEffect(() => {
    if (!isOpen || typeof document === "undefined") return () => {};
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleEscape = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close();
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [close, isOpen]);

  const handleChange = useCallback((event) => {
    const { name, value } = event.target;
    if (name === "amount") amountEditedRef.current = true;
    if (name === "amount" || name === "discount") {
      setForm((previous) => ({
        ...previous,
        [name]: sanitizeCurrencyInput(value),
      }));
      return;
    }
    setForm((previous) => ({ ...previous, [name]: value }));
  }, []);

  const handleCurrencyBlur = useCallback((event) => {
    const { name } = event.target;
    if (name !== "amount" && name !== "discount") return;
    setForm((previous) => ({
      ...previous,
      [name]: formatCurrencyInput(previous[name]),
    }));
  }, []);

  const groups = useMemo(() => context?.scopedPayment?.groups || [], [context]);
  const selectionFlow = Array.isArray(context?.scopedPayment?.groups);
  const selectionReady = context?.scopedPayment?.selectionReady !== false;
  const selectedGroups = useMemo(() => groups.filter((group) => selectedKeys.includes(group.key)), [groups, selectedKeys]);
  const creditOnly = selectionFlow && selectedKeys.length === 0;
  const selectedEntries = useMemo(() => (selectionFlow ? selectedGroups.flatMap((group) => group.entries)
    : context?.scopedPayment?.entries || []), [selectionFlow, selectedGroups, context]);
  const toggleSelection = (key) => {
    if (savingRef.current || !groups.some((group) => group.key === key)) return;
    setSelectedKeys((previous) => previous.includes(key)
      ? previous.filter((item) => item !== key) : [...previous, key]);
    if (selectedKeys.length === 1 && selectedKeys[0] === key) {
      setForm((previous) => ({ ...previous, discount: "0,00" }));
    }
  };
  const advance = () => {
    if (!selectionReady || selectionStale || savingRef.current) return;
    if (!amountEditedRef.current) {
      const total = selectedEntries.reduce((sum, item) => sum + Number(item.openCents), 0);
      setForm((previous) => ({ ...previous, amount: creditOnly ? "" : formatCurrencyInputFromCents(total) }));
    }
    if (creditOnly) setForm((previous) => ({ ...previous, discount: "0,00" }));
    setStep(2);
  };
  const back = () => { if (!savingRef.current) setStep(1); };

  const preview = (() => {
    const entries = selectedEntries;
    const baseCents = entries.reduce(
      (sum, item) => sum + Math.max(0, Number(item.openCents || item.open_cents || 0)),
      0,
    );
    const amount = parseCurrencyInputToNumber(form.amount);
    const discount = parseCurrencyInputToNumber(form.discount);
    const receivedCents = Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : 0;
    const discountCents = Number.isFinite(discount) && discount > 0
      ? Math.round(discount * 100)
      : 0;
    const finalChargedCents = Math.max(0, baseCents - discountCents);

    return {
      baseCents,
      receivedCents,
      discountCents,
      finalChargedCents,
      openAfterCents: Math.max(0, finalChargedCents - receivedCents),
      creditAfterCents: Math.max(0, receivedCents - finalChargedCents),
    };
  })();
  const review = (() => {
    const discounts = splitCentsByBase(preview.discountCents,
      selectedEntries.map((item) => Number(item.openCents || 0)));
    const allocations = buildScopedAllocationItems(selectedEntries,
      preview.receivedCents, preview.discountCents);
    let offset = 0;
    return selectedGroups.map((group) => {
      const discountCents = discounts.slice(offset, offset + group.entries.length)
        .reduce((sum, cents) => sum + cents, 0);
      offset += group.entries.length;
      const ids = new Set(group.entries.map((entry) => entry.entryId));
      const paidCents = allocations.filter((item) => ids.has(item.entry_id))
        .reduce((sum, item) => sum + item.amount_cents, 0);
      const baseCents = group.entries.reduce((sum, item) => sum + item.openCents, 0);
      return { ...group, baseCents, discountCents, paidCents,
        pendingCents: Math.max(0, baseCents - discountCents - paidCents) };
    });
  })();

  const hasInput = Boolean(
    String(form.patient_id || "").trim()
    || String(form.payment_method_id || "").trim()
    || String(form.amount || "").trim()
    || String(form.discount || "").trim()
    || String(form.note || "").trim(),
  );

  const createStandalonePaymentAnchor = useCallback(async ({ patientId, referenceDate }) => {
    const normalizedReferenceDate =
      String(referenceDate || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
    const response = await createFinancialEntry({
      type: "income",
      description: STANDALONE_PAYMENT_ANCHOR_DESCRIPTION,
      patient_id: patientId,
      amount_cents: 0,
      currency: "BRL",
      reference_date: normalizedReferenceDate,
      due_date: normalizedReferenceDate,
      notes: STANDALONE_PAYMENT_ANCHOR_NOTE,
    });
    const createdEntryId = Number(response?.data?.id || 0);
    if (!createdEntryId) {
      throw new Error("Não foi possível preparar o recebimento por sessão.");
    }
    return createdEntryId;
  }, []);

  const save = useCallback(async () => {
    if (savingRef.current || isSaving) return;
    if (selectionFlow && (step !== 2 || !selectionReady || selectionStale
      || (!creditOnly && (!selectedGroups.length || !selectedEntries.length)))) return;

    const amountValue = parseCurrencyInputToNumber(form.amount);
    const discountValue = parseCurrencyInputToNumber(form.discount);
    const amountCents = Math.round(amountValue * 100);
    const discountCents = Number.isFinite(discountValue) && discountValue > 0
      ? Math.round(discountValue * 100)
      : 0;
    const scopedEntries = selectedEntries;
    const originalTotalCents = scopedEntries.reduce(
      (sum, item) => sum + Math.max(0, Number(item.openCents || item.open_cents || 0)),
      0,
    );
    const patientId = Number(form.patient_id || 0) || null;
    const paymentMethodId = Number(form.payment_method_id || 0) || null;

    if (Number.isNaN(amountValue) || amountValue <= 0) {
      toast.error("Informe um valor valido.");
      return;
    }
    if (!form.paid_at) {
      toast.error("Informe a data do pagamento.");
      return;
    }
    if (!patientId) {
      toast.error("Selecione o paciente.");
      return;
    }
    if (!paymentMethodId) {
      toast.error("Selecione a forma de pagamento.");
      return;
    }
    if (Number.isFinite(discountValue) && discountValue < 0) {
      toast.error("Desconto não pode ser negativo.");
      return;
    }
    if (discountCents > originalTotalCents) {
      toast.error("O desconto nao pode ser maior que o valor original.");
      return;
    }
    const allocations = buildScopedAllocationItems(scopedEntries, amountCents, discountCents);
    const fullyDiscountedSelection = selectionFlow && selectedGroups.length > 0
      && scopedEntries.length > 0 && Number.isSafeInteger(originalTotalCents)
      && originalTotalCents > 0 && discountCents === originalTotalCents
      && Number.isSafeInteger(amountCents) && amountCents > 0;
    if (!allocations.length && !creditOnly && !fullyDiscountedSelection) {
      toast.error("Informe as cobranças para alocar.");
      return;
    }
    const allocationTotal = allocations.reduce(
      (sum, item) => sum + Number(item.amount_cents || 0),
      0,
    );
    if (allocationTotal > amountCents) {
      toast.error("O valor distribuído não pode ser maior que o recebimento.");
      return;
    }

    const referenceDate = String(form.paid_at || "").slice(0, 10);
    const note = form.note.trim();
    const adjustmentReason = note || "Ajuste aplicado no recebimento";
    const hasAdjustment = discountCents > 0;
    const adjustmentTargets = !creditOnly && (hasAdjustment || selectionFlow) ? scopedEntries.map((item) => ({
      entry_id: Number(item.entryId || item.entry_id || 0),
      open_amount_cents: Math.max(0, Number(item.openCents || item.open_cents || 0)),
    })).filter((item) => item.entry_id > 0 && item.open_amount_cents > 0) : undefined;
    const receiptGroups = selectionFlow && !creditOnly ? selectedGroups.map((group) => ({
      kind: group.kind, id: group.sourceId,
    })) : undefined;
    const logicalCommand = {
      patient_id: patientId,
      payment_method_id: paymentMethodId,
      amount_cents: amountCents,
      paid_at: referenceDate,
      note: note || null,
      allocation_mode: creditOnly ? "none" : "manual",
      receipt_intent: creditOnly ? "credit_only" : undefined,
      allocations,
      discount_cents: hasAdjustment ? discountCents : null,
      surcharge_cents: hasAdjustment ? 0 : null,
      adjustment_reason: hasAdjustment ? adjustmentReason : null,
      adjustment_targets: adjustmentTargets,
      receipt_groups: receiptGroups,
    };
    const commandSignature = JSON.stringify(logicalCommand);
    if (paymentAttemptRef.current?.commandSignature !== commandSignature) {
      paymentAttemptRef.current = {
        anchorId: null,
        commandSignature,
        idempotencyKey: uuidv4(),
      };
    }

    savingRef.current = true;
    setIsSaving(true);
    try {
      const attempt = paymentAttemptRef.current;
      if (!creditOnly && !attempt.anchorId) {
        attempt.anchorId = await createStandalonePaymentAnchor({
          patientId,
          referenceDate,
        });
      }

      await createFinancialPayment({
        entry_id: attempt.anchorId,
        patient_id: patientId,
        payment_method_id: paymentMethodId,
        amount_cents: amountCents,
        paid_at: new Date(`${referenceDate}T09:00:00`).toISOString(),
        note: note || null,
        allocation_mode: creditOnly ? "none" : "manual",
        receipt_intent: creditOnly ? "credit_only" : undefined,
        allocations,
        discount_cents: hasAdjustment ? discountCents : undefined,
        surcharge_cents: hasAdjustment ? 0 : undefined,
        adjustment_reason: hasAdjustment ? adjustmentReason : undefined,
        adjustment_targets: adjustmentTargets,
        receipt_groups: receiptGroups,
        adjustment: hasAdjustment
          ? { discount_cents: discountCents, surcharge_cents: 0, reason: adjustmentReason }
          : undefined,
      }, attempt.idempotencyKey);

      toast.success("Recebimento registrado.");
      savingRef.current = false;
      close();
      await onPaymentSaved({ patientId });
    } catch (error) {
      if (selectionFlow && error.response?.status === 409) setSelectionStale(true);
      toast.error(getUserFacingApiError(
        error,
        "Não foi possível registrar o recebimento. Tente novamente em instantes.",
      ));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }, [close, createStandalonePaymentAnchor, form, isSaving, onPaymentSaved,
    selectedEntries, selectedGroups, selectionFlow, selectionReady, selectionStale, creditOnly, step]);

  return {
    close,
    context,
    form,
    handleChange,
    handleCurrencyBlur,
    hasInput,
    isOpen,
    isSaving,
    openScopedPatientPaymentModal,
    preview,
    save,
    groups,
    selectedKeys,
    selectionFlow,
    selectionReady,
    creditOnly,
    selectionStale,
    step,
    review,
    toggleSelection,
    advance,
    back,
  };
}
