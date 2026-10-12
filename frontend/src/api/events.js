// /api/events  (backend: api/routes/events.py)
import { request } from "./request.js";

export const eventsApi = {
  createEvent: (form) => request("/api/events", { method: "POST", body: form }),
};