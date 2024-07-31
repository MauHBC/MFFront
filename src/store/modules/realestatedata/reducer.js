import * as types from "../types";

const initialState = {
  realEstateData: {},
  newChecklistData: {},
  contadorAmbientes: {
    Sala: 0,
    Cozinha: 0,
    Quarto: 0,
    Banheiro: 0,
  },
  newChecklistPerguntasRespostas: {},
};

// eslint-disable-next-line func-names, default-param-last
export default function (state = initialState, action) {
  switch (action.type) {
    case types.RESET_STATE: {
      const newState = {
        realEstateData: {},
        newChecklistData: {},
        contadorAmbientes: {
          Sala: 0,
          Cozinha: 0,
          Quarto: 0,
          Banheiro: 0,
        },
        newChecklistPerguntasRespostas: {},
      };
      return newState;
    }

    case types.REAL_ESTATE_DATA: {
      const newState = { ...state };
      newState.realEstateData = action.payload.data;
      return newState;
    }

    case types.NEW_CHECKLIST: {
      const newState = { ...state };
      const { ambiente, data, isNovoAmbiente } = action.payload;

      let novoContador = newState.contadorAmbientes[ambiente] || 0;
      if (isNovoAmbiente) {
        novoContador += 1;
      }
      newState.contadorAmbientes[ambiente] = novoContador;
      const nomeAmbiente =
        novoContador > 0 ? `${ambiente} ${novoContador}` : ambiente;

      newState.newChecklistData = {
        ...newState.newChecklistData,
        [nomeAmbiente]: [...(Array.isArray(data) ? data : [data])],
      };

      return newState;
    }

    case types.NEW_CHECKLIST_PERGUNTAS_RESPOSTAS: {
      const newState = { ...state };
      newState.newChecklistPerguntasRespostas = action.payload.data;
      return newState;
    }

    default: {
      return state;
    }
  }
}
