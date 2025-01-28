/* eslint-disable no-restricted-syntax */
import bairrosPorCidade from "./bairrosPorCidade.json";

export const processText = (rawText) => {

  // Normaliza o texto: remove acentos, converte para minúsculas
  const normalizedText = rawText
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  // Regex para encontrar o condomínio, agora considerando "Ed." ou "Edificio" e similares
  const condominioRegex = /(?:\d+\s)([^,;]+(?:,?[^,;]+)*)(?=\s*(apto|loja|sala|bl|torre|andares|unidade))/i;

  // Regex para encontrar o complemento (ex: "apto 303", "loja 04")
  const complementoRegex = /(ap\.?\s*\d+|apto\s*\d+|lj\.?\s*\d+|loja\s*\d+|torre\s*\w+)/gi;

  // Regex para encontrar o CEP e removê-lo do texto
  const zipcodeMatch = normalizedText.match(/CEP:\s*(\d{5}-\d{3})/i);

  // Regex para encontrar o endereço até o número, sem incluir o número
  const addressMatch = normalizedText.match(/(?:Rua|Avenida|Travessa|Alameda)\s[^\d,;]+/i);

  // Regex para identificar o número do imóvel
  const numberMatch = normalizedText.match(/(\d+)\s*(Casa|Apto|Torre)?/i);

  // Regex para identificar o bairro
  const neighborhoodMatch = normalizedText.match(/(?:Loja|Apartamento|Sala comercial)?\s*no\s*([^,]+)/i);

  let neighborhood = "N/A";
  let city = "N/A";

  // Tentar encontrar o bairro e a cidade correspondente
  if (neighborhoodMatch) {
    neighborhood = neighborhoodMatch[1].trim();

    // Procurar a cidade com base no bairro
    for (const [cidade, bairros] of Object.entries(bairrosPorCidade)) {
      if (bairros.map((b) => b.toLowerCase()).includes(neighborhood.toLowerCase())) {
        city = cidade;
        break;
      }
    }
  }

  // Definir o condomínio corretamente
  let condominium = "N/A";
  if (condominioRegex.test(normalizedText)) {
    const condMatch = normalizedText.match(condominioRegex);
    if (condMatch && condMatch[1]) {
      condominium = condMatch[1].trim();
    }
  }

  return {
    condominium,
    complement: complementoRegex.exec(normalizedText)?.[0] || "N/A",
    zipcode: zipcodeMatch ? zipcodeMatch[1].replace("-", "") : "N/A",
    adress: addressMatch ? addressMatch[0].replace(/,\s*$/, "") : "N/A",  // Remove trailing comma, if any
    number: numberMatch ? numberMatch[1] : "N/A",
    neighborhood,
    city,
    realEstateInternalCode: "999"
  };
};
