import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import styled from "styled-components";
import { toast } from "react-toastify";

import axios from "../../services/axios";
import DataLoadingState from "../../components/DataLoadingState";
import { PageWrapper, PageContent } from "../../components/AppLayout";
import { LinkGhostButton, PrimaryButton } from "../../components/AppButton";
import {
  ModuleHeader,
  ModulePanel,
  ModuleTitle,
  ModuleSubtitle,
} from "../../components/AppModuleShell";

const formatDate = (value) => {
  if (!value) return "--/--/----";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--/--/----";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const mapFromList = (raw, keyField, valueField) => {
  if (!Array.isArray(raw)) return {};
  return raw.reduce((acc, item) => {
    if (!item) return acc;
    const key = item[keyField];
    const value = item[valueField];
    if (key !== undefined && value !== undefined) {
      acc[String(key)] = String(value);
    }
    return acc;
  }, {});
};

const pickText = (value) => {
  if (typeof value !== "string") return "";
  return value.trim();
};

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

const pickFirstText = (answers, keys) =>
  keys.reduce((acc, key) => acc || resolveText(answers[key]), null);

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
    return { summary_text: summary, plan_text: plan };
  }

  const conclusionSection = definition.sections.find((section) => {
    const id = normalizeLabel(section.id);
    const title = normalizeLabel(section.title);
    return id.includes("conclusion") || title.includes("conclus");
  });

  if (!conclusionSection) return { summary_text: summary, plan_text: plan };

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
  return { summary_text: summaryText, plan_text: planText };
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
  ["textarea", "matrix", "table", "info"].includes(block?.type);

const buildFieldClassName = (block) => (isFullWidthBlock(block) ? "span-full" : "");

const shouldShowHelpText = (helpText) => Boolean(helpText);

const formatUnknown = (answer) => {
  if (!answer) return "";
  const value =
    answer.value_text ??
    answer.value_number ??
    answer.value_bool ??
    answer.value_date ??
    answer.value_json ??
    answer.option_id;
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
};

const optionLabelById = (block, id) => {
  const raw = block?.config?.options;
  if (!Array.isArray(raw)) return null;
  const match = raw.find(
    (opt) => String(opt?.id) === String(id) || String(opt?.value) === String(id),
  );
  return match?.label ? String(match.label) : null;
};

const optionLabelByValue = (block, value) => {
  const raw = block?.config?.options;
  if (!Array.isArray(raw)) return null;
  const match = raw.find((opt) => String(opt?.value) === String(value));
  return match?.label ? String(match.label) : null;
};

const formatMatrix = (block, raw) => {
  if (!raw || typeof raw !== "object") return "";
  const rows = mapFromList(block?.config?.rows, "id", "label");
  const choices = mapFromList(block?.config?.choices, "value", "label");
  const choiceKey = String(block?.config?.choiceKey || "loss");
  const boolKey = String(block?.config?.boolKey || "pain");
  const boolLabel = String(block?.config?.boolLabel || "Dor");

  return Object.entries(raw)
    .map(([rowKey, rowValue]) => {
      const rowLabel = rows[rowKey] || rowKey;
      if (!rowValue || typeof rowValue !== "object") {
        return `${rowLabel}: -`;
      }
      const choiceValue = rowValue[choiceKey];
      const choiceLabel = choiceValue == null ? "-" : choices[String(choiceValue)] || choiceValue;
      const boolValue = rowValue[boolKey];
      const boolText = boolValue === true || boolValue === "true" ? "Sim" : "Nao";
      return `${rowLabel}: ${choiceLabel} (${boolLabel}: ${boolText})`;
    })
    .filter(Boolean)
    .join("\n");
};

const formatTable = (block, raw) => {
  if (!Array.isArray(raw)) return "";
  const columns = mapFromList(block?.config?.columns, "id", "label");
  const lines = raw.map((row, index) => {
    if (!row || typeof row !== "object") return "";
    const parts = Object.entries(row).map(([key, value]) => {
      const label = columns[key] || key;
      return `${label}: ${value ?? ""}`;
    });
    return parts.length ? `Linha ${index + 1}: ${parts.join(", ")}` : "";
  });
  return lines.filter(Boolean).join("\n");
};

const formatAnswer = (block, answers) => {
  if (!block || !Array.isArray(answers) || answers.length === 0) return "";
  const first = answers[0] || {};

  if (block.type === "text" || block.type === "textarea") {
    return pickText(first.value_text);
  }

  if (block.type === "date") {
    return formatDate(first.value_date);
  }

  if (block.type === "yesno") {
    if (first.value_bool === undefined || first.value_bool === null) return "";
    return first.value_bool === true || first.value_bool === "true" ? "Sim" : "Nao";
  }

  if (block.type === "single_select") {
    if (first.option_id !== undefined && first.option_id !== null) {
      return optionLabelById(block, first.option_id) || String(first.option_id);
    }
    const text = pickText(first.value_text);
    if (text) {
      return optionLabelByValue(block, text) || text;
    }
    return "";
  }

  if (block.type === "multi_select") {
    const optionIds = answers
      .map((answer) => answer.option_id)
      .filter((value) => value !== undefined && value !== null);
    if (optionIds.length) {
      return optionIds
        .map((id) => optionLabelById(block, id) || String(id))
        .join(", ");
    }
    if (Array.isArray(first.value_json)) {
      return first.value_json
        .map(
          (value) =>
            optionLabelById(block, value) ||
            optionLabelByValue(block, value) ||
            String(value),
        )
        .join(", ");
    }
    return "";
  }

  if (block.type === "matrix") {
    return formatMatrix(block, first.value_json);
  }

  if (block.type === "table") {
    return formatTable(block, first.value_json);
  }

  if (first.value_json !== undefined && first.value_json !== null) {
    return JSON.stringify(first.value_json);
  }

  return pickText(first.value_text);
};

const buildSections = (definition, answers) => {
  if (!definition?.sections || !Array.isArray(answers)) return [];

  const sectionMap = {};
  const blockMap = {};

  definition.sections.forEach((section) => {
    sectionMap[section.id] = {
      id: section.id,
      title: section.title,
      order: section.order || 0,
      items: [],
    };

    section.blocks.forEach((block, index) => {
      const questionId = block?.config?.questionId;
      if (!questionId) return;
      blockMap[String(questionId)] = {
        sectionId: section.id,
        block,
        order: index,
      };
    });
  });

  const answersByQuestion = answers.reduce((acc, answer) => {
    const questionId = answer.form_question_id;
    if (!questionId) return acc;
    const key = String(questionId);
    if (!acc[key]) acc[key] = [];
    acc[key].push(answer);
    return acc;
  }, {});

  Object.entries(answersByQuestion).forEach(([questionId, items]) => {
    const meta = blockMap[questionId];
    if (!meta) return;
    const value = formatAnswer(meta.block, items);
    if (!value) return;
    sectionMap[meta.sectionId].items.push({
      label: meta.block.label,
      value,
      order: meta.order,
    });
  });

  const sections = Object.values(sectionMap)
    .map((section) => ({
      ...section,
      items: section.items.sort((a, b) => a.order - b.order),
    }))
    .filter((section) => section.items.length > 0)
    .sort((a, b) => a.order - b.order);

  return sections;
};

const buildFallbackSections = (answers) => {
  if (!Array.isArray(answers) || answers.length === 0) return [];
  const items = answers
    .map((answer, index) => ({
      label: `Pergunta ${answer.form_question_id || index + 1}`,
      value: formatUnknown(answer),
      order: index,
    }))
    .filter((item) => item.value);

  if (!items.length) return [];
  return [
    {
      id: "others",
      title: "Respostas",
      order: 0,
      items,
    },
  ];
};

const orderedDefinitionSections = (definition) => {
  if (!definition?.sections) return [];
  return [...definition.sections].sort((a, b) => (a.order || 0) - (b.order || 0));
};

const resolveAnswerValue = (block, answers) => {
  if (!block || !Array.isArray(answers) || answers.length === 0) return "";
  const first = answers[0] || {};

  if (block.type === "text" || block.type === "textarea") {
    return first.value_text || "";
  }

  if (block.type === "date") {
    return first.value_date || "";
  }

  if (block.type === "yesno") {
    if (first.value_bool === undefined || first.value_bool === null) return "";
    return first.value_bool === true || first.value_bool === "true";
  }

  if (block.type === "single_select") {
    if (first.option_id !== undefined && first.option_id !== null) {
      return String(first.option_id);
    }
    return first.value_text || "";
  }

  if (block.type === "multi_select") {
    if (Array.isArray(first.value_json)) {
      return first.value_json.map((value) => String(value));
    }
    return answers
      .map((answer) => answer.option_id)
      .filter((value) => value !== undefined && value !== null)
      .map((value) => String(value));
  }

  if (block.type === "matrix" || block.type === "table") {
    return first.value_json || (block.type === "table" ? [] : {});
  }

  return first.value_json ?? first.value_text ?? "";
};

const buildEditableAnswers = (definition, rawAnswers) => {
  const answersByQuestion = rawAnswers.reduce((acc, answer) => {
    const questionId = answer.form_question_id;
    if (!questionId) return acc;
    const key = String(questionId);
    if (!acc[key]) acc[key] = [];
    acc[key].push(answer);
    return acc;
  }, {});

  return orderedDefinitionSections(definition).reduce((acc, section) => {
    section.blocks.forEach((block) => {
      const questionId = block?.config?.questionId;
      if (!questionId) return;
      acc[block.id] = resolveAnswerValue(block, answersByQuestion[String(questionId)] || []);
    });
    return acc;
  }, {});
};

const buildAnswersPayload = (definition, answers) => {
  const payloads = [];
  orderedDefinitionSections(definition).forEach((section) => {
    section.blocks.forEach((block) => {
      const questionId = block.config?.questionId;
      if (!questionId) return;
      const value = answers[block.id];
      if (value === undefined || value === null || value === "") return;
      if (Array.isArray(value) && value.length === 0) return;

      switch (block.type) {
        case "text":
        case "textarea":
          payloads.push({ form_question_id: questionId, value_text: String(value) });
          break;
        case "date":
          payloads.push({ form_question_id: questionId, value_date: value });
          break;
        case "yesno":
          payloads.push({ form_question_id: questionId, value_bool: Boolean(value) });
          break;
        case "single_select":
          payloads.push({ form_question_id: questionId, option_id: value });
          break;
        case "multi_select":
        case "matrix":
        case "table":
          payloads.push({ form_question_id: questionId, value_json: value });
          break;
        default:
          break;
      }
    });
  });
  return payloads;
};

export default function PatientEvaluationDetails() {
  const { id: patientId, evaluationId } = useParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [templateTitle, setTemplateTitle] = useState("Avaliacao");
  const [summaryText, setSummaryText] = useState("");
  const [planText, setPlanText] = useState("");
  const [recordType, setRecordType] = useState("evaluation");
  const [definition, setDefinition] = useState(null);
  const [formInstanceId, setFormInstanceId] = useState(null);
  const [rawAnswers, setRawAnswers] = useState([]);
  const [answers, setAnswers] = useState({});
  const [draftAnswers, setDraftAnswers] = useState({});
  const [selectedClinicalCaseId, setSelectedClinicalCaseId] = useState("");
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [clinicalCaseTitle, setClinicalCaseTitle] = useState("");
  const [painScale, setPainScale] = useState(null);
  const [painNotes, setPainNotes] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [sections, setSections] = useState([]);

  const loadData = useCallback(async () => {
    if (!evaluationId) return;
    setIsLoading(true);
    try {
      const evalResponse = await axios.get(`/evaluations/${evaluationId}`);
      const evalData = evalResponse.data || {};
      const clinicalCase = evalData.PatientClinicalCase || evalData.patient_clinical_case;
      const currentRecordType = evalData.record_type || evalData.recordType || "evaluation";
      setRecordType(currentRecordType);
      setSummaryText(pickText(evalData.summary_text || evalData.summaryText));
      setPlanText(pickText(evalData.plan_text || evalData.planText));
      setClinicalCaseTitle(clinicalCase?.title || "");
      setSelectedClinicalCaseId(
        evalData.clinical_case_id ? String(evalData.clinical_case_id) : "",
      );
      setPainScale(evalData.pain_scale ?? evalData.painScale ?? null);
      setPainNotes(pickText(evalData.pain_notes || evalData.painNotes));
      setCreatedAt(formatDate(evalData.created_at || evalData.createdAt));

      const instanceResponse = await axios.get(
        `/form-instances?evaluation_id=${evaluationId}`,
      );
      const instances = Array.isArray(instanceResponse.data)
        ? instanceResponse.data
        : [];

      if (!instances.length) {
        if (currentRecordType === "session") {
          setTemplateTitle("Evolução");
        }
        setDefinition(null);
        setFormInstanceId(null);
        setRawAnswers([]);
        setAnswers({});
        setDraftAnswers({});
        setSections([]);
        return;
      }

      const instance = instances[0];
      const templateId = instance.form_template_id;
      const loadedFormInstanceId = instance.id;

      if (!templateId || !loadedFormInstanceId) {
        setDefinition(null);
        setFormInstanceId(null);
        setRawAnswers([]);
        setAnswers({});
        setDraftAnswers({});
        setSections([]);
        return;
      }

      const templateResponse = await axios.get(`/form-templates/${templateId}`);
      const template = templateResponse.data || {};
      setTemplateTitle(template.title || "Avaliacao");
      setFormInstanceId(loadedFormInstanceId);

      let loadedDefinition = null;
      if (templateId) {
        const defResponse = await axios.get(
          `/form-templates/${templateId}/definition`,
        );
        loadedDefinition = defResponse.data || null;
        setDefinition(loadedDefinition);
      }

      const answersResponse = await axios.get(
        `/form-answers?form_instance_id=${loadedFormInstanceId}`,
      );
      const loadedAnswers = Array.isArray(answersResponse.data)
        ? answersResponse.data
        : [];
      setRawAnswers(loadedAnswers);

      if (loadedDefinition?.sections) {
        const editableAnswers = buildEditableAnswers(loadedDefinition, loadedAnswers);
        setAnswers(editableAnswers);
        setDraftAnswers(editableAnswers);
        setActiveSectionId((prev) => (
          prev || orderedDefinitionSections(loadedDefinition)[0]?.id || null
        ));
        setSections(buildSections(loadedDefinition, loadedAnswers));
      } else {
        setAnswers({});
        setDraftAnswers({});
        setSections(buildFallbackSections(loadedAnswers));
      }
    } catch (error) {
      const message =
        error?.response?.data?.error ||
        "Não foi possível carregar a avaliação.";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [evaluationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const headerDate = useMemo(() => createdAt || "--/--/----", [createdAt]);
  const isQuickEvolution = recordType === "session";
  const orderedSections = useMemo(() => orderedDefinitionSections(definition), [definition]);
  const activeSection = useMemo(() => {
    if (!orderedSections.length) return null;
    if (!activeSectionId) return orderedSections[0];
    return orderedSections.find((section) => section.id === activeSectionId) || orderedSections[0];
  }, [activeSectionId, orderedSections]);

  const handleFieldChange = useCallback((block, value) => {
    setDraftAnswers((prev) => ({
      ...prev,
      [block.id]: value,
    }));
  }, []);

  const handleMultiSelectToggle = useCallback((block, optionValue) => {
    setDraftAnswers((prev) => {
      const current = Array.isArray(prev[block.id]) ? prev[block.id] : [];
      const normalizedValue = String(optionValue);
      const next = current.includes(normalizedValue)
        ? current.filter((item) => item !== normalizedValue)
        : [...current, normalizedValue];
      return { ...prev, [block.id]: next };
    });
  }, []);

  const handleMatrixChange = useCallback((block, rowId, key, value) => {
    setDraftAnswers((prev) => {
      const current = prev[block.id] && typeof prev[block.id] === "object"
        ? prev[block.id]
        : {};
      const rowValue = current[rowId] && typeof current[rowId] === "object"
        ? current[rowId]
        : {};
      return {
        ...prev,
        [block.id]: {
          ...current,
          [rowId]: {
            ...rowValue,
            [key]: value,
          },
        },
      };
    });
  }, []);

  const startEditing = useCallback(() => {
    setDraftAnswers(answers);
    setIsEditing(true);
  }, [answers]);

  const cancelEditing = useCallback(() => {
    setDraftAnswers(answers);
    setIsEditing(false);
  }, [answers]);

  const handleSave = useCallback(async () => {
    if (!definition || !formInstanceId) return;
    setIsSaving(true);
    try {
      const summary = resolveSummary(definition, draftAnswers);
      await axios.put(`/evaluations/${evaluationId}`, {
        clinical_case_id: selectedClinicalCaseId ? Number(selectedClinicalCaseId) : null,
        summary_text: summary.summary_text,
        plan_text: summary.plan_text,
      });

      await Promise.all(rawAnswers.map((answer) => axios.delete(`/form-answers/${answer.id}`)));
      const payloads = buildAnswersPayload(definition, draftAnswers);
      await Promise.all(
        payloads.map((payload) =>
          axios.post("/form-answers", {
            ...payload,
            form_instance_id: formInstanceId,
          }),
        ),
      );

      toast.success("Registro atualizado.");
      setIsEditing(false);
      await loadData();
    } catch (error) {
      toast.error(error?.response?.data?.error || "Não foi possível salvar o registro.");
    } finally {
      setIsSaving(false);
    }
  }, [
    definition,
    draftAnswers,
    evaluationId,
    formInstanceId,
    loadData,
    rawAnswers,
    selectedClinicalCaseId,
  ]);

  const renderReadOnlyBlock = useCallback((block) => {
    const value = formatAnswer(block, rawAnswers.filter(
      (answer) => String(answer.form_question_id) === String(block.config?.questionId),
    ));
    return <ReadOnlyValue>{value || "-"}</ReadOnlyValue>;
  }, [rawAnswers]);

  const renderEditableBlock = useCallback((block, fieldId) => {
    const value = draftAnswers[block.id];
    const options = Array.isArray(block.config?.options) ? block.config.options : [];

    if (block.type === "text") {
      return (
        <FieldInput
          id={fieldId}
          value={value || ""}
          onChange={(event) => handleFieldChange(block, event.target.value)}
        />
      );
    }

    if (block.type === "textarea") {
      return (
        <FieldTextarea
          id={fieldId}
          value={value || ""}
          onChange={(event) => handleFieldChange(block, event.target.value)}
        />
      );
    }

    if (block.type === "date") {
      return (
        <FieldInput
          id={fieldId}
          type="date"
          value={value || ""}
          onChange={(event) => handleFieldChange(block, event.target.value)}
        />
      );
    }

    if (block.type === "yesno") {
      return (
        <FieldSelect
          id={fieldId}
          value={resolveYesNo(value)}
          onChange={(event) => {
            const nextValue = event.target.value;
            handleFieldChange(block, nextValue === "" ? "" : nextValue === "yes");
          }}
        >
          <option value="">Selecionar</option>
          <option value="yes">Sim</option>
          <option value="no">Não</option>
        </FieldSelect>
      );
    }

    if (block.type === "single_select") {
      return (
        <FieldSelect
          id={fieldId}
          value={value || ""}
          onChange={(event) => handleFieldChange(block, event.target.value)}
        >
          <option value="">Selecionar</option>
          {options.map((option) => (
            <option key={option.id || option.value} value={option.id || option.value}>
              {option.label}
            </option>
          ))}
        </FieldSelect>
      );
    }

    if (block.type === "multi_select") {
      const selected = Array.isArray(value) ? value : [];
      return (
        <CheckboxGroup>
          {options.map((option) => {
            const optionValue = String(option.id || option.value);
            return (
              <CheckboxOption key={optionValue}>
                <input
                  type="checkbox"
                  checked={selected.includes(optionValue)}
                  onChange={() => handleMultiSelectToggle(block, optionValue)}
                />
                <span>{option.label}</span>
              </CheckboxOption>
            );
          })}
        </CheckboxGroup>
      );
    }

    if (block.type === "matrix") {
      const rows = Array.isArray(block.config?.rows) ? block.config.rows : [];
      const choices = Array.isArray(block.config?.choices) ? block.config.choices : [];
      const choiceKey = String(block.config?.choiceKey || "loss");
      const boolKey = String(block.config?.boolKey || "pain");
      const matrixValue = value && typeof value === "object" ? value : {};
      return (
        <MatrixWrap>
          <MatrixTable>
            <thead>
              <tr>
                <th>Item</th>
                <th>Resultado</th>
                <th>{block.config?.boolLabel || "Dor"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const rowValue = matrixValue[row.id] || {};
                return (
                  <tr key={row.id}>
                    <td>{row.label}</td>
                    <td>
                      <FieldSelect
                        value={rowValue[choiceKey] || ""}
                        onChange={(event) =>
                          handleMatrixChange(block, row.id, choiceKey, event.target.value)
                        }
                      >
                        <option value="">Selecionar</option>
                        {choices.map((choice) => (
                          <option key={choice.value} value={choice.value}>
                            {choice.label}
                          </option>
                        ))}
                      </FieldSelect>
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={Boolean(rowValue[boolKey])}
                        onChange={(event) =>
                          handleMatrixChange(block, row.id, boolKey, event.target.checked)
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

    return renderReadOnlyBlock(block);
  }, [
    draftAnswers,
    handleFieldChange,
    handleMatrixChange,
    handleMultiSelectToggle,
    renderReadOnlyBlock,
  ]);

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
            <HeaderTitle>{isQuickEvolution ? "Evolução" : templateTitle}</HeaderTitle>
            <HeaderSubtitle>
              {isQuickEvolution ? "Evolução" : "Avaliação"} em {headerDate}
            </HeaderSubtitle>
          </div>
        </Header>

        {!isQuickEvolution && definition && (
          <HeaderActions>
            <CaseContextTitle>
              Caso clínico - {clinicalCaseTitle || "Sem caso clínico"}
            </CaseContextTitle>
            <ActionButtonGroup>
              <CancelButton to={`/pacientes/${patientId}`}>Voltar</CancelButton>
              {isEditing ? (
                <>
                  <CancelButton
                    as="button"
                    type="button"
                    onClick={cancelEditing}
                    disabled={isSaving}
                  >
                    Cancelar
                  </CancelButton>
                  <SubmitButton
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? "Salvando..." : "Salvar"}
                  </SubmitButton>
                </>
              ) : (
                <SubmitButton type="button" onClick={startEditing}>
                  Editar
                </SubmitButton>
              )}
            </ActionButtonGroup>
          </HeaderActions>
        )}

        {isLoading && (
          <SectionCard>
            <DataLoadingState text="Carregando avaliação..." />
          </SectionCard>
        )}

        {!isLoading && isQuickEvolution && (
          <SummaryGrid>
            <InfoCard>
              <CardTitle>Evolução</CardTitle>
              <CardText>{summaryText || "Sem evolução registrada."}</CardText>
            </InfoCard>
            <InfoCard>
              <CardTitle>Plano / Conduta</CardTitle>
              <CardText>{planText || "Sem plano informado."}</CardText>
            </InfoCard>
            <InfoCard>
              <CardTitle>Caso clínico</CardTitle>
              <CardText>{clinicalCaseTitle || "Não organizados"}</CardText>
            </InfoCard>
            <InfoCard>
              <CardTitle>Dor / observação</CardTitle>
              <CardText>
                {painScale ? `Dor ${painScale}/10` : "Dor não informada"}
                {painNotes ? `\n${painNotes}` : ""}
              </CardText>
            </InfoCard>
          </SummaryGrid>
        )}

        {!isLoading && !isQuickEvolution && definition && (
          <EvaluationLayout>
            <SectionSidebar aria-label="Seções do formulário">
              {orderedSections.map((section) => (
                <SectionMenuButton
                  key={section.id}
                  type="button"
                  className={activeSection?.id === section.id ? "active" : ""}
                  onClick={() => setActiveSectionId(section.id)}
                >
                  <span>{section.title}</span>
                  <small>{section.blocks?.length || 0} campos</small>
                </SectionMenuButton>
              ))}
            </SectionSidebar>

            {activeSection && (
              <SectionPanel>
                <SectionTitle>{activeSection.title}</SectionTitle>
                <SectionCard>
                  <SectionGrid>
                    {activeSection.blocks.map((block) => {
                      const fieldId = buildInputId(block);
                      const isSingleInput = needsSingleInputLabel(block.type);
                      return (
                        <Field key={block.id} className={buildFieldClassName(block)}>
                          {isSingleInput ? (
                            <FieldLabel htmlFor={fieldId}>
                              {block.label}
                              {block.required ? " *" : ""}
                            </FieldLabel>
                          ) : (
                            <FieldLabel as="div">
                              {block.label}
                              {block.required ? " *" : ""}
                            </FieldLabel>
                          )}
                          {shouldShowHelpText(block.helpText) && (
                            <small>{block.helpText}</small>
                          )}
                          {isEditing
                            ? renderEditableBlock(block, fieldId)
                            : renderReadOnlyBlock(block)}
                        </Field>
                      );
                    })}
                  </SectionGrid>
                </SectionCard>
              </SectionPanel>
            )}
          </EvaluationLayout>
        )}

        {!isLoading && !isQuickEvolution && !definition && (
          <>
            {sections.length === 0 && (
              <EmptyState>Sem respostas para esta avaliação.</EmptyState>
            )}
            <Sections>
              {sections.map((section) => (
                <SectionCard key={section.id}>
                  <SectionTitle>{section.title}</SectionTitle>
                  <ItemsGrid>
                    {section.items.map((item) => (
                      <Item key={`${section.id}-${item.label}`}>
                        <strong>{item.label}</strong>
                        <span>{item.value}</span>
                      </Item>
                    ))}
                  </ItemsGrid>
                </SectionCard>
              ))}
            </Sections>
          </>
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

  p {
    color: #6a795c;
  }

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

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
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

const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
`;

const InfoCard = styled(ModulePanel)`
  border-radius: 16px;
  border: 1px solid rgba(106, 121, 92, 0.18);
  padding: 18px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.06);
`;

const CardTitle = styled.div`
  font-weight: 700;
  color: #1b1b1b;
  margin-bottom: 10px;
`;

const CardText = styled.div`
  color: #6a795c;
  line-height: 1.5;
`;

const Sections = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const SectionCard = styled(ModulePanel)`
  border-radius: 16px;
  border: 1px solid rgba(106, 121, 92, 0.18);
  padding: 18px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.06);
`;

const EvaluationLayout = styled.div`
  display: grid;
  grid-template-columns: 264px minmax(0, 1fr);
  gap: 20px;
  align-items: flex-start;

  @media (max-width: 860px) {
    grid-template-columns: 1fr;
  }
`;

const SectionSidebar = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 10px;

  @media (max-width: 860px) {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }
`;

const SectionMenuButton = styled.button`
  width: 100%;
  min-height: 70px;
  border-radius: 12px;
  border: 1px solid rgba(106, 121, 92, 0.12);
  background: #fff;
  color: #1b1b1b;
  padding: 14px 16px;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.04);

  span {
    display: block;
    color: #1b1b1b;
    font-weight: 800;
    line-height: 1.2;
  }

  small {
    display: block;
    margin-top: 6px;
    color: #6a795c;
    font-size: 0.82rem;
  }

  &.active {
    border-color: rgba(106, 121, 92, 0.45);
    background: #f8faf3;
  }
`;

const SectionPanel = styled.div`
  min-width: 0;
`;

const SectionTitle = styled.h2`
  margin: 0 0 12px;
  color: #1b1b1b;
`;

const ItemsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
`;

const SectionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px 16px;

  .span-full {
    grid-column: 1 / -1;
  }

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;

  small {
    color: #6a795c;
    font-size: 0.82rem;
    line-height: 1.35;
  }
`;

const FieldLabel = styled.label`
  color: #1b1b1b;
  font-weight: 700;
`;

const fieldStyles = `
  width: 100%;
  min-height: 44px;
  border-radius: 10px;
  border: 1px solid rgba(106, 121, 92, 0.2);
  background: #fff;
  color: #1b1b1b;
  padding: 0 14px;
  font: inherit;
`;

const FieldInput = styled.input`
  ${fieldStyles}
`;

const FieldSelect = styled.select`
  ${fieldStyles}
`;

const FieldTextarea = styled.textarea`
  ${fieldStyles}
  min-height: 96px;
  padding-top: 12px;
  resize: vertical;
`;

const ReadOnlyValue = styled.div`
  min-height: 42px;
  color: #6a795c;
  line-height: 1.5;
  white-space: pre-wrap;
`;

const CheckboxGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const CheckboxOption = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  color: #1b1b1b;
`;

const MatrixWrap = styled.div`
  overflow-x: auto;
`;

const MatrixTable = styled.table`
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    border-bottom: 1px solid rgba(106, 121, 92, 0.12);
    padding: 8px;
    text-align: left;
  }

  th {
    color: #6a795c;
    font-size: 0.82rem;
  }
`;

const InfoBox = styled.div`
  border-radius: 10px;
  background: #f8f9f4;
  color: #6a795c;
  padding: 12px;
  line-height: 1.45;
`;

const Item = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border-radius: 12px;
  background: #f9faf6;
  border: 1px solid rgba(106, 121, 92, 0.12);

  strong {
    color: #1b1b1b;
  }

  span {
    color: #6a795c;
    white-space: pre-wrap;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  color: #6a795c;
  padding: 24px 12px;
`;
