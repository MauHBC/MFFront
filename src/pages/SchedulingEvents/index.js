import React, { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { toast } from "react-toastify";
import { FaCheckCircle, FaSave } from "react-icons/fa";

import axios from "../../services/axios";
import Loading from "../../components/Loading";
import { LinkGhostButton } from "../../components/AppButton";
import { PageWrapper, PageContent } from "../../components/AppLayout";
import {
  ModuleHeader,
  ModulePanel,
  ModuleTitle,
  ModuleSubtitle,
} from "../../components/AppModuleShell";
import {
  acknowledgeSchedulingConflict,
  createSpecialSchedulingEvent,
  getUnitSchedulingPolicy,
  listSchedulingConflicts,
  listSpecialSchedulingEvents,
  resolveSchedulingConflict,
  updateSpecialSchedulingEvent,
  updateUnitSchedulingPolicy,
} from "../../services/scheduling";

const SOURCE_OPTIONS = [
  { value: "national", label: "Feriado nacional" },
  { value: "state", label: "Feriado estadual" },
  { value: "city", label: "Feriado municipal" },
  { value: "optional_point", label: "Ponto facultativo" },
  { value: "internal_block", label: "Bloqueio interno" },
  { value: "staff_time_off", label: "Ausencia profissional" },
  { value: "unit_closure", label: "Fechamento da unidade" },
];

const BEHAVIOR_OPTIONS = [
  { value: "INFO", label: "Informativo" },
  { value: "WARN_CONFIRM", label: "Alerta com confirmacao" },
  { value: "BLOCK", label: "Bloqueante" },
];

const eventFormDefaults = {
  source_type: "internal_block",
  behavior_type: "BLOCK",
  name: "",
  description: "",
  start_date: "",
  end_date: "",
  all_day: true,
  start_time: "08:00",
  end_time: "18:00",
  affects_scheduling: true,
  professional_id: "",
  state_code: "",
  city_name: "",
};

const policyDefaults = {
  country_code: "BR",
  state_code: "",
  city_name: "",
  national_behavior: "BLOCK",
  state_behavior: "BLOCK",
  city_behavior: "BLOCK",
  optional_point_behavior: "WARN_CONFIRM",
  internal_block_behavior: "BLOCK",
  staff_time_off_behavior: "BLOCK",
  unit_closure_behavior: "BLOCK",
  allow_admin_override_block: true,
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR");
};

export default function SchedulingEvents() {
  const [isLoading, setIsLoading] = useState(false);
  const [events, setEvents] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [eventForm, setEventForm] = useState(eventFormDefaults);
  const [policyForm, setPolicyForm] = useState(policyDefaults);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [eventsResponse, conflictsResponse, policyResponse, usersResponse] =
        await Promise.all([
          listSpecialSchedulingEvents({ include_inactive: true }),
          listSchedulingConflicts({}),
          getUnitSchedulingPolicy(),
          axios.get("/users", { params: { group: "profissional" } }),
        ]);

      setEvents(Array.isArray(eventsResponse.data) ? eventsResponse.data : []);
      setConflicts(Array.isArray(conflictsResponse.data) ? conflictsResponse.data : []);
      setProfessionals(Array.isArray(usersResponse.data) ? usersResponse.data : []);
      const payload = policyResponse?.data || {};
      setPolicyForm((prev) => ({
        ...prev,
        country_code: payload?.clinic_location?.country_code || prev.country_code,
        state_code: payload?.clinic_location?.state_code || "",
        city_name: payload?.clinic_location?.city_name || "",
        national_behavior: payload.national_behavior || prev.national_behavior,
        state_behavior: payload.state_behavior || prev.state_behavior,
        city_behavior: payload.city_behavior || prev.city_behavior,
        optional_point_behavior:
          payload.optional_point_behavior || prev.optional_point_behavior,
        internal_block_behavior:
          payload.internal_block_behavior || prev.internal_block_behavior,
        staff_time_off_behavior:
          payload.staff_time_off_behavior || prev.staff_time_off_behavior,
        unit_closure_behavior:
          payload.unit_closure_behavior || prev.unit_closure_behavior,
        allow_admin_override_block:
          payload.allow_admin_override_block !== false,
      }));
    } catch (error) {
      toast.error(
        error?.response?.data?.error ||
          "Nao foi possivel carregar eventos especiais.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const pendingConflicts = useMemo(
    () =>
      conflicts.filter(
        (conflict) => conflict.status === "OPEN" || conflict.status === "ACKNOWLEDGED",
      ),
    [conflicts],
  );

  const handleEventChange = useCallback((event) => {
    const { name, value, type, checked } = event.target;
    setEventForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }, []);

  const handlePolicyChange = useCallback((event) => {
    const { name, value, type, checked } = event.target;
    setPolicyForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }, []);

  const handleCreateEvent = useCallback(
    async (event) => {
      event.preventDefault();
      if (!eventForm.name.trim()) {
        toast.error("Informe o nome do evento especial.");
        return;
      }
      if (!eventForm.start_date || !eventForm.end_date) {
        toast.error("Informe inicio e fim do evento.");
        return;
      }
      try {
        await createSpecialSchedulingEvent({
          source_type: eventForm.source_type,
          behavior_type: eventForm.behavior_type || null,
          name: eventForm.name.trim(),
          description: eventForm.description.trim() || null,
          start_date: eventForm.start_date,
          end_date: eventForm.end_date,
          all_day: !!eventForm.all_day,
          start_time: eventForm.all_day ? null : eventForm.start_time,
          end_time: eventForm.all_day ? null : eventForm.end_time,
          affects_scheduling: !!eventForm.affects_scheduling,
          professional_id: eventForm.professional_id
            ? Number(eventForm.professional_id)
            : null,
          state_code: eventForm.state_code || null,
          city_name: eventForm.city_name || null,
        });
        toast.success("Evento especial criado.");
        setEventForm(eventFormDefaults);
        await loadData();
      } catch (error) {
        toast.error(
          error?.response?.data?.error ||
            "Nao foi possivel criar evento especial.",
        );
      }
    },
    [eventForm, loadData],
  );

  const handleSavePolicy = useCallback(
    async (event) => {
      event.preventDefault();
      try {
        await updateUnitSchedulingPolicy(policyForm);
        toast.success("Politica salva.");
        await loadData();
      } catch (error) {
        toast.error(
          error?.response?.data?.error || "Nao foi possivel salvar politica.",
        );
      }
    },
    [loadData, policyForm],
  );

  const handleToggleEvent = useCallback(
    async (eventItem) => {
      try {
        await updateSpecialSchedulingEvent(eventItem.id, {
          is_active: !eventItem.is_active,
        });
        toast.success(eventItem.is_active ? "Evento inativado." : "Evento reativado.");
        await loadData();
      } catch (error) {
        toast.error(
          error?.response?.data?.error ||
            "Nao foi possivel atualizar evento especial.",
        );
      }
    },
    [loadData],
  );

  const handleAcknowledge = useCallback(
    async (conflictId) => {
      try {
        await acknowledgeSchedulingConflict(conflictId, {});
        toast.success("Conflito reconhecido.");
        await loadData();
      } catch (error) {
        toast.error(
          error?.response?.data?.error ||
            "Nao foi possivel reconhecer o conflito.",
        );
      }
    },
    [loadData],
  );

  const handleResolve = useCallback(
    async (conflictId) => {
      try {
        await resolveSchedulingConflict(conflictId, {
          notes: "Resolvido manualmente.",
        });
        toast.success("Conflito resolvido.");
        await loadData();
      } catch (error) {
        toast.error(
          error?.response?.data?.error || "Nao foi possivel resolver conflito.",
        );
      }
    },
    [loadData],
  );

  return (
    <PageWrapper $paddingTop="90px" $paddingBottom="60px">
      <PageContent
        $maxWidth="1260px"
        $paddingTop="0"
        $paddingX="20px"
        $paddingBottom="0"
        $mobilePaddingX="20px"
        $mobilePaddingTop="0"
        $mobilePaddingBottom="0"
      >
        <Header>
          <div>
            <HeaderTitle>Eventos especiais da agenda</HeaderTitle>
            <HeaderSubtitle>Gerencie bloqueios e conflitos operacionais.</HeaderSubtitle>
          </div>
          <BackLink to="/agendamentos">Voltar</BackLink>
        </Header>
        <Loading isLoading={isLoading} />

        <Section>
          <h2>Politica e localidade da unidade</h2>
          <SimpleForm onSubmit={handleSavePolicy}>
            <input name="country_code" value={policyForm.country_code} onChange={handlePolicyChange} placeholder="BR" />
            <input name="state_code" value={policyForm.state_code} onChange={handlePolicyChange} placeholder="ES" />
            <input name="city_name" value={policyForm.city_name} onChange={handlePolicyChange} placeholder="Vitoria" />
            <select name="national_behavior" value={policyForm.national_behavior} onChange={handlePolicyChange}>
              {BEHAVIOR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select name="state_behavior" value={policyForm.state_behavior} onChange={handlePolicyChange}>
              {BEHAVIOR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select name="city_behavior" value={policyForm.city_behavior} onChange={handlePolicyChange}>
              {BEHAVIOR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select name="optional_point_behavior" value={policyForm.optional_point_behavior} onChange={handlePolicyChange}>
              {BEHAVIOR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select name="internal_block_behavior" value={policyForm.internal_block_behavior} onChange={handlePolicyChange}>
              {BEHAVIOR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select name="staff_time_off_behavior" value={policyForm.staff_time_off_behavior} onChange={handlePolicyChange}>
              {BEHAVIOR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select name="unit_closure_behavior" value={policyForm.unit_closure_behavior} onChange={handlePolicyChange}>
              {BEHAVIOR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <input
              type="checkbox"
              name="allow_admin_override_block"
              aria-label="Permitir override admin em bloqueios"
              checked={!!policyForm.allow_admin_override_block}
              onChange={handlePolicyChange}
            />
            <span>Permitir override admin em bloqueios</span>
            <SaveButton type="submit"><FaSave /> Salvar politica</SaveButton>
          </SimpleForm>
        </Section>

        <Section>
          <h2>Novo evento especial</h2>
          <SimpleForm onSubmit={handleCreateEvent}>
            <select name="source_type" value={eventForm.source_type} onChange={handleEventChange}>
              {SOURCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select name="behavior_type" value={eventForm.behavior_type} onChange={handleEventChange}>
              {BEHAVIOR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <input name="name" value={eventForm.name} onChange={handleEventChange} placeholder="Nome do evento" />
            <input type="date" name="start_date" value={eventForm.start_date} onChange={handleEventChange} />
            <input type="date" name="end_date" value={eventForm.end_date} onChange={handleEventChange} />
            <input
              type="checkbox"
              name="all_day"
              aria-label="Evento em dia inteiro"
              checked={!!eventForm.all_day}
              onChange={handleEventChange}
            />
            <span>Evento em dia inteiro</span>
            {!eventForm.all_day && (
              <>
                <input
                  type="time"
                  name="start_time"
                  value={eventForm.start_time}
                  onChange={handleEventChange}
                />
                <input
                  type="time"
                  name="end_time"
                  value={eventForm.end_time}
                  onChange={handleEventChange}
                />
              </>
            )}
            <select name="professional_id" value={eventForm.professional_id} onChange={handleEventChange}>
              <option value="">Todos profissionais</option>
              {professionals.map((professional) => (
                <option key={professional.id} value={professional.id}>{professional.name}</option>
              ))}
            </select>
            <input name="state_code" value={eventForm.state_code} onChange={handleEventChange} placeholder="Estado (ex.: ES)" />
            <input name="city_name" value={eventForm.city_name} onChange={handleEventChange} placeholder="Cidade (ex.: Vitoria)" />
            <input
              type="checkbox"
              name="affects_scheduling"
              aria-label="Impacta disponibilidade"
              checked={!!eventForm.affects_scheduling}
              onChange={handleEventChange}
            />
            <span>Impacta disponibilidade</span>
            <textarea name="description" value={eventForm.description} onChange={handleEventChange} placeholder="Descricao" />
            <SaveButton type="submit"><FaSave /> Criar evento</SaveButton>
          </SimpleForm>
        </Section>

        <Section>
          <h2>Eventos cadastrados ({events.length})</h2>
          <Table>
            {events.map((eventItem) => (
              <Row key={eventItem.id}>
                <span>{formatDate(eventItem.start_date)} - {formatDate(eventItem.end_date)}</span>
                <strong>{eventItem.name}</strong>
                <small>{eventItem.source_type}</small>
                <ActionButton
                  type="button"
                  onClick={() => handleToggleEvent(eventItem)}
                >
                  {eventItem.is_active ? "Inativar" : "Reativar"}
                </ActionButton>
              </Row>
            ))}
          </Table>
        </Section>

        <Section>
          <h2>Conflitos pendentes ({pendingConflicts.length})</h2>
          <Table>
            {conflicts.map((conflict) => (
              <Row key={conflict.id}>
                <span>{conflict?.sourceEvent?.name || "-"}</span>
                <strong>{conflict?.appointment?.Patient?.full_name || "Paciente"}</strong>
                <small>{conflict.status}</small>
                <Buttons>
                  {conflict.status !== "RESOLVED" && (
                    <>
                      <ActionButton type="button" onClick={() => handleAcknowledge(conflict.id)}>
                        Reconhecer
                      </ActionButton>
                      <ActionButton type="button" onClick={() => handleResolve(conflict.id)}>
                        <FaCheckCircle /> Resolver
                      </ActionButton>
                    </>
                  )}
                </Buttons>
              </Row>
            ))}
          </Table>
        </Section>
      </PageContent>
    </PageWrapper>
  );
}

const Header = styled(ModuleHeader)`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
`;

const HeaderTitle = styled(ModuleTitle)`
  margin-bottom: 6px;
`;

const HeaderSubtitle = styled(ModuleSubtitle)`
  margin-top: 0;
`;

const BackLink = styled(LinkGhostButton)`
  padding: 10px 16px;
`;

const Section = styled(ModulePanel).attrs({ as: "section" })`
  border: 1px solid rgba(106, 121, 92, 0.18);
  padding: 14px;
  margin-bottom: 12px;
`;

const SimpleForm = styled.form`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;

  input,
  select,
  textarea {
    border: 1px solid rgba(106, 121, 92, 0.24);
    border-radius: 8px;
    padding: 8px 10px;
  }

  textarea {
    grid-column: 1 / -1;
    min-height: 70px;
  }
`;

const SaveButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: none;
  border-radius: 8px;
  background: #6a795c;
  color: #fff;
  font-weight: 700;
  padding: 8px 12px;
`;

const Table = styled.div`
  display: grid;
  gap: 8px;
`;

const Row = styled.div`
  border: 1px solid rgba(106, 121, 92, 0.18);
  border-radius: 10px;
  padding: 10px;
  display: grid;
  gap: 6px;
`;

const Buttons = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`;

const ActionButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(106, 121, 92, 0.25);
  background: #fff;
  color: #506045;
  border-radius: 8px;
  padding: 6px 10px;
  font-weight: 600;
`;
