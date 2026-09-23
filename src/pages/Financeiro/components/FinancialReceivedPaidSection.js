/* eslint-disable react/prop-types */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import styled from "styled-components";
import { FaCog } from "react-icons/fa";
import { useAuthorization } from "../../../contexts/AuthorizationContext";
import { getUserFacingApiError } from "../../../services/axios";
import {
  getReceivedPaid,
  getDistributionConfiguration,
  saveDistributionConfiguration,
} from "../../../services/financialReceivedPaid";
import { colors } from "../../../styles/tokens";
import FinancialDistributionModal from "./FinancialDistributionModal";

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const MASK = "••••";

export default function FinancialReceivedPaidSection(props) {
  const authorization = useAuthorization();
  const token = useSelector((state) => state.auth?.token);
  const generation = useRef(0);
  // Remount private state when the official authorization/session scope changes.
  // The key contains only a generation number, never the token or financial data.
  const scopeKey = useMemo(() => {
    if (!authorization.context || !token) return null;
    generation.current += 1;
    return generation.current;
  }, [authorization.context, token]);
  const {
    ui,
    year,
    yearOptions,
    onYearChange,
    onPreviousYear,
    onNextYear,
    valuesVisible,
    formatCurrency,
    currentDate,
    view = "received-paid",
  } = props;
  if (authorization.isAdministrator !== true || scopeKey === null) return null;
  return (
    <ReceivedPaidContent
      key={`${scopeKey}-${year}-${view}`}
      view={view}
      ui={ui}
      year={year}
      yearOptions={yearOptions}
      onYearChange={onYearChange}
      onPreviousYear={onPreviousYear}
      onNextYear={onNextYear}
      valuesVisible={valuesVisible}
      formatCurrency={formatCurrency}
      currentDate={currentDate}
      onAccessDenied={authorization.reload}
    />
  );
}

function ReceivedPaidContent({
  ui,
  year,
  yearOptions,
  onYearChange,
  onPreviousYear,
  onNextYear,
  valuesVisible,
  formatCurrency,
  currentDate,
  onAccessDenied,
  view,
}) {
  const isDistribution = view === "distribution";
  const sectionLabel = isDistribution ? "Distribuição" : "Recebido e pago";
  const {
    AttendancePeriodBlock,
    AttendancePeriodBlockLeft,
    AttendancePeriodBlockLabel,
    AttendancePeriodBlockValue,
    AttendancePeriodBlockRight,
    AttendancePeriodControls,
    AttendancePeriodButton,
    AttendancePeriodChip,
    AttendancePeriodYearSelect,
    AttendanceCard,
    AttendanceCardHeader,
    AttendanceCardTitle,
    AttendanceEmptyState,
    BlockLoader,
    Spinner,
    AttendanceTableCard,
    AttendanceTableScroll,
    AnnualOverviewTable,
    AttendanceMoneyText,
    SecondaryButton,
    PrimaryButton,
    IconButton,
  } = ui;
  const [report, setReport] = useState(null);
  const [configuration, setConfiguration] = useState(null);
  const [reportError, setReportError] = useState("");
  const [configurationError, setConfigurationError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const [denied, setDenied] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true);
  const deniedRef = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const revoke = () => {
    deniedRef.current = true;
    setReport(null);
    setConfiguration(null);
    setModalOpen(false);
    setDenied(true);
    onAccessDenied?.();
  };
  const revokeRef = useRef(revoke);
  revokeRef.current = revoke;
  useEffect(() => {
    if (deniedRef.current) return undefined;
    const controller = new AbortController();
    let active = true;
    const current = () => active && !deniedRef.current;
    setReport(null);
    setReportError("");
    setConfiguration(null);
    setConfigurationError("");
    const fail = (error, setter, message) => {
      if (!current()) return;
      if ([401, 403].includes(error.response?.status)) revokeRef.current();
      else setter(message);
    };
    getReceivedPaid(year, controller.signal)
      .then((response) => {
        if (current()) setReport(response.data);
      })
      .catch((error) =>
        fail(
          error,
          setReportError,
          isDistribution
            ? "Não foi possível carregar os valores da distribuição."
            : "Não foi possível carregar Recebido e pago.",
        ),
      );
    if (isDistribution) {
      getDistributionConfiguration(controller.signal)
        .then((response) => {
          if (current()) setConfiguration(response.data);
        })
        .catch((error) =>
          fail(
            error,
            setConfigurationError,
            "Não foi possível carregar a configuração da distribuição.",
          ),
        );
    }
    return () => {
      active = false;
      controller.abort();
    };
  }, [year, refresh, isDistribution]);
  const save = async (command) => {
    setSaving(true);
    setSaveError("");
    try {
      await saveDistributionConfiguration(command);
      if (!mounted.current || deniedRef.current) return;
      setModalOpen(false);
      setReport(null);
      setConfiguration(null);
      setNotice("");
      setRefresh((value) => value + 1);
    } catch (error) {
      if (!mounted.current || deniedRef.current) return;
      if ([401, 403].includes(error.response?.status)) revokeRef.current();
      else if (error.response?.status === 409) {
        setModalOpen(false);
        setReport(null);
        setConfiguration(null);
        setNotice(
          "A configuração mudou enquanto você editava. Confira os dados atualizados e abra a configuração novamente.",
        );
        setRefresh((value) => value + 1);
      } else
        setSaveError(
          getUserFacingApiError(
            error,
            "Não foi possível salvar a distribuição. Tente novamente.",
          ),
        );
    } finally {
      if (mounted.current) setSaving(false);
    }
  };
  const money = (amount) => (valuesVisible ? formatCurrency(amount) : MASK);
  const date =
    currentDate instanceof Date && !Number.isNaN(currentDate.getTime())
      ? currentDate
      : new Date();
  const currentMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  const futureEmpty = (month) =>
    valuesVisible &&
    String(year) === String(date.getFullYear()) &&
    month.month > currentMonth &&
    month.received_cents === 0 &&
    month.paid_cents === 0;
  const monthName = (month) => MONTH_NAMES[Number(month.slice(5, 7)) - 1];
  const retry = () => {
    setReport(null);
    setConfiguration(null);
    setRefresh((value) => value + 1);
  };
  const renderReport = () => {
    if (reportError)
      return (
        <div role="alert">
          <p>{reportError}</p>
          <SecondaryButton type="button" onClick={retry}>
            Tentar novamente
          </SecondaryButton>
        </div>
      );
    if (!report)
      return (
        <BlockLoader role="status">
          <Spinner />
          Carregando Recebido e pago...
        </BlockLoader>
      );
    return (
      <AttendanceTableCard>
        <AttendanceTableScroll>
          <AnnualOverviewTable aria-label="Recebido e pago por mês">
            <thead>
              <tr>
                <th scope="col">Mês</th>
                <th scope="col">Recebido</th>
                <th scope="col">Pago</th>
                <th scope="col" data-primary-metric="true">
                  Realizado
                </th>
              </tr>
            </thead>
            <tbody>
              {report.months.map((month) => (
                <tr
                  key={month.month}
                  data-current-month={
                    month.month === currentMonth ? "true" : undefined
                  }
                  data-future-empty={futureEmpty(month) ? "true" : undefined}
                >
                  <td>
                    {monthName(month.month)}
                    {month.month === currentMonth ? (
                      <small> · Atual</small>
                    ) : null}
                  </td>
                  <td>
                    <AttendanceMoneyText>
                      {futureEmpty(month) ? "—" : money(month.received_cents)}
                    </AttendanceMoneyText>
                  </td>
                  <td>
                    <AttendanceMoneyText>
                      {futureEmpty(month) ? "—" : money(month.paid_cents)}
                    </AttendanceMoneyText>
                  </td>
                  <td data-primary-metric="true">
                    <Result
                      $negative={
                        valuesVisible && month.realized_result_cents < 0
                      }
                    >
                      {futureEmpty(month)
                        ? "—"
                        : money(month.realized_result_cents)}
                    </Result>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total no ano</th>
                <td>{money(report.totals.received_cents)}</td>
                <td>{money(report.totals.paid_cents)}</td>
                <td data-primary-metric="true">
                  <Result
                    $negative={
                      valuesVisible && report.totals.realized_result_cents < 0
                    }
                  >
                    {money(report.totals.realized_result_cents)}
                  </Result>
                </td>
              </tr>
            </tfoot>
          </AnnualOverviewTable>
        </AttendanceTableScroll>
      </AttendanceTableCard>
    );
  };
  const renderDistribution = () => {
    if (configurationError)
      return (
        <div role="alert">
          <p>{configurationError}</p>
          <SecondaryButton type="button" onClick={retry}>
            Recarregar distribuição
          </SecondaryButton>
        </div>
      );
    if (!configuration)
      return (
        <BlockLoader role="status">
          <Spinner />
          Carregando distribuição...
        </BlockLoader>
      );
    if (!configuration.configured)
      return (
        <AttendanceEmptyState>
          <p>
            Configure participantes para visualizar quanto caberia a cada um do
            resultado disponível.
          </p>
          <PrimaryButton
            type="button"
            onClick={() => {
              setSaveError("");
              setModalOpen(true);
            }}
          >
            Configurar distribuição
          </PrimaryButton>
        </AttendanceEmptyState>
      );
    if (!report?.distribution) {
      if (!report && !reportError)
        return (
          <BlockLoader role="status">
            Carregando valores da distribuição...
          </BlockLoader>
        );
      return (
        <div>
          <p>{reportError || "Recarregue os valores da distribuição."}</p>
          <SecondaryButton type="button" onClick={retry}>
            Recarregar valores
          </SecondaryButton>
        </div>
      );
    }
    return (
      <AttendanceTableCard>
        <AttendanceTableScroll>
          <DistributionTable
            as={AnnualOverviewTable}
            $separatorColor={ui.attendancePalette.borderStrong}
            aria-label="Distribuição do resultado por mês"
          >
            <thead>
              <tr>
                <th scope="col">Mês</th>
                <th scope="col">Resultado</th>
                {report.distribution.participants.map((participant) => (
                  <th scope="col" key={participant.participant_id}>
                    {participant.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.months.map((month) => (
                <tr
                  key={month.month}
                  data-current-month={
                    month.month === currentMonth ? "true" : undefined
                  }
                >
                  <td>{monthName(month.month)}</td>
                  <td>
                    {valuesVisible && !month.distribution.has_available_result
                      ? "—"
                      : money(month.distribution.distributable_cents)}
                  </td>
                  {report.distribution.participants.map((column) => {
                    const participant = month.distribution.participants.find(
                      (item) => item.participant_id === column.participant_id,
                    );
                    return (
                      <td key={column.participant_id}>
                        {!participant ||
                        (valuesVisible &&
                          !month.distribution.has_available_result)
                          ? "—"
                          : money(participant.amount_cents)}
                        {participant &&
                        valuesVisible &&
                        month.distribution.has_available_result &&
                        participant.name !== column.name ? (
                          <small>{participant.name}</small>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total distribuível no ano</th>
                <td>{money(report.distribution.distributable_cents)}</td>
                {report.distribution.participants.map((participant) => (
                  <td key={participant.participant_id}>
                    {money(participant.amount_cents)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </DistributionTable>
        </AttendanceTableScroll>
      </AttendanceTableCard>
    );
  };
  if (denied)
    return (
      <p role="alert">Você não tem autorização para acessar {sectionLabel}.</p>
    );
  return (
    <>
      <AttendancePeriodBlock>
        <AttendancePeriodBlockLeft>
          <AttendancePeriodBlockLabel>
            Ano financeiro
          </AttendancePeriodBlockLabel>
          <AttendancePeriodBlockValue>{year}</AttendancePeriodBlockValue>
        </AttendancePeriodBlockLeft>
        <AttendancePeriodBlockRight>
          <AttendancePeriodControls>
            <AttendancePeriodButton type="button" onClick={onPreviousYear}>
              &lt; Ano anterior
            </AttendancePeriodButton>
            <AttendancePeriodChip>
              {year}
              <AttendancePeriodYearSelect
                aria-label={`Selecionar ano de ${sectionLabel}`}
                value={year}
                onChange={onYearChange}
              >
                {yearOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </AttendancePeriodYearSelect>
            </AttendancePeriodChip>
            <AttendancePeriodButton type="button" onClick={onNextYear}>
              Próximo ano &gt;
            </AttendancePeriodButton>
          </AttendancePeriodControls>
        </AttendancePeriodBlockRight>
      </AttendancePeriodBlock>
      {!isDistribution ? (
        <AttendanceCard>
          <AttendanceCardHeader>
            <AttendanceCardTitle>Recebido e pago</AttendanceCardTitle>
          </AttendanceCardHeader>
          <Description>
            Recebido é o que entrou; Pago é o que saiu. Resultado realizado é a
            diferença entre os dois.
          </Description>
          {renderReport()}
        </AttendanceCard>
      ) : (
        <AttendanceCard>
          <AttendanceCardHeader>
            <AttendanceCardTitle>Distribuição do resultado</AttendanceCardTitle>
            {configuration?.configured ? (
              <IconButton
                type="button"
                aria-label="Configurar distribuição"
                onClick={() => {
                  setSaveError("");
                  setModalOpen(true);
                }}
              >
                <FaCog />
              </IconButton>
            ) : null}
          </AttendanceCardHeader>
          <Description>
            Usa os recebimentos e pagamentos efetivos de cada mês, como em
            Recebido e pago. Apenas resultados positivos são distribuídos
            conforme os participantes e percentuais configurados. Demonstrativo,
            sem gerar repasses ou pagamentos.
          </Description>
          {notice ? <p role="status">{notice}</p> : null}
          {renderDistribution()}
        </AttendanceCard>
      )}
      {isDistribution && modalOpen && configuration ? (
        <FinancialDistributionModal
          ui={ui}
          configuration={configuration}
          saving={saving}
          error={saveError}
          onClose={() => setModalOpen(false)}
          onSave={save}
        />
      ) : null}
    </>
  );
}

const Description = styled.p`
  color: ${colors.textSecondary};
  font-size: 13px;
  margin: 0 0 16px;
`;
const Result = styled.strong`
  color: ${({ $negative }) => ($negative ? colors.danger : "inherit")};
`;
const DistributionTable = styled.table`
  min-width: max(560px, 100%);
  th:nth-child(3),
  td:nth-child(3) {
    border-left: 1px solid ${({ $separatorColor }) => $separatorColor};
    padding-left: 22px;
  }
  small {
    display: block;
    font-size: 11px;
    color: ${colors.textMuted};
    margin-top: 4px;
    white-space: normal;
    max-width: 200px;
  }
  th:not(:first-child),
  td {
    min-width: 130px;
  }
`;
