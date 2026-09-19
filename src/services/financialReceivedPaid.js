import api from "./axios";

export const getReceivedPaid = (year, signal) =>
  api.get("/financial-received-paid", { params: { year }, signal });

export const getDistributionConfiguration = (signal) =>
  api.get("/financial-distribution/configuration", { signal });

export const saveDistributionConfiguration = (command) =>
  api.put("/financial-distribution/configuration", command);
