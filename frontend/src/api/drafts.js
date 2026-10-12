// /api/drafts  (backend: api/routes/drafts.py)
import { json, request } from "./request.js";

export const draftsApi = {
  drafts: (status) => request(`/api/drafts${status ? `?status=${status}` : ""}`),
  approve: (id) => request(`/api/drafts/${id}/approve`, { method: "POST" }),
  reject: (id) => request(`/api/drafts/${id}/reject`, { method: "POST" }),
  rewrite: (id, instruction) => request(`/api/drafts/${id}/rewrite`, json({ instruction })),
};