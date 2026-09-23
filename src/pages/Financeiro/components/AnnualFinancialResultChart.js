import React, { useId } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";

const MONTH_LABELS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

const CHART_WIDTH = 1080;
const CHART_HEIGHT = 300;
const PLOT_TOP = 34;
const PLOT_RIGHT = 18;
const PLOT_BOTTOM = 48;
const PLOT_LEFT = 18;

export default function AnnualFinancialResultChart({
  months,
  valuesVisible,
  formatCurrency,
  palette,
}) {
  const descriptionId = useId();

  if (!valuesVisible) {
    return (
      <HiddenChartState
        role="status"
        $background={palette.surfaceMuted}
        $border={palette.borderStrong}
        $color={palette.textTertiary}
      >
        Mostre os valores financeiros para visualizar o gráfico.
      </HiddenChartState>
    );
  }

  const accountValues = months.map((item) => item.periodResult);
  const scaleValues = accountValues.length ? accountValues : [0];
  const allZero = accountValues.length > 0 && accountValues.every((value) => value === 0);
  const rawMinimum = Math.min(0, ...scaleValues);
  const rawMaximum = Math.max(0, ...scaleValues);
  const range = rawMaximum - rawMinimum;
  const padding = range > 0 ? range * 0.08 : 1;
  const domainMinimum = rawMinimum < 0 ? rawMinimum - padding : 0;
  const domainMaximum = rawMaximum > 0 ? rawMaximum + padding : 0;
  const safeMinimum = allZero ? -1 : domainMinimum;
  const safeMaximum = allZero ? 1 : domainMaximum;
  const plotWidth = CHART_WIDTH - PLOT_LEFT - PLOT_RIGHT;
  const plotHeight = CHART_HEIGHT - PLOT_TOP - PLOT_BOTTOM;
  const slotWidth = plotWidth / months.length;
  const barWidth = Math.min(34, slotWidth * 0.58);
  const toY = (value) => (
    PLOT_TOP + ((safeMaximum - value) / (safeMaximum - safeMinimum)) * plotHeight
  );
  const zeroY = toY(0);

  return (
    <ChartFigure>
      <ChartScroll aria-label="Gráfico do saldo das contas">
        <ChartSvg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          role="img"
          aria-label="Saldo das contas por mês"
          aria-describedby={descriptionId}
          preserveAspectRatio="xMidYMid meet"
        >
          <title>Saldo das contas por mês</title>
          <desc id={descriptionId}>
            Gráfico de barras de janeiro a dezembro. Valores positivos ficam acima da linha zero
            e valores negativos ficam abaixo. Inclui as contas de meses futuros.
            A tabela seguinte apresenta os valores exatos.
          </desc>
          <ZeroLine
            x1={PLOT_LEFT}
            x2={CHART_WIDTH - PLOT_RIGHT}
            y1={zeroY}
            y2={zeroY}
            $stroke={palette.borderStrong}
          />
          {months.map((item, index) => {
            const value = item.periodResult;
            const x = PLOT_LEFT + index * slotWidth + (slotWidth - barWidth) / 2;

            const formattedValue = formatCurrency(value);
            const valueY = toY(value);
            const height = Math.abs(zeroY - valueY);
            const y = value >= 0 ? valueY : zeroY;
            const labelY = value < 0
              ? Math.min(CHART_HEIGHT - PLOT_BOTTOM - 2, valueY + 15)
              : Math.max(14, valueY - 8);
            let sign = "zero";
            if (value < 0) sign = "negative";
            if (value > 0) sign = "positive";

            return (
              <g
                key={item.month}
                data-month={item.month}
                data-period-result={value}
                data-current-month={item.isCurrent ? "true" : undefined}
              >
                <title>{`${MONTH_LABELS[index]}: ${formattedValue}`}</title>
                <ResultBar
                  x={x}
                  y={y}
                  width={barWidth}
                  height={height}
                  rx="4"
                  data-sign={sign}
                  data-month={item.month}
                  data-value-cents={value}
                  $fill={value < 0 ? palette.dangerAccent : palette.action}
                />
                <ValueLabel
                  x={x + barWidth / 2}
                  y={labelY}
                  textAnchor="middle"
                  data-month={item.month}
                  data-value-cents={value}
                  $fill={palette.textSecondary}
                >
                  {formattedValue}
                </ValueLabel>
                <MonthLabel
                  x={x + barWidth / 2}
                  y={item.isCurrent ? CHART_HEIGHT - 18 : CHART_HEIGHT - 12}
                  textAnchor="middle"
                  $current={item.isCurrent}
                  $fill={palette.textTertiary}
                >
                  {MONTH_LABELS[index]}
                </MonthLabel>
                {item.isCurrent ? (
                  <>
                    <CurrentMonthMarkerBackground
                      x={x + barWidth / 2 - 21}
                      y={CHART_HEIGHT - 15}
                      width="42"
                      height="13"
                      rx="6.5"
                      aria-hidden="true"
                      data-current-axis-marker="true"
                      $fill={palette.actionSoft}
                      $stroke={palette.actionBorder}
                    />
                    <CurrentMonthMarker
                      x={x + barWidth / 2}
                      y={CHART_HEIGHT - 5}
                      textAnchor="middle"
                      $fill={palette.textSecondary}
                    >
                      Atual
                    </CurrentMonthMarker>
                  </>
                ) : null}
              </g>
            );
          })}
        </ChartSvg>
      </ChartScroll>
      {allZero ? (
        <ZeroResultNote $color={palette.textTertiary}>
          O saldo das contas é R$ 0,00 em todos os meses.
        </ZeroResultNote>
      ) : null}
    </ChartFigure>
  );
}

AnnualFinancialResultChart.propTypes = {
  months: PropTypes.arrayOf(PropTypes.shape({
    month: PropTypes.string.isRequired,
    periodResult: PropTypes.number.isRequired,
    isCurrent: PropTypes.bool,
  })).isRequired,
  valuesVisible: PropTypes.bool.isRequired,
  formatCurrency: PropTypes.func.isRequired,
  palette: PropTypes.shape({
    action: PropTypes.string.isRequired,
    actionBorder: PropTypes.string.isRequired,
    actionSoft: PropTypes.string.isRequired,
    borderStrong: PropTypes.string.isRequired,
    dangerAccent: PropTypes.string.isRequired,
    surfaceMuted: PropTypes.string.isRequired,
    textSecondary: PropTypes.string.isRequired,
    textTertiary: PropTypes.string.isRequired,
  }).isRequired,
};

const ChartFigure = styled.figure`
  margin: 0;
`;

const ChartScroll = styled.div`
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
`;

const ChartSvg = styled.svg`
  display: block;
  width: 100%;
  min-width: 900px;
  height: 300px;
`;

const ZeroLine = styled.line`
  stroke: ${(props) => props.$stroke};
  stroke-width: 1.5;
  stroke-dasharray: 4 4;
`;

const CurrentMonthMarkerBackground = styled.rect`
  fill: ${(props) => props.$fill};
  stroke: ${(props) => props.$stroke};
  stroke-width: 1;
`;

const ResultBar = styled.rect`
  fill: ${(props) => props.$fill};
`;

const ValueLabel = styled.text`
  fill: ${(props) => props.$fill};
  font-family: inherit;
  font-size: 10px;
  font-weight: 600;
  pointer-events: none;
`;

const MonthLabel = styled.text`
  fill: ${(props) => props.$fill};
  font-family: inherit;
  font-size: 12px;
  font-weight: ${(props) => (props.$current ? 700 : 600)};
`;

const CurrentMonthMarker = styled.text`
  fill: ${(props) => props.$fill};
  font-family: inherit;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
`;

const HiddenChartState = styled.div`
  display: grid;
  min-height: 180px;
  place-items: center;
  padding: 24px;
  border: 1px dashed ${(props) => props.$border};
  border-radius: 14px;
  background: ${(props) => props.$background};
  color: ${(props) => props.$color};
  font-size: 13px;
  text-align: center;
`;

const ZeroResultNote = styled.p`
  margin: 8px 0 0;
  color: ${(props) => props.$color};
  font-size: 12px;
  text-align: center;
`;
