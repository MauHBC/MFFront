import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useHistory, useLocation, useParams } from "react-router-dom";
import styled from "styled-components";
import { toast } from "react-toastify";

import axios from "../../services/axios";
import DataLoadingState from "../../components/DataLoadingState";
import { listPatientClinicalCases } from "../../services/patientClinicalCases";
import { PageWrapper, PageContent } from "../../components/AppLayout";
import { LinkGhostButton, PrimaryButton } from "../../components/AppButton";
import {
  ModuleHeader,
  ModuleTitle,
  ModuleSubtitle,
} from "../../components/AppModuleShell";

const normalizeLabel = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const resolveText = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const pickFirstText = (answers, keys) => {
  return keys.reduce((acc, key) => {
    if (acc) return acc;
    return resolveText(answers[key]) || null;
  }, null);
};

const resolveSummary = (definition, answers) => {
  const summary = pickFirstText(answers, [
    "conclusion_summary",
    "conclusion_notes",
  ]);
  const plan = pickFirstText(answers, [
    "conclusion_plan",
    "conclusion_hypothesis",
    "conclusion_notes",
  ]);

  if (summary || plan || !definition?.sections) {
    return {
      summary_text: summary,
      plan_text: plan,
    };
  }

  const conclusionSection = definition.sections.find((section) => {
    const id = normalizeLabel(section.id);
    const title = normalizeLabel(section.title);
    return id.includes("conclusion") || title.includes("conclus");
  });

  if (!conclusionSection) {
    return { summary_text: summary, plan_text: plan };
  }

  let summaryText = summary;
  let planText = plan;
  let notesText = null;

  conclusionSection.blocks.forEach((block) => {
    const blockId = normalizeLabel(block.id);
    const label = normalizeLabel(block.label);
    const value = resolveText(answers[block.id]);

    if (!value) return;

    if (!summaryText && (blockId.includes("summary") || label.includes("resumo"))) {
      summaryText = value;
      return;
    }

    if (
      !planText &&
      (blockId.includes("plan") ||
        label.includes("plano") ||
        label.includes("conduta"))
    ) {
      planText = value;
      return;
    }

    if (!notesText && (blockId.includes("notes") || label.includes("observac"))) {
      notesText = value;
    }
  });

  if (!summaryText && notesText) summaryText = notesText;
  if (!planText && notesText) planText = notesText;

  return {
    summary_text: summaryText,
    plan_text: planText,
  };
};

const resolveYesNo = (value) => {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "";
};

const needsSingleInputLabel = (blockType) =>
  ["text", "textarea", "date", "yesno", "single_select"].includes(blockType);

const buildInputId = (block) => `field-${block.id}`;

const isFullWidthBlock = (block) =>
  ["matrix", "table", "info"].includes(block?.type);

const hiddenHelpTexts = new Set([
  "Frase curta integrando história + exame.",
  "Objetivos e abordagem inicial.",
]);

const shouldShowHelpText = (helpText) =>
  Boolean(helpText) && !hiddenHelpTexts.has(helpText);

const evaluationFormId = "patient-evaluation-form";

const buildFieldClassName = (block, { isConclusion = false } = {}) => {
  const classes = [];

  if (isFullWidthBlock(block)) {
    classes.push("span-full");
  } else if (block.type === "textarea" && !isConclusion) {
    classes.push("span-full");
  }

  if (isConclusion) {
    classes.push("conclusion-field");
  }

  return classes.join(" ");
};

export default function PatientEvaluationNew() {
  const { id: patientId } = useParams();
  const history = useHistory();
  const location = useLocation();
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const requestedPhase = queryParams.get("phase") === "reassessment"
    ? "reassessment"
    : null;
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [clinicalCases, setClinicalCases] = useState([]);
  const [selectedClinicalCaseId, setSelectedClinicalCaseId] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [definition, setDefinition] = useState(null);
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    async function loadTemplates() {
      setIsLoading(true);
      setLoadError("");
      try {
        const response = await axios.get("/form-templates");
        const list = Array.isArray(response.data) ? response.data : [];
        setTemplates(list.filter((tpl) => tpl.is_active));
      } catch (error) {
        const message =
          error?.response?.data?.error ||
          "Não foi possível carregar os formulários.";
        setLoadError(message);
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    }

    loadTemplates();
  }, []);

  useEffect(() => {
    async function loadClinicalCases() {
      if (!patientId) return;
      try {
        const response = await listPatientClinicalCases({ patient_id: patientId });
        const activeCases = Array.isArray(response.data)
          ? response.data.filter((item) => item.status === "active")
          : [];
        setClinicalCases(activeCases);

	        const requestedCaseId = queryParams.get("case");
        if (
          requestedCaseId &&
          activeCases.some((item) => String(item.id) === String(requestedCaseId))
        ) {
          setSelectedClinicalCaseId(String(requestedCaseId));
        }
      } catch (error) {
        toast.error(
          error?.response?.data?.error ||
            "Não foi possível carregar os casos clínicos.",
        );
      }
    }

    loadClinicalCases();
	  }, [patientId, queryParams]);

  useEffect(() => {
    async function loadDefinition() {
      if (!selectedTemplate?.code) return;
      setIsLoading(true);
      setLoadError("");
      try {
        const response = await axios.get(
          `/form-templates/${selectedTemplate.code}/definition`,
        );
        setDefinition(response.data);
        setAnswers({});
        setActiveSectionId(null);
      } catch (error) {
        const message =
          error?.response?.data?.error ||
          "Não foi possível carregar o formulário.";
        setLoadError(message);
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    }

    loadDefinition();
  }, [selectedTemplate]);

  const orderedSections = useMemo(() => {
    if (!definition?.sections) return [];
    return [...definition.sections].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [definition]);

  const conclusionSection = useMemo(() => {
    if (!orderedSections.length) return null;
    return (
      orderedSections.find((section) => {
        const id = normalizeLabel(section.id);
        const title = normalizeLabel(section.title);
        return id.includes("conclusion") || title.includes("conclus");
      }) || null
    );
  }, [orderedSections]);

  const activeSection = useMemo(() => {
    if (!orderedSections.length) return null;
    if (!activeSectionId) return orderedSections[0];
    return (
      orderedSections.find((section) => section.id === activeSectionId) ||
      orderedSections[0]
    );
  }, [activeSectionId, orderedSections]);
  const selectedClinicalCaseTitle = useMemo(() => {
    if (!selectedClinicalCaseId) return "";
    const clinicalCase = clinicalCases.find(
      (item) => String(item.id) === String(selectedClinicalCaseId),
    );
    return clinicalCase?.title || "";
  }, [clinicalCases, selectedClinicalCaseId]);

  const isActiveConclusionSection = Boolean(
    activeSection &&
      conclusionSection &&
      activeSection.id === conclusionSection.id,
  );

  const handleChange = useCallback((block, value) => {
    setAnswers((prev) => ({ ...prev, [block.id]: value }));
  }, []);

  const handleMatrixChange = useCallback((block, rowId, key, value) => {
    setAnswers((prev) => {
      const current = prev[block.id] || {};
      const row = current[rowId] || {};
      return {
        ...prev,
        [block.id]: {
          ...current,
          [rowId]: { ...row, [key]: value },
        },
      };
    });
  }, []);

  const renderBlockInput = (block, baseId) => {
    const fieldId = baseId || buildInputId(block);
    const labelId = `${fieldId}-label`;
    if (block.type === "text") {
      return (
        <input
          id={fieldId}
          aria-labelledby={labelId}
          type="text"
          value={answers[block.id] || ""}
          onChange={(event) => handleChange(block, event.target.value)}
        />
      );
    }

    if (block.type === "textarea") {
      return (
        <textarea
          id={fieldId}
          aria-labelledby={labelId}
          rows={block.config?.minLines || 3}
          value={answers[block.id] || ""}
          onChange={(event) => handleChange(block, event.target.value)}
        />
      );
    }

    if (block.type === "date") {
      return (
        <input
          id={fieldId}
          aria-labelledby={labelId}
          type="date"
          value={answers[block.id] || ""}
          onChange={(event) => handleChange(block, event.target.value)}
        />
      );
    }

    if (block.type === "yesno") {
      return (
        <select
          id={fieldId}
          aria-labelledby={labelId}
          value={resolveYesNo(answers[block.id])}
          onChange={(event) => handleChange(block, event.target.value === "yes")}
        >
          <option value="">Selecionar</option>
          <option value="yes">Sim</option>
          <option value="no">Nao</option>
        </select>
      );
    }

    if (block.type === "single_select") {
      return (
        <select
          id={fieldId}
          aria-labelledby={labelId}
          value={answers[block.id] || ""}
          onChange={(event) => {
            const { value } = event.target;
            handleChange(block, value ? Number(value) : "");
          }}
        >
          <option value="">Selecionar</option>
          {block.config?.options?.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    if (block.type === "multi_select") {
      return (
        <MultiList>
          {block.config?.options?.map((opt) => {
            const current = answers[block.id] || [];
            const checked = current.includes(opt.id);
            const optionInputId = `${fieldId}-${opt.id}`;
            return (
              <label key={opt.id} htmlFor={optionInputId}>
                <input
                  id={optionInputId}
                  type="checkbox"
                  checked={checked}
                  aria-label={opt.label}
                  onChange={(event) => {
                    if (event.target.checked) {
                      handleChange(block, [...current, opt.id]);
                    } else {
                      handleChange(
                        block,
                        current.filter((id) => id !== opt.id),
                      );
                    }
                  }}
                />
                {opt.label}
              </label>
            );
          })}
        </MultiList>
      );
    }

    if (block.type === "matrix") {
      return (
        <MatrixWrap>
          <MatrixTable>
            <thead>
              <tr>
                <th scope="col">Item</th>
                {block.config?.choices?.map((choice) => (
                  <th key={choice.value}>{choice.label}</th>
                ))}
                <th>{block.config?.boolLabel || "Dor"}</th>
              </tr>
            </thead>
            <tbody>
              {block.config?.rows?.map((row) => {
                const current = answers[block.id] || {};
                const rowValue = current[row.id] || {};
                return (
                  <tr key={row.id}>
                    <td>{row.label}</td>
                    {block.config?.choices?.map((choice) => (
                      <td key={choice.value}>
                        <input
                          type="radio"
                          name={`${fieldId}-${row.id}`}
                          aria-label={`${row.label} ${choice.label}`}
                          checked={rowValue[block.config?.choiceKey] === choice.value}
                          onChange={() =>
                            handleMatrixChange(
                              block,
                              row.id,
                              block.config?.choiceKey,
                              choice.value,
                            )
                          }
                        />
                      </td>
                    ))}
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`${row.label} ${block.config?.boolLabel || "Dor"}`}
                        checked={Boolean(rowValue[block.config?.boolKey])}
                        onChange={(event) =>
                          handleMatrixChange(
                            block,
                            row.id,
                            block.config?.boolKey,
                            event.target.checked,
                          )
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </MatrixTable>
        </MatrixWrap>
      );
    }

    if (block.type === "info") {
      return <InfoBox>{block.config?.text || block.helpText}</InfoBox>;
    }

    return null;
  };

  const validateRequired = useCallback(() => {
    if (!definition) return true;
    let missingLabel = null;
    orderedSections.some((section) =>
      section.blocks.some((block) => {
        if (!block.required) return false;
        const value = answers[block.id];
        const isEmpty =
          value === undefined ||
          value === null ||
          value === "" ||
          (Array.isArray(value) && value.length === 0);
        if (isEmpty) {
          missingLabel = block.label;
          return true;
        }
        return false;
      }),
    );
    if (missingLabel) {
      toast.error(`Preencha: ${missingLabel}`);
      return false;
    }
    return true;
  }, [answers, definition, orderedSections]);

  const buildAnswersPayload = useCallback(() => {
    if (!definition) return [];
    const payloads = [];
    orderedSections.forEach((section) => {
      section.blocks.forEach((block) => {
        const questionId = block.config?.questionId;
        if (!questionId) return;

        const value = answers[block.id];
        if (value === undefined || value === null || value === "") return;

        switch (block.type) {
          case "text":
          case "textarea":
            payloads.push({
              form_question_id: questionId,
              value_text: String(value),
            });
            break;
          case "date":
            payloads.push({
              form_question_id: questionId,
              value_date: value,
            });
            break;
          case "yesno":
            payloads.push({
              form_question_id: questionId,
              value_bool: Boolean(value),
            });
            break;
          case "single_select":
            payloads.push({
              form_question_id: questionId,
              option_id: value,
            });
            break;
          case "multi_select":
            payloads.push({
              form_question_id: questionId,
              value_json: value,
            });
            break;
          case "matrix":
            payloads.push({
              form_question_id: questionId,
              value_json: value,
            });
            break;
          default:
            break;
        }
      });
    });
    return payloads;
  }, [answers, definition, orderedSections]);

	  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (!selectedTemplate?.id) {
        toast.error("Selecione um formulario.");
        return;
      }
      if (!validateRequired()) return;

      setIsSaving(true);
      try {
        const summary = resolveSummary(definition, answers);
	        const evaluationResponse = await axios.post("/evaluations", {
	          patient_id: Number(patientId),
	          clinical_case_id: selectedClinicalCaseId
	            ? Number(selectedClinicalCaseId)
	            : null,
	          evaluation_phase: requestedPhase,
	          status: "done",
	          summary_text: summary.summary_text,
	          plan_text: summary.plan_text,
	        });
        const evaluationId = evaluationResponse.data?.id;
        const instanceResponse = await axios.post("/form-instances", {
          evaluation_id: evaluationId,
          form_template_id: definition.templateId,
        });
        const instanceId = instanceResponse.data?.id;

        const answerPayloads = buildAnswersPayload();
        await Promise.all(
          answerPayloads.map((payload) =>
            axios.post("/form-answers", {
              ...payload,
              form_instance_id: instanceId,
            }),
          ),
        );

        toast.success("Formulario enviado com sucesso.");
        history.push(`/pacientes/${patientId}`);
      } catch (error) {
        const message =
          error?.response?.data?.error || "Não foi possível salvar o formulário.";
        toast.error(message);
      } finally {
        setIsSaving(false);
      }
    },
    [
      answers,
      buildAnswersPayload,
	      definition,
	      history,
	      patientId,
	      requestedPhase,
	      selectedTemplate,
	      selectedClinicalCaseId,
	      validateRequired,
    ],
	  );

  const headerTitle = useMemo(() => {
    const baseTitle = requestedPhase ? "Reavaliação" : "Novo registro";
    return selectedTemplate ? `${baseTitle} - ${selectedTemplate.title}` : baseTitle;
  }, [requestedPhase, selectedTemplate]);

	  return (
    <PageWrapper $paddingTop="90px" $paddingBottom="60px">
      <PageContent
        $maxWidth="1220px"
        $paddingTop="0"
        $paddingX="30px"
        $paddingBottom="0"
        $mobileBreakpoint="859px"
        $mobilePaddingX="15px"
        $mobilePaddingTop="0"
        $mobilePaddingBottom="0"
      >
        <Header>
	          <div>
	            <HeaderTitle>{headerTitle}</HeaderTitle>
            {!selectedTemplate && (
              <HeaderSubtitle>Selecione um formulario e preencha.</HeaderSubtitle>
            )}
          </div>
        </Header>

        {selectedTemplate && definition && (
          <HeaderActions>
            {selectedClinicalCaseId && (
              <CaseContextTitle>
                Caso clínico - {selectedClinicalCaseTitle || "Caso selecionado"}
              </CaseContextTitle>
            )}
            <ActionButtonGroup>
              <CancelButton
                to={`/pacientes/${patientId}`}
                aria-disabled={isSaving}
                onClick={(event) => {
                  if (isSaving) event.preventDefault();
                }}
              >
                Cancelar
              </CancelButton>
              <SubmitButton
                type="submit"
                form={evaluationFormId}
                disabled={isSaving}
              >
                {isSaving ? <ButtonSpinner /> : "Finalizar"}
              </SubmitButton>
            </ActionButtonGroup>
          </HeaderActions>
        )}

        {isLoading && (
          <SectionCard>
            <DataLoadingState text="Carregando formulários..." />
          </SectionCard>
        )}

        {!isLoading && loadError && (
          <SectionCard>
            <EmptyState>{loadError}</EmptyState>
          </SectionCard>
        )}

        {!isLoading && !loadError && !selectedTemplate && templates.length === 0 && (
          <SectionCard>
            <EmptyState>Nenhum formulário ativo disponível para o seu usuário.</EmptyState>
          </SectionCard>
        )}

        {!isLoading && !loadError && !selectedTemplate && templates.length > 0 && (
          <TemplatesGrid>
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                type="button"
                onClick={() => setSelectedTemplate(template)}
	              >
	                <h3>{template.title}</h3>
	              </TemplateCard>
            ))}
          </TemplatesGrid>
        )}

        {!isLoading && selectedTemplate && definition && (
          <Form id={evaluationFormId} onSubmit={handleSubmit}>
            {orderedSections.length === 0 && (
              <SectionCard>
                <EmptyState>Este formulário não possui seções.</EmptyState>
              </SectionCard>
            )}

            {orderedSections.length > 0 && activeSection && (
              <EvaluationLayout>
                <SectionSidebar aria-label="Seções do formulário">
                  {orderedSections.map((section) => (
                    <SectionMenuButton
                      key={section.id}
                      type="button"
                      className={section.id === activeSection.id ? "active" : ""}
                      onClick={() => setActiveSectionId(section.id)}
                    >
                      <span>{section.title}</span>
                      <small>{section.blocks?.length || 0} campos</small>
                    </SectionMenuButton>
                  ))}
                </SectionSidebar>

                <SectionPanel>
                  <SectionNav>
                    <SectionTitle>{activeSection.title}</SectionTitle>
                  </SectionNav>

                  <SectionCard>
                    <SectionGrid
                      className={isActiveConclusionSection ? "conclusion-grid" : ""}
                    >
                      {activeSection.blocks.map((block) => {
                        const fieldId = buildInputId(block);
                        const labelId = `${fieldId}-label`;
                        const isSingleInput = needsSingleInputLabel(block.type);
                        return (
                          <Field
                            key={block.id}
                            className={buildFieldClassName(block, {
                              isConclusion: isActiveConclusionSection,
                            })}
                          >
                            {isSingleInput ? (
                              <FieldLabel htmlFor={fieldId} id={labelId}>
                                {block.label}
                                {block.required ? " *" : ""}
                              </FieldLabel>
                            ) : (
                              <FieldLabel as="div" id={labelId}>
                                {block.label}
                                {block.required ? " *" : ""}
                              </FieldLabel>
                            )}
                            {shouldShowHelpText(block.helpText) && (
                              <small>{block.helpText}</small>
                            )}
                            {renderBlockInput(block, fieldId)}
                          </Field>
                        );
                      })}
                    </SectionGrid>
                  </SectionCard>
                </SectionPanel>
              </EvaluationLayout>
            )}

          </Form>
        )}
      </PageContent>
    </PageWrapper>
  );
}

const Header = styled(ModuleHeader)`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 8px;

  @media (max-width: 720px) {
    flex-direction: column;
  }
`;

const HeaderTitle = styled(ModuleTitle)`
  margin-bottom: 6px;
`;

const HeaderSubtitle = styled(ModuleSubtitle)`
  margin-top: 0;
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;

  @media (max-width: 720px) {
    align-items: flex-start;
    flex-direction: column;
  }
`;

const CaseContextTitle = styled.h2`
  margin: 0;
  color: #1b1b1b;
  font-size: 1rem;
  line-height: 1.25;
`;

const ActionButtonGroup = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
  margin-left: auto;

  @media (max-width: 720px) {
    justify-content: flex-start;
    margin-left: 0;
  }
`;

const TemplatesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
`;

const TemplateCard = styled.button`
  border: 1px solid rgba(106, 121, 92, 0.2);
  border-radius: 14px;
  padding: 18px;
  background: #fff;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.05);

  h3 {
    margin: 0 0 6px;
  }

  span {
    color: #6a795c;
    font-size: 0.85rem;
  }
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
`;

const EvaluationLayout = styled.div`
  display: grid;
  grid-template-columns: minmax(180px, 240px) minmax(0, 1fr);
  align-items: start;
  gap: 18px;
  min-width: 0;

  @media (max-width: 860px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const SectionSidebar = styled.nav`
  position: sticky;
  top: 92px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  max-height: calc(100vh - 140px);
  overflow-y: auto;

  @media (max-width: 860px) {
    position: static;
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
    max-height: none;
    padding-bottom: 4px;
  }
`;

const SectionMenuButton = styled.button`
  width: 100%;
  min-width: 0;
  border: 1px solid rgba(106, 121, 92, 0.18);
  border-radius: 12px;
  background: #fff;
  color: #1b1b1b;
  cursor: pointer;
  padding: 12px 14px;
  text-align: left;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.04);
  transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease;

  span,
  small {
    display: block;
  }

  span {
    color: #1b1b1b;
    font-weight: 800;
  }

  small {
    margin-top: 4px;
    color: #6a795c;
    font-size: 0.78rem;
  }

  &.active {
    border-color: rgba(106, 121, 92, 0.55);
    background: #f7f9f4;
    color: #3f4d37;
  }

  @media (max-width: 860px) {
    flex: 0 0 160px;
  }
`;

const SectionPanel = styled.div`
  min-width: 0;
`;

const SectionCard = styled.div`
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(106, 121, 92, 0.18);
  padding: 18px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.06);
  min-width: 0;
`;

const SectionNav = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
  flex-wrap: wrap;

  h2 {
    margin-bottom: 0;
  }
`;

const SectionTitle = styled.h2`
  margin: 0 0 12px;
  color: #1b1b1b;
`;

const SectionGrid = styled.div`
  display: grid;
  width: 100%;
  min-width: 0;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;

  &.conclusion-grid {
    align-items: start;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 780px) {
    grid-template-columns: minmax(0, 1fr);

    &.conclusion-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 0.9rem;
  color: #1b1b1b;
  width: 100%;
  min-width: 0;
  max-width: 100%;

  &.span-full {
    grid-column: 1 / -1;
  }

  small {
    color: #6a795c;
    line-height: 1.35;
  }

  input,
  select,
  textarea {
    width: 100%;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
    border-radius: 10px;
    border: 1px solid rgba(106, 121, 92, 0.2);
    padding: 10px 12px;
    font-size: 0.95rem;
    color: #1b1b1b;
    background: #fff;
  }

  textarea {
    min-height: 72px;
    resize: vertical;
    line-height: 1.45;
  }

  input[type="radio"],
  input[type="checkbox"] {
    width: auto;
    min-width: 0;
    padding: 0;
    accent-color: #6a795c;
  }

  &.conclusion-field textarea {
    min-height: 76px;
  }
`;

const FieldLabel = styled.label`
  display: block;
  font-weight: 600;
`;

const MultiList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;

  label {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #6a795c;
  }
`;

const MatrixWrap = styled.div`
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  border: 1px solid rgba(106, 121, 92, 0.16);
  border-radius: 12px;
  background: #fcfdf8;
`;

const MatrixTable = styled.table`
  width: 100%;
  min-width: 620px;
  border-collapse: collapse;
  background: #fff;

  th,
  td {
    border: 1px solid rgba(106, 121, 92, 0.2);
    padding: 10px;
    text-align: center;
    vertical-align: middle;
    white-space: nowrap;
  }

  th {
    background: #f7f9f4;
    color: #55644c;
    font-size: 0.78rem;
    font-weight: 800;
  }

  th:first-child,
  td:first-child {
    text-align: left;
    min-width: 170px;
    white-space: normal;
  }
`;

const InfoBox = styled.div`
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(162, 177, 144, 0.2);
  color: #1b1b1b;
`;

const CancelButton = styled(LinkGhostButton)`
  min-height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 8px 14px;
  border-radius: 8px;
  background: #6a795c;
  border-color: #6a795c;
  color: #fff;
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;

  &:hover {
    background: #59684e;
    border-color: #59684e;
    color: #fff;
    text-decoration: none;
  }

  &[aria-disabled="true"] {
    opacity: 0.55;
    cursor: not-allowed;
    pointer-events: none;
  }
`;

const SubmitButton = styled(PrimaryButton)`
  min-width: 96px;
  min-height: 42px;
  padding: 8px 14px;
  gap: 7px;
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 1.2;
  justify-content: center;
  white-space: nowrap;
`;

const ButtonSpinner = styled.span`
  width: 16px;
  height: 16px;
  border-radius: 999px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  animation: spin 0.8s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const EmptyState = styled.div`
  text-align: center;
  color: #6a795c;
  padding: 24px 12px;
`;
