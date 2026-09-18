export const selfServiceError = (error) => ({
  LEGAL_ACCEPTANCE_REQUIRED: "Leia os documentos e confirme o aceite para continuar.",
  INVALID_REGISTRATION_NAME: "Informe seu nome, entre 3 e 100 caracteres.",
  PASSWORD_TOO_SHORT: "A senha deve ter pelo menos 8 caracteres.",
  PASSWORD_TOO_LONG: "A senha deve ter no máximo 128 caracteres.",
  PASSWORD_COMMON_OR_COMPROMISED: "Escolha uma senha menos comum.",
  SELF_SERVICE_TRIAL_ALREADY_CONSUMED: "Esta conta já utilizou o teste gratuito de criação de Agenda.",
  SELF_SERVICE_MEMBERSHIP_AUTHENTICATION_REQUIRED: "A criação de outra Agenda nesta conta estará disponível após a habilitação do acesso por vínculos. Entre em contato com suporte@motria.com.br.",
  SELF_SERVICE_LEGAL_NOT_APPROVED: "O cadastro ainda aguarda a publicação dos documentos legais aprovados.",
}[error?.response?.data?.error] || (error?.response?.status === 429
  ? "Muitas tentativas. Aguarde um pouco e tente novamente."
  : "Não foi possível concluir agora. Tente novamente em alguns minutos."));

export const trialDate = (date, timezone = "America/Sao_Paulo") => new Intl.DateTimeFormat("pt-BR", {
  timeZone: timezone, dateStyle: "long", timeStyle: "short",
}).format(new Date(date));
