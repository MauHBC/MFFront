import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useHistory, useParams } from "react-router-dom";
import styled from "styled-components";
import { toast } from "react-toastify";

import axios from "../../services/axios";
import Loading from "../../components/Loading";

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

export default function PatientEvaluationNew() {
  const { id: patientId } = useParams();
  const history = useHistory();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [definition, setDefinition] = useState(null);
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [answers, setAnswers] = useState({});

  useEffect(() => {
    async function loadTemplates() {
      setIsLoading(true);
      try {
        const response = await axios.get("/form-templates");
        const list = Array.isArray(response.data) ? response.data : [];
        setTemplates(list.filter((tpl) => tpl.is_active));
      } catch (error) {
        const message =
          error?.response?.data?.error ||
          "Nao foi possivel carregar os formularios.";
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    }

    loadTemplates();
  }, []);

  useEffect(() => {
    async function loadDefinition() {
      if (!selectedTemplate?.code) return;
      setIsLoading(true);
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
          "Nao foi possivel carregar o formulario.";
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

  const sectionsForTiles = useMemo(() => {
    if (!conclusionSection) return orderedSections;
    return orderedSections.filter((section) => section.id !== conclusionSection.id);
  }, [conclusionSection, orderedSections]);

  const activeSection = useMemo(() => {
    if (!activeSectionId) return null;
    return orderedSections.find((section) => section.id === activeSectionId) || null;
  }, [activeSectionId, orderedSections]);

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
            value.forEach((optionId) => {
              payloads.push({
                form_question_id: questionId,
                option_id: optionId,
              });
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
          error?.response?.data?.error || "Nao foi possivel salvar o formulario.";
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
      selectedTemplate,
      validateRequired,
    ],
  );

  return (
    <Wrapper>
      <Content>
        <Header>
          <div>
            <h1 className="font40 extraBold">Novo registro</h1>
            <p className="font15">
              {selectedTemplate
                ? `Formulario: ${selectedTemplate.title}`
                : "Selecione um formulario e preencha."}
            </p>
          </div>
          <BackLink to={`/pacientes/${patientId}`}>Voltar</BackLink>
        </Header>

        <Loading isLoading={isLoading || isSaving} />

        {!selectedTemplate && (
          <TemplatesGrid>
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                type="button"
                onClick={() => setSelectedTemplate(template)}
              >
                <h3>{template.title}</h3>
                <span>{template.code}</span>
              </TemplateCard>
            ))}
          </TemplatesGrid>
        )}

        {selectedTemplate && definition && (
          <Form onSubmit={handleSubmit}>
            {!activeSection && (
              <>
                <SectionsGrid>
                  {sectionsForTiles.map((section) => (
                    <SectionTile
                      key={section.id}
                      type="button"
                      onClick={() => setActiveSectionId(section.id)}
                    >
                      <h3>{section.title}</h3>
                      <span>
                        {section.blocks?.length || 0} campos
                      </span>
                    </SectionTile>
                  ))}
                </SectionsGrid>
                {orderedSections.length === 0 && (
                  <EmptyState>Este formulario nao possui secoes.</EmptyState>
                )}
                {conclusionSection && (
                  <SectionCard>
                    <SectionTitle>{conclusionSection.title}</SectionTitle>
                    <SectionGrid>
                      {conclusionSection.blocks.map((block) => {
                        const fieldId = buildInputId(block);
                        const labelId = `${fieldId}-label`;
                        const isSingleInput = needsSingleInputLabel(block.type);
                        return (
                          <Field
                            key={block.id}
                            className={block.type === "textarea" ? "span-2" : ""}
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
                            {block.helpText && <small>{block.helpText}</small>}
                            {renderBlockInput(block, fieldId)}
                          </Field>
                        );
                      })}
                    </SectionGrid>
                  </SectionCard>
                )}
                <Actions>
                  <BackLink to={`/pacientes/${patientId}`}>Cancelar</BackLink>
                  <SubmitButton type="submit" disabled={isSaving}>
                    Salvar registro
                  </SubmitButton>
                </Actions>
              </>
            )}

            {activeSection && (
              <>
                <SectionNav>
                  <SectionBack
                    type="button"
                    onClick={() => setActiveSectionId(null)}
                  >
                    Voltar as secoes
                  </SectionBack>
                  <SectionTitle>{activeSection.title}</SectionTitle>
                </SectionNav>

                <SectionCard>
                  <SectionGrid>
                    {activeSection.blocks.map((block) => {
                      const fieldId = buildInputId(block);
                      const labelId = `${fieldId}-label`;
                      const isSingleInput = needsSingleInputLabel(block.type);
                      return (
                        <Field
                          key={block.id}
                          className={block.type === "textarea" ? "span-2" : ""}
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
                          {block.helpText && <small>{block.helpText}</small>}
                          {renderBlockInput(block, fieldId)}
                        </Field>
                      );
                    })}
                  </SectionGrid>
                </SectionCard>
              </>
            )}

          </Form>
        )}
      </Content>
    </Wrapper>
  );
}

const Wrapper = styled.section`
  min-height: 100vh;
  background: #f7f8f4;
  padding: 90px 0 60px;
`;

const Content = styled.div`
  width: 100%;
  max-width: 1220px;
  margin: 0 auto;
  padding: 0 30px;
  @media only screen and (max-width: 859px) {
    padding: 0 15px;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;

  h1 {
    color: #1b1b1b;
    margin-bottom: 6px;
  }

  p {
    color: #6a795c;
  }

  @media (max-width: 720px) {
    flex-direction: column;
  }
`;

const BackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 18px;
  border-radius: 10px;
  background: #fff;
  color: #6a795c;
  text-decoration: none;
  font-weight: 600;
  border: 1px solid rgba(106, 121, 92, 0.3);
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

const SectionsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 16px;
`;

const SectionTile = styled.button`
  border: 1px solid rgba(106, 121, 92, 0.2);
  border-radius: 16px;
  padding: 18px;
  background: #fff;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 140px;
  aspect-ratio: 1 / 1;

  h3 {
    margin: 0;
    color: #1b1b1b;
    text-align: center;
  }

  span {
    color: #6a795c;
    font-size: 0.85rem;
  }
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const SectionCard = styled.div`
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(106, 121, 92, 0.18);
  padding: 18px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.06);
`;

const SectionNav = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
`;

const SectionBack = styled.button`
  border: none;
  background: #fff;
  color: #6a795c;
  border: 1px solid rgba(106, 121, 92, 0.3);
  border-radius: 10px;
  padding: 8px 14px;
  font-weight: 600;
  cursor: pointer;
`;

const SectionTitle = styled.h2`
  margin: 0 0 12px;
  color: #1b1b1b;
`;

const SectionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.9rem;
  color: #1b1b1b;

  &.span-2 {
    grid-column: span 2;
  }

  small {
    color: #6a795c;
  }

  input,
  select,
  textarea {
    border-radius: 10px;
    border: 1px solid rgba(106, 121, 92, 0.2);
    padding: 10px 12px;
    font-size: 0.95rem;
    color: #1b1b1b;
    background: #fff;
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

  label {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #6a795c;
  }
`;

const MatrixTable = styled.table`
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    border: 1px solid rgba(106, 121, 92, 0.2);
    padding: 6px;
    text-align: center;
  }

  th:first-child,
  td:first-child {
    text-align: left;
  }
`;

const InfoBox = styled.div`
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(162, 177, 144, 0.2);
  color: #1b1b1b;
`;

const Actions = styled.div`
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  flex-wrap: wrap;
`;

const SubmitButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 18px;
  border-radius: 10px;
  border: none;
  background: #6a795c;
  color: #fff;
  font-weight: 700;
`;

const EmptyState = styled.div`
  text-align: center;
  color: #6a795c;
  padding: 24px 12px;
`;
