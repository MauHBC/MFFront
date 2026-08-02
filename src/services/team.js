import api from "./axios";

const data = (response) => response.data;

export const getAuthorizationContext = () => api.get("/team/authorization-context").then(data);

export const getAuthorizationCatalog = () => api.get("/team/authorization-catalog").then(data);

export const getProfileAssignments = () => api.get("/team/profile-assignments").then(data);

export const getLinkableAccounts = () => api.get("/team/linkable-accounts").then(data);

export const getTeamPeople = () => api.get("/team/people").then(data);

export const getAuthorizationProfiles = () => api.get("/team/profiles").then(data);

export const createTeamPerson = ({ name, email, phone, isProfessional }) => api.post(
  "/team/people",
  {
    name,
    email: email || null,
    phone: phone || null,
    is_professional: isProfessional === true,
  },
).then(data);

export const updateTeamPerson = (personId, { name, email, phone }) => api.put(
  `/team/people/${personId}`,
  {
    name,
    email: email || null,
    phone: phone || null,
  },
).then(data);

export const activateTeamPerson = (personId) => api.patch(
  `/team/people/${personId}/activate`,
).then(data);

export const deactivateTeamPerson = (personId) => api.patch(
  `/team/people/${personId}/deactivate`,
  { confirmed: true },
).then(data);

export const previewProfessionalInactivation = (professionalId, intent) => api.post(
  `/team/professionals/${professionalId}/inactivation-preview`,
  intent,
).then(data);

export const confirmProfessionalInactivation = (
  professionalId,
  { intent, previewToken, idempotencyKey },
) => api.post(
  `/team/professionals/${professionalId}/inactivation-commands`,
  { ...intent, preview_token: previewToken, confirmed: true },
  { headers: { "Idempotency-Key": idempotencyKey } },
).then(data);

export const createTeamAccount = (personId, { email, password, passwordConfirmation }) => api.post(
  `/team/people/${personId}/account`,
  {
    email,
    password,
    password_confirmation: passwordConfirmation,
  },
).then(data);

export const resetTeamAccountPassword = (
  personId,
  { password, passwordConfirmation },
) => api.patch(
  `/team/people/${personId}/account/password`,
  {
    password,
    password_confirmation: passwordConfirmation,
    confirmed: true,
  },
).then(data);

export const blockTeamAccount = (personId) => api.patch(
  `/team/people/${personId}/account/block`,
  { confirmed: true },
).then(data);

export const unblockTeamAccount = (personId) => api.patch(
  `/team/people/${personId}/account/unblock`,
  { confirmed: true },
).then(data);

export const createAuthorizationProfile = ({ name, permissions, capabilities }) => api.post(
  "/team/profiles",
  { name, permissions, capabilities },
).then(data);

export const updateAuthorizationProfile = (
  profileId,
  { name, permissions, capabilities },
) => api.put(
  `/team/profiles/${profileId}`,
  { name, permissions, capabilities },
).then(data);

export const assignAuthorizationProfile = (profileId, userId) => api.post(
  `/team/profiles/${profileId}/assignments`,
  { user_id: userId },
).then(data);

export const unassignAuthorizationProfile = (profileId, userId) => api.delete(
  `/team/profiles/${profileId}/assignments/${userId}`,
).then(data);

export const loadTeamReadModel = () => Promise.all([
  getTeamPeople(),
  getAuthorizationProfiles(),
  getAuthorizationCatalog(),
  getProfileAssignments(),
  getLinkableAccounts(),
]).then(([people, profiles, catalog, assignmentState, accountState]) => ({
  people,
  profiles,
  catalog,
  assignmentState,
  accountState,
}));
