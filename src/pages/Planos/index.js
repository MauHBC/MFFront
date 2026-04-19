import React, { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { toast } from "react-toastify";
import { FaPlus, FaTimes } from "react-icons/fa";

import Loading from "../../components/Loading";
import { PageWrapper, PageContent } from "../../components/AppLayout";
import {
  ModuleHeader,
  ModuleTitle,
  ModuleTabs,
  ModuleTabButton,
  ModuleBody,
} from "../../components/AppModuleShell";
import { AppToolbar, AppToolbarLeft } from "../../components/AppToolbar";
import {
  PrimaryButton,
  GhostButton,
  RowActionButton,
  DangerButton,
} from "../../components/AppButton";
import { TableWrap, DataTable, TH, TD } from "../../components/AppTable";
import { StatusPill } from "../../components/AppStatus";
import { Field, FieldHint } from "../../components/AppForm";
import {
  AppDrawer,
  DrawerBackdrop,
  DrawerHeader,
  DrawerTitle,
  DrawerCloseBtn,
  DrawerBody,
  DrawerFooter,
} from "../../components/AppDrawer";
import {
  listServicePlans,
  createServicePlan,
  updateServicePlan,
  deactivateServicePlan,
  listPatientPlans,
  createPatientPlan,
  updatePatientPlan,
  pausePatientPlan,
  resumePatientPlan,
  cancelPatientPlan,
} from "../../services/financial";
import axios from "../../services/axios";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const centsToInputValue = (cents) => {
  if (cents == null) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
};

/**
 * Parses a money string into integer cents.
 * Handles PT-BR (1.000,00), US (1,000.00), plain (200), decimal-only (700,00 or 700.00).
 * Returns null for invalid/zero/negative input.
 */
const parseMoneyInput = (raw) => {
  if (!raw) return null;
  const s = String(raw).trim().replace(/[R$\s]/g, "");
  if (!s || s.startsWith("-")) return null;

  const cleaned = s.replace(/[^\d.,]/g, "");
  if (!cleaned) return null;

  const dotCount = (cleaned.match(/\./g) || []).length;
  const commaCount = (cleaned.match(/,/g) || []).length;

  let normalized;

  if (dotCount > 0 && commaCount > 0) {
    // Both separators: last one is decimal
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      // PT-BR: 1.000,00  →  remove dots, swap comma→dot
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      // US: 1,000.00  →  remove commas
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (commaCount === 1 && dotCount === 0) {
    const [intPart, decPart = ""] = cleaned.split(",");
    if (decPart.length <= 2) {
      normalized = `${intPart}.${decPart}`;   // decimal comma: 1000,00
    } else if (decPart.length === 3) {
      normalized = intPart + decPart;          // thousand comma: 1,000
    } else {
      return null;
    }
  } else if (dotCount === 1 && commaCount === 0) {
    const [intPart, decPart = ""] = cleaned.split(".");
    if (decPart.length <= 2) {
      normalized = cleaned;                    // decimal dot: 1000.50
    } else if (decPart.length === 3) {
      normalized = intPart + decPart;          // thousand dot: 1.000
    } else {
      return null;
    }
  } else if (dotCount === 0 && commaCount === 0) {
    normalized = cleaned;                      // plain integer: 200
  } else if (dotCount > 1 && commaCount === 0) {
    normalized = cleaned.replace(/\./g, "");   // PT-BR thousands: 1.000.000
  } else {
    return null;                               // ambiguous (multiple commas, no dot)
  }

  const value = parseFloat(normalized);
  if (Number.isNaN(value) || value <= 0) return null;
  return Math.round(value * 100);
};

const formatPrice = (cents) => {
  if (cents == null) return "-";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
};

const formatDateBR = (value) => {
  if (!value) return "-";
  const s = String(value).slice(0, 10);
  const [y, m, d] = s.split("-");
  return d && m && y ? `${d}/${m}/${y}` : s;
};

const STATUS_INFO = {
  active: { label: "Ativo", tone: "active" },
  paused: { label: "Pausado", tone: "paused" },
  canceled: { label: "Cancelado", tone: "canceled" },
};

// ---------------------------------------------------------------------------
// Empty forms
// ---------------------------------------------------------------------------

const EMPTY_SP = {
  service_id: "",
  price: "",
  sessions_per_week: "",
};

const EMPTY_PP = {
  patient_id: "",
  service_plan_id: "",
  anchor_day: "",
  starts_at: "",
  ends_at: "",
  notes: "",
};

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function Planos() {
  const [activeTab, setActiveTab] = useState("service-plans");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Base data
  const [services, setServices] = useState([]);
  const [patients, setPatients] = useState([]);
  const [servicePlans, setServicePlans] = useState([]);

  // Service Plans tab
  const [spFilterServiceId, setSpFilterServiceId] = useState("");
  const [spDrawerOpen, setSpDrawerOpen] = useState(false);
  const [spEditingId, setSpEditingId] = useState(null);
  const [spForm, setSpForm] = useState(EMPTY_SP);

  // Patient Plans tab
  const [patientPlans, setPatientPlans] = useState([]);
  const [ppFilterPatientId, setPpFilterPatientId] = useState("");
  const [ppFilterStatus, setPpFilterStatus] = useState("active");
  const [ppDrawerOpen, setPpDrawerOpen] = useState(false);
  const [ppEditingId, setPpEditingId] = useState(null);
  const [ppEditingStatus, setPpEditingStatus] = useState(null);
  const [ppForm, setPpForm] = useState(EMPTY_PP);

  // ---- Data loading ----

  const loadBaseData = useCallback(async () => {
    try {
      const [servicesRes, patientsRes] = await Promise.all([
        axios.get("/services"),
        axios.get("/patients"),
      ]);
      setServices(Array.isArray(servicesRes.data) ? servicesRes.data : []);
      setPatients(Array.isArray(patientsRes.data) ? patientsRes.data : []);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Erro ao carregar dados base.");
    }
  }, []);

  const loadServicePlans = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await listServicePlans({});
      setServicePlans(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Erro ao carregar planos comerciais.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadPatientPlans = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = {};
      if (ppFilterPatientId) params.patient_id = ppFilterPatientId;
      if (ppFilterStatus) params.status = ppFilterStatus;
      const res = await listPatientPlans(params);
      setPatientPlans(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Erro ao carregar vínculos.");
    } finally {
      setIsLoading(false);
    }
  }, [ppFilterPatientId, ppFilterStatus]);

  useEffect(() => {
    loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    loadServicePlans();
  }, [loadServicePlans]);

  useEffect(() => {
    if (activeTab === "patient-plans") loadPatientPlans();
  }, [activeTab, loadPatientPlans]);

  // ---- Derived ----

  const filteredServicePlans = useMemo(() => {
    if (!spFilterServiceId) return servicePlans;
    return servicePlans.filter(
      (sp) => String(sp.service_id) === spFilterServiceId,
    );
  }, [servicePlans, spFilterServiceId]);

  const activeServicePlans = useMemo(
    () => servicePlans.filter((sp) => sp.is_active !== false),
    [servicePlans],
  );

  // ---- Service Plan handlers ----

  const handleSpChange = useCallback((e) => {
    const { name, value } = e.target;
    setSpForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const openSpCreate = useCallback(() => {
    setSpEditingId(null);
    setSpForm(EMPTY_SP);
    setSpDrawerOpen(true);
  }, []);

  const openSpEdit = useCallback((sp) => {
    setSpEditingId(sp.id);
    setSpForm({
      service_id: String(sp.service_id || ""),
      price: centsToInputValue(sp.price_cents),
      sessions_per_week:
        sp.sessions_per_week != null ? String(sp.sessions_per_week) : "",
    });
    setSpDrawerOpen(true);
  }, []);

  const closeSpDrawer = useCallback(() => {
    setSpDrawerOpen(false);
    setSpEditingId(null);
    setSpForm(EMPTY_SP);
  }, []);

  const handleSpSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!spForm.service_id) {
        toast.error("Selecione o serviço base.");
        return;
      }
      const priceCents = parseMoneyInput(spForm.price);
      if (!priceCents) {
        toast.error("Preço inválido. Use o formato 700,00 ou 1.000,00.");
        return;
      }
      setIsSaving(true);
      try {
        const service = services.find((s) => String(s.id) === String(spForm.service_id));
        const serviceName = service?.name || "";
        const sessionsN = spForm.sessions_per_week ? Number(spForm.sessions_per_week) : null;
        const derivedName = sessionsN
          ? `${serviceName} ${sessionsN}x na semana`
          : serviceName;
        const derivedFrequencyLabel = sessionsN ? `${sessionsN}x na semana` : null;
        const payload = {
          service_id: Number(spForm.service_id),
          name: derivedName,
          price_cents: priceCents,
          sessions_per_week: sessionsN,
          frequency_label: derivedFrequencyLabel,
        };
        if (spEditingId) {
          await updateServicePlan(spEditingId, payload);
          toast.success("Plano atualizado.");
        } else {
          await createServicePlan(payload);
          toast.success("Plano criado.");
        }
        closeSpDrawer();
        await loadServicePlans();
      } catch (err) {
        toast.error(err?.response?.data?.error || "Erro ao salvar plano.");
      } finally {
        setIsSaving(false);
      }
    },
    [spForm, spEditingId, services, closeSpDrawer, loadServicePlans],
  );

  const handleSpDeactivate = useCallback(
    async (sp) => {
      // eslint-disable-next-line no-alert
      const confirmDeactivate = window.confirm(`Inativar "${sp.name}"?\n\nVínculos de pacientes já existentes não são afetados.`);
      if (!confirmDeactivate) return;
      try {
        await deactivateServicePlan(sp.id);
        toast.success("Plano inativado.");
        await loadServicePlans();
      } catch (err) {
        toast.error(err?.response?.data?.error || "Erro ao inativar plano.");
      }
    },
    [loadServicePlans],
  );

  // ---- Patient Plan handlers ----

  const handlePpChange = useCallback((e) => {
    const { name, value } = e.target;
    setPpForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const openPpCreate = useCallback(() => {
    setPpEditingId(null);
    setPpEditingStatus(null);
    setPpForm(EMPTY_PP);
    setPpDrawerOpen(true);
  }, []);

  const openPpEdit = useCallback((pp) => {
    if (pp.status === "canceled") {
      toast.error("Vínculos cancelados não podem ser editados.");
      return;
    }
    setPpEditingId(pp.id);
    setPpEditingStatus(pp.status);
    setPpForm({
      patient_id: String(pp.patient_id || ""),
      service_plan_id: String(pp.service_plan_id || ""),
      anchor_day: String(pp.anchor_day || ""),
      starts_at: pp.starts_at ? String(pp.starts_at).slice(0, 10) : "",
      ends_at: pp.ends_at ? String(pp.ends_at).slice(0, 10) : "",
      notes: pp.notes || "",
    });
    setPpDrawerOpen(true);
  }, []);

  const closePpDrawer = useCallback(() => {
    setPpDrawerOpen(false);
    setPpEditingId(null);
    setPpEditingStatus(null);
    setPpForm(EMPTY_PP);
  }, []);

  const handlePpSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!ppForm.patient_id) {
        toast.error("Selecione o paciente.");
        return;
      }
      if (!ppForm.service_plan_id) {
        toast.error("Selecione o plano comercial.");
        return;
      }
      const anchor = Number(ppForm.anchor_day);
      if (
        !ppForm.anchor_day ||
        Number.isNaN(anchor) ||
        anchor < 1 ||
        anchor > 28
      ) {
        toast.error("Dia âncora deve ser entre 1 e 28.");
        return;
      }
      if (!ppForm.starts_at) {
        toast.error("Informe a data de início.");
        return;
      }
      setIsSaving(true);
      try {
        const payload = {
          patient_id: Number(ppForm.patient_id),
          service_plan_id: Number(ppForm.service_plan_id),
          anchor_day: anchor,
          starts_at: ppForm.starts_at,
          ends_at: ppForm.ends_at || null,
          notes: ppForm.notes.trim() || null,
        };
        if (ppEditingId) {
          await updatePatientPlan(ppEditingId, payload);
          toast.success("Vínculo atualizado.");
        } else {
          await createPatientPlan(payload);
          toast.success("Vínculo criado.");
        }
        closePpDrawer();
        await loadPatientPlans();
      } catch (err) {
        toast.error(err?.response?.data?.error || "Erro ao salvar vínculo.");
      } finally {
        setIsSaving(false);
      }
    },
    [ppForm, ppEditingId, closePpDrawer, loadPatientPlans],
  );

  const handlePpPause = useCallback(
    async (pp) => {
      // eslint-disable-next-line no-alert
      const confirmPause = window.confirm("Pausar este plano?\n\nCiclos mensais não serão gerados enquanto pausado.");
      if (!confirmPause) return;
      try {
        await pausePatientPlan(pp.id);
        toast.success("Plano pausado.");
        await loadPatientPlans();
      } catch (err) {
        toast.error(err?.response?.data?.error || "Erro ao pausar plano.");
      }
    },
    [loadPatientPlans],
  );

  const handlePpResume = useCallback(
    async (pp) => {
      try {
        await resumePatientPlan(pp.id);
        toast.success("Plano retomado.");
        await loadPatientPlans();
      } catch (err) {
        toast.error(err?.response?.data?.error || "Erro ao retomar plano.");
      }
    },
    [loadPatientPlans],
  );

  const handlePpCancel = useCallback(
    async (pp) => {
      const patientName =
        pp.Patient?.full_name || pp.Patient?.name || "este paciente";
      const planName = pp.ServicePlan?.name || "este plano";
      // eslint-disable-next-line no-alert
      const confirmCancel = window.confirm(`Cancelar o vínculo de "${patientName}" com "${planName}"?\n\nEsta ação não pode ser desfeita.`);
      if (!confirmCancel) return;
      try {
        await cancelPatientPlan(pp.id);
        toast.success("Vínculo cancelado.");
        await loadPatientPlans();
      } catch (err) {
        toast.error(err?.response?.data?.error || "Erro ao cancelar vínculo.");
      }
    },
    [loadPatientPlans],
  );

  // ---- Render ----

  const anyDrawerOpen = spDrawerOpen || ppDrawerOpen;

  return (
    <PageWrapper>
      <Loading isLoading={isLoading} />

      {anyDrawerOpen && (
        <DrawerBackdrop onClick={spDrawerOpen ? closeSpDrawer : closePpDrawer} />
      )}

      {/* Service Plan drawer */}
      <AppDrawer $open={spDrawerOpen}>
          <DrawerHeader>
            <DrawerTitle>
              {spEditingId ? "Editar Plano Comercial" : "Novo Plano Comercial"}
            </DrawerTitle>
            <DrawerCloseBtn type="button" onClick={closeSpDrawer}>
              <FaTimes />
            </DrawerCloseBtn>
          </DrawerHeader>
          <DrawerBody>
            <form onSubmit={handleSpSubmit}>
              <Field>
                Serviço base *
                <select
                  name="service_id"
                  value={spForm.service_id}
                  onChange={handleSpChange}
                  disabled={!!spEditingId}
                >
                  <option value="">Selecione...</option>
                  {services
                    .filter((s) => s.is_active !== false)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field>
                Preço mensal (R$) *
                <input
                  name="price"
                  value={spForm.price}
                  onChange={handleSpChange}
                  placeholder="700,00"
                  inputMode="decimal"
                />
                <FieldHint>Aceito: 700,00 · 1.000,00 · 1000,00 · 1000.50</FieldHint>
              </Field>
              <Field>
                Sessões por semana
                <input
                  name="sessions_per_week"
                  type="number"
                  min="1"
                  max="7"
                  value={spForm.sessions_per_week}
                  onChange={handleSpChange}
                  placeholder="Ex: 2"
                />
              </Field>
              <DrawerFooter>
                <GhostButton type="button" onClick={closeSpDrawer}>
                  Cancelar
                </GhostButton>
                <SaveBtn type="submit" disabled={isSaving}>
                  {isSaving ? "Salvando..." : "Salvar"}
                </SaveBtn>
              </DrawerFooter>
            </form>
          </DrawerBody>
      </AppDrawer>

      {/* Patient Plan drawer */}
      <AppDrawer $open={ppDrawerOpen}>
          <DrawerHeader>
            <DrawerTitle>
              {ppEditingId ? "Editar Vínculo" : "Novo Vínculo de Plano"}
            </DrawerTitle>
            <DrawerCloseBtn type="button" onClick={closePpDrawer}>
              <FaTimes />
            </DrawerCloseBtn>
          </DrawerHeader>
          <DrawerBody>
            <form onSubmit={handlePpSubmit}>
              {ppEditingStatus && (
                <StatusRow>
                  <span>Status atual:</span>
                  <StatusPill $tone={ppEditingStatus}>
                    {STATUS_INFO[ppEditingStatus]?.label || ppEditingStatus}
                  </StatusPill>
                  <StatusNote>
                    Use Pausar / Retomar / Cancelar na tabela para alterar o status.
                  </StatusNote>
                </StatusRow>
              )}
              <Field>
                Paciente *
                <select
                  name="patient_id"
                  value={ppForm.patient_id}
                  onChange={handlePpChange}
                  disabled={!!ppEditingId}
                >
                  <option value="">Selecione...</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name || p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field>
                Plano comercial *
                <select
                  name="service_plan_id"
                  value={ppForm.service_plan_id}
                  onChange={handlePpChange}
                >
                  <option value="">Selecione...</option>
                  {activeServicePlans.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.name}
                      {sp.Service?.name ? ` (${sp.Service.name})` : ""} —{" "}
                      {formatPrice(sp.price_cents)}/mês
                    </option>
                  ))}
                </select>
              </Field>
              <Field>
                Dia âncora (1–28) *
                <input
                  name="anchor_day"
                  type="number"
                  min="1"
                  max="28"
                  value={ppForm.anchor_day}
                  onChange={handlePpChange}
                  placeholder="Ex: 10"
                />
                <FieldHint>Dia do mês em que o ciclo mensal começa.</FieldHint>
              </Field>
              <Field>
                Início *
                <input
                  name="starts_at"
                  type="date"
                  value={ppForm.starts_at}
                  onChange={handlePpChange}
                />
              </Field>
              <Field>
                Término (opcional)
                <input
                  name="ends_at"
                  type="date"
                  value={ppForm.ends_at}
                  onChange={handlePpChange}
                />
                <FieldHint>Deixe em branco para plano sem data de fim.</FieldHint>
              </Field>
              <Field>
                Observações
                <textarea
                  name="notes"
                  value={ppForm.notes}
                  onChange={handlePpChange}
                  rows={3}
                  placeholder="Opcional..."
                />
              </Field>
              <DrawerFooter>
                <GhostButton type="button" onClick={closePpDrawer}>
                  Cancelar
                </GhostButton>
                <SaveBtn type="submit" disabled={isSaving}>
                  {isSaving ? "Salvando..." : "Salvar"}
                </SaveBtn>
              </DrawerFooter>
            </form>
          </DrawerBody>
      </AppDrawer>

      <PageContent>
        <ModuleHeader>
          <ModuleTitle>Planos Mensais</ModuleTitle>
        </ModuleHeader>

        <ModuleTabs>
          <ModuleTabButton
            type="button"
            $active={activeTab === "service-plans"}
            onClick={() => setActiveTab("service-plans")}
          >
            Planos Comerciais
          </ModuleTabButton>
          <ModuleTabButton
            type="button"
            $active={activeTab === "patient-plans"}
            onClick={() => setActiveTab("patient-plans")}
          >
            Planos de Pacientes
          </ModuleTabButton>
        </ModuleTabs>

        {/* ---- Service Plans tab ---- */}
        {activeTab === "service-plans" && (
          <ModuleBody>
            <AppToolbar>
              <AppToolbarLeft>
                <select
                  value={spFilterServiceId}
                  onChange={(e) => setSpFilterServiceId(e.target.value)}
                >
                  <option value="">Todos os serviços</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </AppToolbarLeft>
              <PrimaryButton type="button" onClick={openSpCreate}>
                <FaPlus /> Novo Plano
              </PrimaryButton>
            </AppToolbar>

            <TableWrap>
              <DataTable>
                <thead>
                  <tr>
                    <TH>Nome</TH>
                    <TH>Serviço</TH>
                    <TH>Frequência</TH>
                    <TH>Preço/mês</TH>
                    <TH>Status</TH>
                    <TH>Ações</TH>
                  </tr>
                </thead>
                <tbody>
                  {filteredServicePlans.length === 0 && (
                    <tr>
                      <td colSpan={6}>
                        <Empty>Nenhum plano encontrado.</Empty>
                      </td>
                    </tr>
                  )}
                  {filteredServicePlans.map((sp) => (
                    <tr key={sp.id}>
                      <TD>
                        <strong>{sp.name}</strong>
                      </TD>
                      <TD>{sp.Service?.name || "-"}</TD>
                      <TD>
                        {sp.frequency_label ||
                          (sp.sessions_per_week
                            ? `${sp.sessions_per_week}x/sem`
                            : "-")}
                      </TD>
                      <TD>{formatPrice(sp.price_cents)}</TD>
                      <TD>
                        <StatusPill $tone={sp.is_active ? "active" : "canceled"}>
                          {sp.is_active ? "Ativo" : "Inativo"}
                        </StatusPill>
                      </TD>
                      <TD>
                        <RowActions>
                          <RowActionButton
                            type="button"
                            onClick={() => openSpEdit(sp)}
                          >
                            Editar
                          </RowActionButton>
                          {sp.is_active && (
                            <DangerButton
                              type="button"
                              onClick={() => handleSpDeactivate(sp)}
                            >
                              Inativar
                            </DangerButton>
                          )}
                        </RowActions>
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </TableWrap>
          </ModuleBody>
        )}

        {/* ---- Patient Plans tab ---- */}
        {activeTab === "patient-plans" && (
          <ModuleBody>
            <AppToolbar>
              <AppToolbarLeft>
                <select
                  value={ppFilterPatientId}
                  onChange={(e) => setPpFilterPatientId(e.target.value)}
                >
                  <option value="">Todos os pacientes</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name || p.name}
                    </option>
                  ))}
                </select>
                <select
                  value={ppFilterStatus}
                  onChange={(e) => setPpFilterStatus(e.target.value)}
                >
                  <option value="">Todos os status</option>
                  <option value="active">Ativo</option>
                  <option value="paused">Pausado</option>
                  <option value="canceled">Cancelado</option>
                </select>
              </AppToolbarLeft>
              <PrimaryButton type="button" onClick={openPpCreate}>
                <FaPlus /> Vincular Paciente
              </PrimaryButton>
            </AppToolbar>

            <TableWrap>
              <DataTable>
                <thead>
                  <tr>
                    <TH>Paciente</TH>
                    <TH>Plano</TH>
                    <TH>Âncora</TH>
                    <TH>Início</TH>
                    <TH>Término</TH>
                    <TH>Status</TH>
                    <TH>Ações</TH>
                  </tr>
                </thead>
                <tbody>
                  {patientPlans.length === 0 && (
                    <tr>
                      <td colSpan={7}>
                        <Empty>Nenhum vínculo encontrado.</Empty>
                      </td>
                    </tr>
                  )}
                  {patientPlans.map((pp) => {
                    const si =
                      STATUS_INFO[pp.status] || {
                        label: pp.status,
                        tone: pp.status,
                      };
                    return (
                      <tr key={pp.id}>
                        <TD>
                          <strong>
                            {pp.Patient?.full_name ||
                              pp.Patient?.name ||
                              "-"}
                          </strong>
                        </TD>
                        <TD>{pp.ServicePlan?.name || "-"}</TD>
                        <TD>Dia {pp.anchor_day}</TD>
                        <TD>{formatDateBR(pp.starts_at)}</TD>
                        <TD>{formatDateBR(pp.ends_at)}</TD>
                        <TD>
                          <StatusPill $tone={pp.status}>
                            {si.label}
                          </StatusPill>
                        </TD>
                        <TD>
                          <RowActions>
                            {pp.status !== "canceled" && (
                              <RowActionButton
                                type="button"
                                onClick={() => openPpEdit(pp)}
                              >
                                Editar
                              </RowActionButton>
                            )}
                            {pp.status === "active" && (
                              <RowActionButton
                                type="button"
                                onClick={() => handlePpPause(pp)}
                              >
                                Pausar
                              </RowActionButton>
                            )}
                            {pp.status === "paused" && (
                              <RowActionButton
                                type="button"
                                onClick={() => handlePpResume(pp)}
                              >
                                Retomar
                              </RowActionButton>
                            )}
                            {pp.status !== "canceled" && (
                              <DangerButton
                                type="button"
                                onClick={() => handlePpCancel(pp)}
                              >
                                Cancelar
                              </DangerButton>
                            )}
                          </RowActions>
                        </TD>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>
            </TableWrap>
          </ModuleBody>
        )}
      </PageContent>
    </PageWrapper>
  );
}

// ---------------------------------------------------------------------------
// Styled components
// ---------------------------------------------------------------------------

const RowActions = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: nowrap;
`;


const Empty = styled.div`
  padding: 32px;
  text-align: center;
  color: #aaa;
  font-size: 0.9rem;
`;


// SaveBtn mantém padding e font-size específicos de formulário em drawer
const SaveBtn = styled(PrimaryButton)`
  padding: 9px 22px;
  font-size: 0.9rem;
`;

const StatusRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 10px 12px;
  background: #f9faf6;
  border-radius: 8px;
  border: 1px solid rgba(106, 121, 92, 0.14);
  margin-bottom: 16px;
  font-size: 0.85rem;
  color: #555;
`;

const StatusNote = styled.span`
  font-size: 0.77rem;
  color: #aaa;
  flex-basis: 100%;
`;
