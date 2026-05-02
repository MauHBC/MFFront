import React, { useCallback, useEffect, useMemo, useState } from "react";
import styled, { keyframes } from "styled-components";
import { toast } from "react-toastify";
import { FaPlus, FaTimes } from "react-icons/fa";

import { getUserFacingApiError } from "../../services/axios";
import DataLoadingState from "../../components/DataLoadingState";
import { LinkGhostButton } from "../../components/AppButton";
import { PageWrapper, PageContent } from "../../components/AppLayout";
import {
  ModuleHeader,
  ModulePanel,
  ModuleTitle,
  ModuleSubtitle,
} from "../../components/AppModuleShell";
import {
  createSpecialSchedulingEvent,
  inactivateSpecialSchedulingEvent,
  listSpecialSchedulingEvents,
  updateSpecialSchedulingEvent,
} from "../../services/scheduling";

const HOLIDAY_SOURCE_OPTIONS = [
  { value: "national", label: "Feriado nacional" },
  { value: "state", label: "Feriado estadual" },
  { value: "city", label: "Feriado municipal" },
  { value: "optional_point", label: "Ponto facultativo" },
];

const HOLIDAY_SOURCE_LABELS = HOLIDAY_SOURCE_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

const HOLIDAY_SOURCE_SET = new Set(HOLIDAY_SOURCE_OPTIONS.map((option) => option.value));

const HOLIDAY_SCHEDULING_OPTIONS = [
  {
    value: "block",
    label: "Clinica nao funciona e a agenda fica bloqueada",
    help: "Mantem o comportamento atual de bloqueio e avisos de feriado na agenda.",
  },
  {
    value: "open",
    label: "Clinica funciona normalmente",
    help: "O feriado fica apenas informativo e a agenda continua liberada.",
  },
];

const emptyHolidayForm = {
  name: "",
  date: "",
  source_type: "national",
  state_code: "",
  city_name: "",
  scheduling_mode: "block",
};

const formatHolidayDate = (value) => {
  if (!value) return "-";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("pt-BR");
};

const formatHolidayLocation = (item) => {
  if (!item) return "";
  if (item.source_type === "city") {
    const city = String(item.city_name || "").trim();
    const state = String(item.state_code || "").trim().toUpperCase();
    if (city && state) return `${city}/${state}`;
    if (city) return city;
  }
  if (item.source_type === "state") {
    const state = String(item.state_code || "").trim().toUpperCase();
    if (state) return state;
  }
  return "";
};

const getHolidaySchedulingMode = (item) =>
  item?.affects_scheduling === false ? "open" : "block";

const getHolidaySchedulingPayload = (mode) => {
  if (mode === "open") {
    return {
      behavior_type: "INFO",
      affects_scheduling: false,
    };
  }

  return {
    behavior_type: "BLOCK",
    affects_scheduling: true,
  };
};

const getHolidaySchedulingLabel = (item) =>
  getHolidaySchedulingMode(item) === "open"
    ? "Clinica funciona"
    : "Clinica fechada";

const getHolidaySchedulingDescription = (item) =>
  getHolidaySchedulingMode(item) === "open"
    ? "Agenda liberada"
    : "Agenda bloqueada";

export default function SchedulingEvents() {
  const [holidays, setHolidays] = useState([]);
  const [isHolidayLoading, setIsHolidayLoading] = useState(false);
  const [isHolidaySaving, setIsHolidaySaving] = useState(false);
  const [holidayUpdatingId, setHolidayUpdatingId] = useState(null);
  const [isHolidayOpen, setIsHolidayOpen] = useState(false);
  const [holidayForm, setHolidayForm] = useState(emptyHolidayForm);

  const holidayRows = useMemo(
    () =>
      [...holidays].sort((first, second) => {
        const firstDate = String(first?.start_date || "");
        const secondDate = String(second?.start_date || "");
        return firstDate.localeCompare(secondDate);
      }),
    [holidays],
  );

  const loadHolidays = useCallback(async () => {
    try {
      setIsHolidayLoading(true);
      const response = await listSpecialSchedulingEvents({});
      const items = Array.isArray(response.data) ? response.data : [];
      setHolidays(items.filter((item) => HOLIDAY_SOURCE_SET.has(item.source_type)));
    } catch (error) {
      toast.error(getUserFacingApiError(error, "Nao foi possivel carregar os feriados."));
    } finally {
      setIsHolidayLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHolidays();
  }, [loadHolidays]);

  const openHolidayModal = useCallback(() => {
    setHolidayForm(emptyHolidayForm);
    setIsHolidayOpen(true);
  }, []);

  const closeHolidayModal = useCallback(() => {
    if (isHolidaySaving) return;
    setIsHolidayOpen(false);
  }, [isHolidaySaving]);

  const handleHolidayChange = useCallback((event) => {
    const { name, value } = event.target;
    setHolidayForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "source_type") {
        if (value !== "state" && value !== "city") {
          next.state_code = "";
        }
        if (value !== "city") {
          next.city_name = "";
        }
      }
      if (name === "state_code") {
        next.state_code = String(value || "").toUpperCase().slice(0, 2);
      }
      return next;
    });
  }, []);

  const handleSaveHoliday = useCallback(async () => {
    if (!holidayForm.name.trim()) {
      toast.error("Informe o nome do feriado.");
      return;
    }
    if (!holidayForm.date) {
      toast.error("Informe a data do feriado.");
      return;
    }
    if (holidayForm.source_type === "state" && !holidayForm.state_code.trim()) {
      toast.error("Informe a UF do feriado estadual.");
      return;
    }
    if (holidayForm.source_type === "city") {
      if (!holidayForm.state_code.trim()) {
        toast.error("Informe a UF do feriado municipal.");
        return;
      }
      if (!holidayForm.city_name.trim()) {
        toast.error("Informe a cidade do feriado municipal.");
        return;
      }
    }

    try {
      setIsHolidaySaving(true);
      await createSpecialSchedulingEvent({
        source_type: holidayForm.source_type,
        name: holidayForm.name.trim(),
        description: null,
        start_date: holidayForm.date,
        end_date: holidayForm.date,
        all_day: true,
        start_time: null,
        end_time: null,
        professional_id: null,
        state_code: holidayForm.state_code.trim() || null,
        city_name: holidayForm.city_name.trim() || null,
        ...getHolidaySchedulingPayload(holidayForm.scheduling_mode),
      });
      toast.success("Feriado adicionado.");
      setHolidayForm(emptyHolidayForm);
      setIsHolidayOpen(false);
      await loadHolidays();
    } catch (error) {
      toast.error(getUserFacingApiError(error, "Nao foi possivel salvar o feriado."));
    } finally {
      setIsHolidaySaving(false);
    }
  }, [holidayForm, loadHolidays]);

  const handleDeleteHoliday = useCallback(
    async (holiday) => {
      if (!holiday?.id) return;
      try {
        await inactivateSpecialSchedulingEvent(holiday.id);
        toast.success("Feriado excluido.");
        await loadHolidays();
      } catch (error) {
        toast.error(getUserFacingApiError(error, "Nao foi possivel excluir o feriado."));
      }
    },
    [loadHolidays],
  );

  const handleToggleHolidayScheduling = useCallback(
    async (holiday) => {
      if (!holiday?.id) return;
      const currentMode = getHolidaySchedulingMode(holiday);
      const nextMode = currentMode === "block" ? "open" : "block";

      try {
        setHolidayUpdatingId(holiday.id);
        await updateSpecialSchedulingEvent(holiday.id, {
          ...getHolidaySchedulingPayload(nextMode),
        });
        toast.success(
          nextMode === "block"
            ? "Feriado configurado para bloquear a agenda."
            : "Feriado configurado como informativo.",
        );
        await loadHolidays();
      } catch (error) {
        toast.error(
          getUserFacingApiError(error, "Nao foi possivel atualizar o comportamento do feriado."),
        );
      } finally {
        setHolidayUpdatingId(null);
      }
    },
    [loadHolidays],
  );

  let content = (
    <TableScroll>
      <SimpleTable>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Data</th>
            <th>Tipo</th>
            <th>Funcionamento</th>
            <th>Acoes</th>
          </tr>
        </thead>
        <tbody>
          {holidayRows.map((holiday) => {
            const location = formatHolidayLocation(holiday);
            const schedulingMode = getHolidaySchedulingMode(holiday);
            const isUpdatingThisHoliday = holidayUpdatingId === holiday.id;
            return (
              <tr key={holiday.id}>
                <td>
                  <CellStack>
                    <span>{holiday.name || "Feriado"}</span>
                    {location ? <MutedText>{location}</MutedText> : null}
                  </CellStack>
                </td>
                <td>{formatHolidayDate(holiday.start_date)}</td>
                <td>{HOLIDAY_SOURCE_LABELS[holiday.source_type] || holiday.source_type || "-"}</td>
                <td>
                  <CellStack>
                    <HolidaySchedulingBadge $mode={schedulingMode}>
                      {getHolidaySchedulingLabel(holiday)}
                    </HolidaySchedulingBadge>
                    <MutedText>{getHolidaySchedulingDescription(holiday)}</MutedText>
                  </CellStack>
                </td>
                <td>
                  <RowActions>
                    <SmallButton
                      type="button"
                      onClick={() => handleToggleHolidayScheduling(holiday)}
                      disabled={isUpdatingThisHoliday}
                    >
                      {schedulingMode === "block" ? "Liberar agenda" : "Bloquear agenda"}
                    </SmallButton>
                    <SmallButton
                      type="button"
                      onClick={() => handleDeleteHoliday(holiday)}
                      disabled={isUpdatingThisHoliday}
                    >
                      Excluir
                    </SmallButton>
                  </RowActions>
                </td>
              </tr>
            );
          })}
        </tbody>
      </SimpleTable>
    </TableScroll>
  );

  if (isHolidayLoading) {
    content = <DataLoadingState text="Carregando feriados..." />;
  } else if (holidayRows.length === 0) {
    content = <EmptyState>Sem feriados cadastrados.</EmptyState>;
  }

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
            <HeaderTitle>Feriados</HeaderTitle>
            <HeaderSubtitle>
              Defina os feriados e se a clinica vai funcionar ou bloquear a agenda em cada data.
            </HeaderSubtitle>
          </div>
          <BackLink to="/agendamentos">Voltar</BackLink>
        </Header>

        <Section>
          <SectionHeader>
            <div>
              <SectionTitle>Feriados</SectionTitle>
              <SectionSubtitle>
                Controle os dias que aparecem na agenda como liberados ou bloqueados.
              </SectionSubtitle>
            </div>
            <HeaderActions>
              <GhostButton type="button" onClick={loadHolidays}>
                Atualizar
              </GhostButton>
              <PrimaryButton type="button" onClick={openHolidayModal}>
                <FaPlus />
                Novo feriado
              </PrimaryButton>
            </HeaderActions>
          </SectionHeader>

          {content}
        </Section>

        {isHolidayOpen && (
          <>
            <ModalOverlay>
              <ModalCard>
                <ModalHeader>
                  <div>
                    <ModalTitle>Novo feriado</ModalTitle>
                    <ModalSubtitle>
                      Configure se a data bloqueia a agenda ou fica apenas informativa.
                    </ModalSubtitle>
                  </div>
                  <IconButton type="button" onClick={closeHolidayModal}>
                    <FaTimes />
                  </IconButton>
                </ModalHeader>
                <ModalBody>
                  <FormGrid>
                    <Field>
                      <Label htmlFor="holiday-name">Nome</Label>
                      <Input
                        id="holiday-name"
                        name="name"
                        placeholder="Ex.: Tiradentes"
                        value={holidayForm.name}
                        onChange={handleHolidayChange}
                      />
                    </Field>
                    <Field>
                      <Label htmlFor="holiday-date">Data</Label>
                      <Input
                        id="holiday-date"
                        type="date"
                        name="date"
                        value={holidayForm.date}
                        onChange={handleHolidayChange}
                      />
                    </Field>
                    <Field>
                      <Label htmlFor="holiday-source">Tipo</Label>
                      <Select
                        id="holiday-source"
                        name="source_type"
                        value={holidayForm.source_type}
                        onChange={handleHolidayChange}
                      >
                        {HOLIDAY_SOURCE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field>
                      <Label htmlFor="holiday-scheduling-mode">Funcionamento da clinica</Label>
                      <Select
                        id="holiday-scheduling-mode"
                        name="scheduling_mode"
                        value={holidayForm.scheduling_mode}
                        onChange={handleHolidayChange}
                      >
                        {HOLIDAY_SCHEDULING_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                      <MutedText>
                        {HOLIDAY_SCHEDULING_OPTIONS.find(
                          (option) => option.value === holidayForm.scheduling_mode,
                        )?.help || ""}
                      </MutedText>
                    </Field>
                    {(holidayForm.source_type === "state" || holidayForm.source_type === "city") && (
                      <Field>
                        <Label htmlFor="holiday-state">UF</Label>
                        <Input
                          id="holiday-state"
                          name="state_code"
                          placeholder="SP"
                          maxLength={2}
                          value={holidayForm.state_code}
                          onChange={handleHolidayChange}
                        />
                      </Field>
                    )}
                    {holidayForm.source_type === "city" && (
                      <Field>
                        <Label htmlFor="holiday-city">Cidade</Label>
                        <Input
                          id="holiday-city"
                          name="city_name"
                          placeholder="Sao Paulo"
                          value={holidayForm.city_name}
                          onChange={handleHolidayChange}
                        />
                      </Field>
                    )}
                  </FormGrid>
                </ModalBody>
                <ModalActions>
                  <SecondaryButton type="button" onClick={closeHolidayModal} disabled={isHolidaySaving}>
                    Cancelar
                  </SecondaryButton>
                  <PrimaryButton type="button" onClick={handleSaveHoliday} disabled={isHolidaySaving}>
                    {isHolidaySaving ? <ButtonSpinner /> : "Adicionar feriado"}
                  </PrimaryButton>
                </ModalActions>
              </ModalCard>
            </ModalOverlay>
            <Backdrop onClick={closeHolidayModal} />
          </>
        )}
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
  padding: 24px;
  margin-bottom: 12px;
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: 22px;
  color: #2b2b2b;
`;

const SectionSubtitle = styled.p`
  margin: 4px 0 0;
  color: #6b6b6b;
`;

const TableScroll = styled.div`
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
`;

const SimpleTable = styled.table`
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    padding: 12px 8px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    text-align: left;
    font-size: 14px;
    vertical-align: top;
  }

  th {
    font-weight: 700;
    color: #555;
  }
`;

const CellStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const MutedText = styled.span`
  color: #777;
  font-size: 13px;
`;

const HolidaySchedulingBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  background: ${(props) => (props.$mode === "open" ? "#e3f1e0" : "#f7e7dc")};
  color: ${(props) => (props.$mode === "open" ? "#4f6b45" : "#9a6a3a")};
`;

const RowActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const EmptyState = styled.div`
  padding: 40px 16px;
  text-align: center;
  color: #6a795c;
`;

const PrimaryButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 40px;
  border: none;
  border-radius: 10px;
  background: #6a795c;
  color: #fff;
  padding: 10px 16px;
  font-weight: 700;
  cursor: pointer;

  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
`;

const GhostButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 40px;
  border: 1px solid rgba(106, 121, 92, 0.3);
  border-radius: 10px;
  background: #fff;
  color: #4f6045;
  padding: 10px 16px;
  font-weight: 700;
  cursor: pointer;
`;

const SecondaryButton = styled(GhostButton)``;

const SmallButton = styled.button`
  border: 1px solid rgba(106, 121, 92, 0.28);
  border-radius: 10px;
  background: #fff;
  color: #4f6045;
  padding: 7px 10px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const spin = keyframes`
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
`;

const ButtonSpinner = styled.span`
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.45);
  border-top-color: #fff;
  animation: ${spin} 0.75s linear infinite;
`;

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: max(14px, env(safe-area-inset-top)) 16px 14px;
  overflow-y: auto;
  z-index: 2000;
`;

const ModalCard = styled.div`
  width: min(720px, calc(100vw - 32px));
  max-height: calc(100dvh - 28px);
  background: #fff;
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.15);
  z-index: 2001;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  @media (max-width: 760px) {
    width: 100%;
    max-height: calc(100dvh - 16px);
    border-radius: 14px;
    padding: 16px;
  }
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 20px;
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 20px;
`;

const ModalSubtitle = styled.p`
  margin: 4px 0 0;
  color: #6d6d6d;
`;

const IconButton = styled.button`
  border: none;
  background: transparent;
  font-size: 18px;
  color: #4a4a4a;
  cursor: pointer;
`;

const ModalBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
  margin-right: -4px;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Label = styled.label`
  font-weight: 600;
  color: #4a4a4a;
`;

const Input = styled.input`
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.15);
`;

const Select = styled.select`
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  background: #fff;
`;

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
`;

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 1990;
`;
