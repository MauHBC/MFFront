import { formatCivilDate, normalizeCivilDate } from "../../utils/canonicalDateTime";
import { formatAgendaDate, formatAgendaDateInput } from "../../utils/agendaDateTime";

export function normalizeReplacementCredit(credit, previous = {}) {
  const source = credit.sourceSession || credit.source_session || {};
  const cycle = source.BillingCycle || {};
  return { ...previous, ...credit,
    source_service_id: credit.source_service_id ?? source.service_id ?? source.Service?.id ?? previous.source_service_id,
    source_service_type: credit.source_service_type ?? source.service_type ?? source.Service?.code ?? previous.source_service_type,
    source_service_name: credit.source_service_name ?? source.Service?.name ?? previous.source_service_name,
    source_billing_mode: credit.source_billing_mode !== undefined ? credit.source_billing_mode : source.billing_mode ?? previous.source_billing_mode ?? null,
    source_billing_cycle_start: credit.source_billing_cycle_start !== undefined ? credit.source_billing_cycle_start : cycle.cycle_start ?? previous.source_billing_cycle_start ?? null,
    source_billing_cycle_end: credit.source_billing_cycle_end !== undefined ? credit.source_billing_cycle_end : cycle.cycle_end ?? previous.source_billing_cycle_end ?? null,
  };
}

export function partitionPatientOrigins(packages, credits, patientId, now = new Date()) {
  if (!Array.isArray(packages) || !Array.isArray(credits)) throw new Error("Resposta de direitos inválida.");
  const today = formatAgendaDateInput(now);
  const ids = new Set();
  const replacements = credits.filter((credit) => {
    if (!Number.isSafeInteger(Number(credit?.id)) || Number(credit.id) < 1
      || String(credit.patient_id) !== String(patientId) || ids.has(String(credit.id))
      || !["pending", "used", "expired", "canceled"].includes(credit.status)
      || !normalizeCivilDate(credit.expires_at)) throw new Error("Resposta de reposições inválida.");
    ids.add(String(credit.id));
    return credit.status === "pending" && !credit.used_session_id && normalizeCivilDate(credit.expires_at) >= today;
  }).map((credit) => normalizeReplacementCredit(credit));
  const options = packages.map((pkg) => {
    if (!Number.isSafeInteger(pkg?.purchased_free_rights) || pkg.purchased_free_rights < 0
      || !Number.isSafeInteger(Number(pkg.quantity)) || Number(pkg.quantity) < 1
      || pkg.purchased_free_rights > Number(pkg.quantity)
      || !pkg.service?.id || !pkg.service?.name || !pkg.review_token) {
      throw new Error("Não foi possível identificar o saldo comum do pacote.");
    }
    return { ...pkg, free_rights: pkg.purchased_free_rights };
  }).filter((pkg) => pkg.free_rights > 0);
  return { options, replacements };
}

const contractDateLabel = (pkg) => {
  if (!pkg?.contracted_at) return "";
  const civil = normalizeCivilDate(pkg.contracted_at);
  return civil ? formatCivilDate(civil) : formatAgendaDate(pkg.contracted_at);
};

// Dates are already part of the package DTO; identical/missing dates use display order.
export const ownPackageIdentity = (pkg, options = []) => {
  if (!pkg) return "";
  const service = pkg.service?.id ?? pkg.service?.name;
  const peers = options.filter((other) => (other.service?.id ?? other.service?.name) === service);
  if (peers.length < 2) return "";
  const date = contractDateLabel(pkg);
  if (date && peers.filter((other) => contractDateLabel(other) === date).length === 1) {
    return `Contratado em ${date}`;
  }
  const position = peers.findIndex((other) => String(other.id) === String(pkg.id)) + 1;
  return `${date ? `Contratado em ${date} · ` : ""}Opção ${position}`;
};
