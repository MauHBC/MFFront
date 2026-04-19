// Controle temporário de exposição de módulos em produção.
// Mantém o código ativo para desenvolvimento, mas retira o acesso da interface.
export const MODULE_FEATURES = Object.freeze({
  plans: false,
});

export const isPlansModuleEnabled = MODULE_FEATURES.plans;
