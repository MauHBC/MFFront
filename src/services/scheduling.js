import api from "./axios";

export const listSpecialSchedulingEvents = (params) =>
  api.get("/special-scheduling-events", { params });

export const createSpecialSchedulingEvent = (payload) =>
  api.post("/special-scheduling-events", payload);

export const updateSpecialSchedulingEvent = (id, payload) =>
  api.put(`/special-scheduling-events/${id}`, payload);

export const inactivateSpecialSchedulingEvent = (id) =>
  api.delete(`/special-scheduling-events/${id}`);

export const importSpecialHolidays = (payload) =>
  api.post("/special-scheduling-events/import", payload);

export const checkSchedulingAvailability = (payload) =>
  api.post("/scheduling/availability-check", payload);

export const previewSchedulingOccurrences = (payload) =>
  api.post("/scheduling/occurrences-preview", payload);

export const listSchedulingConflicts = (params) =>
  api.get("/scheduling-conflicts", { params });

export const acknowledgeSchedulingConflict = (id, payload) =>
  api.post(`/scheduling-conflicts/${id}/acknowledge`, payload);

export const resolveSchedulingConflict = (id, payload) =>
  api.post(`/scheduling-conflicts/${id}/resolve`, payload);

export const getUnitSchedulingPolicy = () =>
  api.get("/unit-scheduling-policy");

export const updateUnitSchedulingPolicy = (payload) =>
  api.put("/unit-scheduling-policy", payload);

export default {
  listSpecialSchedulingEvents,
  createSpecialSchedulingEvent,
  updateSpecialSchedulingEvent,
  inactivateSpecialSchedulingEvent,
  importSpecialHolidays,
  checkSchedulingAvailability,
  previewSchedulingOccurrences,
  listSchedulingConflicts,
  acknowledgeSchedulingConflict,
  resolveSchedulingConflict,
  getUnitSchedulingPolicy,
  updateUnitSchedulingPolicy,
};
