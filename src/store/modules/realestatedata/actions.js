import * as types from "../types";

export function realEstateData(payload) {
  return {
    type: types.REAL_ESTATE_DATA,
    payload,
  };
}

export function newChecklistData(payload) {
  return {
    type: types.NEW_CHECKLIST,
    payload,
  };
}

export function newChecklistPerguntasRespostas(payload) {
  return {
    type: types.NEW_CHECKLIST_PERGUNTAS_RESPOSTAS,
    payload,
  };
}

export function resetState() {
  return {
    type: types.RESET_STATE,
  };
}
