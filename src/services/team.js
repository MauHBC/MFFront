import api from "./axios";

const data = (response) => response.data;

export const getAuthorizationContext = () => api.get("/team/authorization-context").then(data);

export const getAuthorizationCatalog = () => api.get("/team/authorization-catalog").then(data);

export const getProfileAssignments = () => api.get("/team/profile-assignments").then(data);

export const getLinkableAccounts = () => api.get("/team/linkable-accounts").then(data);

export const getTeamPeople = () => api.get("/team/people").then(data);

export const getAuthorizationProfiles = () => api.get("/team/profiles").then(data);

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
