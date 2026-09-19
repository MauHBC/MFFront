export const parsePercentage = (value) => {
  const text = String(value).trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(text)) return null;
  const [whole, decimals = ""] = text.split(".");
  const points = Number(whole) * 100 + Number(decimals.padEnd(2, "0"));
  return points > 0 && points <= 10000 ? points : null;
};

export const validateDistributionParticipants = (participants) => {
  const names = new Set();
  let total = 0;
  let error = participants.length ? "" : "Adicione ao menos um participante.";
  participants.forEach((participant) => {
    const name = participant.name
      .normalize("NFKC")
      .trim()
      .replace(/\s+/gu, " ");
    const key = name.toLocaleLowerCase("pt-BR");
    if (!name || name.length > 160)
      error = "Informe um nome válido para cada participante.";
    else if (names.has(key)) error = "Não use nomes duplicados.";
    names.add(key);
    const points = parsePercentage(participant.percentage);
    if (points === null)
      error =
        "Informe percentuais maiores que zero, com até duas casas decimais.";
    else total += points;
  });
  if (!error && total !== 10000)
    error = "Os percentuais devem somar exatamente 100%.";
  return { total, error, valid: !error };
};

export const buildDistributionCommand = (
  configuration,
  participants,
  apply,
) => ({
  expected_revision: configuration.revision,
  ...(configuration.configured ? { apply } : {}),
  participants: participants.map((item) => ({
    ...(item.participant_id ? { participant_id: item.participant_id } : {}),
    name: item.name.trim(),
    percentage: item.percentage.trim().replace(",", "."),
  })),
});
