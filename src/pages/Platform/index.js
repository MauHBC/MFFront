import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { FaArrowRight, FaBuilding, FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";
import { PageContent, PageWrapper } from "../../components/AppLayout";
import { DataTable, TableWrap, TD, TH } from "../../components/AppTable";
import { LinkGhostButton } from "../../components/AppButton";
import DataLoadingState from "../../components/DataLoadingState";
import { usePlatformAdmin } from "../../hooks/usePlatformAdmin";
import axios from "../../services/axios";

const readinessTone = {
  PASS: "pass",
  WARN: "warn",
  FAIL: "fail",
};

const readinessLabel = {
  PASS: "Pronto",
  WARN: "Atenção",
  FAIL: "Corrigir",
};

const flagLabels = {
  has_branding: "Marca",
  has_published_public_profile: "Página pública",
  has_admin: "Admin",
  has_verified_domain: "Domínio",
};

function getPendingLabels(flags = {}) {
  return Object.entries(flagLabels)
    .filter(([key]) => !flags[key])
    .map(([, label]) => label);
}

function ReadinessBadge({ status }) {
  return (
    <Badge $tone={readinessTone[status] || "neutral"}>
      {readinessLabel[status] || "-"}
    </Badge>
  );
}

ReadinessBadge.propTypes = {
  status: PropTypes.string.isRequired,
};

function FlagBadge({ active, children }) {
  return (
    <Flag $active={active}>
      {active ? <FaCheckCircle /> : <FaExclamationTriangle />}
      <span>{children}</span>
    </Flag>
  );
}

FlagBadge.propTypes = {
  active: PropTypes.bool,
  children: PropTypes.node.isRequired,
};

FlagBadge.defaultProps = {
  active: false,
};

export default function Platform() {
  const { isLoading: isCheckingAdmin, isPlatformAdmin, checked } = usePlatformAdmin();
  const [clinics, setClinics] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadClinics() {
      if (!isPlatformAdmin) return;

      setIsLoading(true);
      setError("");

      try {
        const response = await axios.get("/platform/clinics");
        if (!isMounted) return;
        setClinics(Array.isArray(response.data) ? response.data : []);
      } catch (requestError) {
        if (!isMounted) return;
        setError("Não foi possível carregar o painel SaaS.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadClinics();

    return () => {
      isMounted = false;
    };
  }, [isPlatformAdmin]);

  if (isCheckingAdmin || !checked) {
    return (
      <PageWrapper>
        <PageContent>
          <DataLoadingState />
        </PageContent>
      </PageWrapper>
    );
  }

  if (!isPlatformAdmin) {
    return (
      <PageWrapper>
        <PageContent>
          <DataLoadingState tone="error" text="Acesso restrito ao administrador da plataforma." />
        </PageContent>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper $background="#f5f7fb">
      <PageContent $maxWidth="1180px">
        <Header>
          <div>
            <Eyebrow>Administração interna da plataforma</Eyebrow>
            <h1>Painel SaaS</h1>
            <Intro>Aqui você gerencia todas as clínicas cadastradas no sistema.</Intro>
          </div>
        </Header>

        <PanelNote>
          Este painel mostra todas as clínicas cadastradas na plataforma. O acesso é exclusivo
          para administradores internos do SaaS.
        </PanelNote>

        {isLoading && <DataLoadingState />}
        {error && <DataLoadingState tone="error" text={error} />}
        {!isLoading && !error && clinics.length === 0 && (
          <DataLoadingState tone="empty" text="Nenhuma clínica encontrada." />
        )}

        {!isLoading && !error && clinics.length > 0 && (
          <>
            <Legend>
              <LegendItem $tone="pass"><strong>Pronto</strong><span>clínica pronta para operar</span></LegendItem>
              <LegendItem $tone="warn"><strong>Atenção</strong><span>funciona, mas possui pendências não bloqueantes</span></LegendItem>
              <LegendItem $tone="fail"><strong>Corrigir</strong><span>possui pendências importantes</span></LegendItem>
            </Legend>
            <PlatformTableWrap>
              <DataTable>
                <thead>
                  <tr>
                    <TH>Clínica</TH>
                    <TH>Domínio principal</TH>
                    <TH>Status</TH>
                    <TH>Pendências</TH>
                    <TH>Ativa/Inativa</TH>
                    <TH />
                  </tr>
                </thead>
                <tbody>
                  {clinics.map((clinic) => (
                    <tr key={clinic.id}>
                      <TD>
                        <ClinicName>
                          <FaBuilding />
                          <span>
                            <strong>{clinic.public_name || clinic.name}</strong>
                            <small>{clinic.city || "-"} / {clinic.state || "-"}</small>
                          </span>
                        </ClinicName>
                      </TD>
                      <TD>{clinic.primary_domain || "-"}</TD>
                      <TD><ReadinessBadge status={clinic.readiness_status} /></TD>
                      <TD>
                        {getPendingLabels(clinic.flags).length === 0 ? (
                          <NoPending>Nenhuma</NoPending>
                        ) : (
                          <Flags>
                            {getPendingLabels(clinic.flags).map((label) => (
                              <FlagBadge key={label} active={false}>{label}</FlagBadge>
                            ))}
                          </Flags>
                        )}
                      </TD>
                      <TD>{clinic.is_active ? "Ativa" : "Inativa"}</TD>
                      <TD>
                        <ActionLink to={`/platform/clinics/${clinic.id}`}>
                          Ver detalhes <FaArrowRight />
                        </ActionLink>
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </PlatformTableWrap>
          </>
        )}
      </PageContent>
    </PageWrapper>
  );
}

const Header = styled.header`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
  font-family: Inter, Roboto, "Nunito Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;

  h1 {
    margin: 6px 0 0;
    font-size: clamp(1.85rem, 3vw, 2.35rem);
    color: #111827;
    letter-spacing: 0;
    line-height: 1.05;
  }
`;

const Intro = styled.p`
  max-width: 680px;
  margin: 10px 0 0;
  color: #64748b;
  font-size: 1rem;
  line-height: 1.55;
`;

const PanelNote = styled.div`
  margin: 0 0 18px;
  padding: 14px 16px;
  border-radius: 14px;
  background: #ffffff;
  border: 1px solid rgba(148, 163, 184, 0.22);
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.05);
  color: #475569;
  font-family: Inter, Roboto, "Nunito Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 0.94rem;
  font-weight: 650;
`;

const Legend = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
  font-family: Inter, Roboto, "Nunito Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
`;

const LegendItem = styled.div`
  display: grid;
  gap: 3px;
  min-width: 210px;
  border-left: 3px solid ${({ $tone }) => {
    if ($tone === "pass") return "#2f7d4d";
    if ($tone === "warn") return "#d39b12";
    return "#c74343";
  }};
  border-radius: 12px;
  background: #fff;
  padding: 11px 13px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.045);
  border-top: 1px solid rgba(148, 163, 184, 0.16);
  border-right: 1px solid rgba(148, 163, 184, 0.16);
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);

  strong {
    color: #1f2937;
    font-size: 0.86rem;
  }

  span {
    color: #64748b;
    font-size: 0.8rem;
  }
`;

const Eyebrow = styled.span`
  display: block;
  color: #2563eb;
  font-size: 0.76rem;
  font-weight: 850;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border-radius: 999px;
  padding: 5px 9px;
  font-size: 0.74rem;
  font-weight: 800;
  color: ${({ $tone }) => {
    if ($tone === "pass") return "#1f6b3a";
    if ($tone === "warn") return "#875b00";
    if ($tone === "fail") return "#9a2f2f";
    return "#53605a";
  }};
  background: ${({ $tone }) => {
    if ($tone === "pass") return "#e6f4ea";
    if ($tone === "warn") return "#fff2cc";
    if ($tone === "fail") return "#fbe4e4";
    return "#eef1ef";
  }};
  border: 1px solid rgba(255, 255, 255, 0.55);
`;

const ClinicName = styled.div`
  display: flex;
  align-items: center;
  gap: 11px;

  svg {
    color: #2563eb;
  }

  span {
    display: grid;
    gap: 3px;
  }

  small {
    color: #64748b;
    font-size: 0.8rem;
  }
`;

const Flags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const Flag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 8px;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 700;
  color: ${({ $active }) => ($active ? "#166534" : "#92400e")};
  background: ${({ $active }) => ($active ? "#dcfce7" : "#fef3c7")};

  svg {
    width: 12px;
    height: 12px;
  }
`;

const NoPending = styled.span`
  color: #166534;
  font-size: 0.82rem;
  font-weight: 800;
`;

const ActionLink = styled(LinkGhostButton)`
  gap: 7px;
  padding: 8px 13px;
  border-radius: 10px;
  color: #2563eb;
  border-color: rgba(37, 99, 235, 0.22);
  box-shadow: 0 6px 16px rgba(37, 99, 235, 0.08);
`;

const PlatformTableWrap = styled(TableWrap)`
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  box-shadow: 0 16px 38px rgba(15, 23, 42, 0.055);
  font-family: Inter, Roboto, "Nunito Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;

  table {
    min-width: 840px;
  }

  th {
    background: #f8fafc;
    color: #64748b;
    font-size: 0.72rem;
    letter-spacing: 0.06em;
  }

  td {
    color: #334155;
    border-bottom-color: rgba(148, 163, 184, 0.16);
  }

  tbody tr {
    transition: background 0.14s ease;
  }

  tbody tr:hover {
    background: #f8fbff;
  }
`;
