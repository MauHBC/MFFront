/* eslint-disable no-restricted-syntax */
import bairrosPorCidade from "./bairrosPorCidade.json";

export const processText = (rawText) => {

  // Normaliza o texto: remove acentos, converte para minúsculas
  const normalizedText = rawText
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const condominioRegex = /(?:ed\.?\s*|edificio\s*)([a-zA-ZÀ-ÿ\s]+?)(?=\s*(?:,|;|apt|apto|loja|lj|sala|bl|torre|andares|unidade))/i;
  const complementoRegex = /(apt\.?\s*\d+|ap\.?\s*\d+|apto\s*\d+|lj\.?\s*\d+|loja\s*\d+|torre\s*\w+|sala\s*\d+|sl\.?\s*\d+)/gi;
  const zipcodeMatch = normalizedText.match(/CEP:\s*(\d{5}-\d{3})/i);
  const addressMatch = normalizedText.match(/(?:Rua|Avenida|Travessa|Alameda)\s[^\d,;]+/i);
  const numberMatch = normalizedText.match(/(\d+)\s*(Casa|Apto|Torre)?/i);
  const neighborhoodMatch = normalizedText.match(/(?:Loja|Apartamento|Sala comercial)?\s*no\s*([^,]+)/i);

  let neighborhood = "N/A";
  let city = "N/A";

  // Função para normalizar texto: remove acentos e converte para minúsculas
  const normalizeText = (text) => {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove acentos
      .toLowerCase();
  };

  // Tentar encontrar o bairro e a cidade correspondente
  if (neighborhoodMatch) {
    neighborhood = neighborhoodMatch[1].trim();

    // Procurar a cidade com base no bairro
    for (const [cidade, bairros] of Object.entries(bairrosPorCidade)) {
      if (bairros.some((b) => normalizeText(b) === normalizeText(neighborhood))) {
        city = cidade;
        break;
      }
    }
  }

  // Definir o condomínio corretamente
  let condominium = "N/A";
  console.log("Texto normalizado:", normalizedText); // Verifique o texto normalizado
  const condMatch = normalizedText.match(condominioRegex);
  console.log("Regex para condomínio:", condominioRegex);
  console.log("Resultado do match para condomínio:", condMatch);
  if (condMatch && condMatch[1]) {
    condominium = condMatch[1].trim();
  }
  console.log("Condomínio encontrado:", condominium);



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
