import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import styled from "styled-components";
import { toast } from "react-toastify";

import axios from "../../services/axios";
import Loading from "../../components/Loading";

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
        .map((value) => optionLabelByValue(block, value) || String(value))
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

export default function PatientEvaluationDetails() {
  const { id: patientId, evaluationId } = useParams();
  const [isLoading, setIsLoading] = useState(false);
  const [templateTitle, setTemplateTitle] = useState("Avaliacao");
  const [summaryText, setSummaryText] = useState("");
  const [planText, setPlanText] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [sections, setSections] = useState([]);

  const loadData = useCallback(async () => {
    if (!evaluationId) return;
    setIsLoading(true);
    try {
      const evalResponse = await axios.get(`/evaluations/${evaluationId}`);
      const evalData = evalResponse.data || {};
      setSummaryText(pickText(evalData.summary_text || evalData.summaryText));
      setPlanText(pickText(evalData.plan_text || evalData.planText));
      setCreatedAt(formatDate(evalData.created_at || evalData.createdAt));

      const instanceResponse = await axios.get(
        `/form-instances?evaluation_id=${evaluationId}`,
      );
      const instances = Array.isArray(instanceResponse.data)
        ? instanceResponse.data
        : [];

      if (!instances.length) {
        setSections([]);
        return;
      }

      const instance = instances[0];
      const templateId = instance.form_template_id;
      const formInstanceId = instance.id;

      if (!templateId || !formInstanceId) {
        setSections([]);
        return;
      }

      const templateResponse = await axios.get(`/form-templates/${templateId}`);
      const template = templateResponse.data || {};
      setTemplateTitle(template.title || "Avaliacao");

      let definition = null;
      if (template.code) {
        const defResponse = await axios.get(
          `/form-templates/${template.code}/definition`,
        );
        definition = defResponse.data || null;
      }

      const answersResponse = await axios.get(
        `/form-answers?form_instance_id=${formInstanceId}`,
      );
      const answers = Array.isArray(answersResponse.data) ? answersResponse.data : [];

      if (definition?.sections) {
        setSections(buildSections(definition, answers));
      } else {
        setSections(buildFallbackSections(answers));
      }
    } catch (error) {
      const message =
        error?.response?.data?.error ||
        "Nao foi possivel carregar a avaliacao.";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [evaluationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const headerDate = useMemo(() => createdAt || "--/--/----", [createdAt]);

  return (
    <Wrapper>
      <Content>
        <Header>
          <div>
            <h1 className="font40 extraBold">{templateTitle}</h1>
            <p className="font15">Avaliacao em {headerDate}</p>
          </div>
          <BackLink to={`/pacientes/${patientId}`}>Voltar</BackLink>
        </Header>

        <Loading isLoading={isLoading} />

        {!isLoading && (
          <>
            <SummaryGrid>
              <InfoCard>
                <CardTitle>Resumo clinico</CardTitle>
                <CardText>{summaryText || "Sem resumo clinico."}</CardText>
              </InfoCard>
              <InfoCard>
                <CardTitle>Plano / Conduta</CardTitle>
                <CardText>{planText || "Sem plano informado."}</CardText>
              </InfoCard>
            </SummaryGrid>

            {sections.length === 0 && (
              <EmptyState>Sem respostas para esta avaliacao.</EmptyState>
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

const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
`;

const InfoCard = styled.div`
  background: #fff;
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

const SectionCard = styled.div`
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(106, 121, 92, 0.18);
  padding: 18px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.06);
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
