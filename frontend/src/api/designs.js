// /api/drafts/{id}/design  (backend: api/routes/designs.py)
import { json, request } from "./request.js";

export const designsApi = {
  design: (id) => request(`/api/drafts/${id}/design`),
  saveDesign: (id, design, image) => request(`/api/drafts/${id}/design`, json({ design, image }, "PUT")),
};