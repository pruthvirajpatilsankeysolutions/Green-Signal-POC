// /api/templates  (backend: api/routes/templates.py)
import { json, request } from "./request.js";

const upload = (path, form) => request(path, { method: "POST", body: form });

export const templatesApi = {
  templates: () => request("/api/templates"),
  templatesForPost: ({ occasion = "", postType = "" } = {}) =>
    request(`/api/templates/for-post?occasion=${encodeURIComponent(occasion)}&post_type=${encodeURIComponent(postType)}`),
  importTemplate: (file) => { const f = new FormData(); f.append("file", file); return upload("/api/templates/import", f); },
  templateDesign: (id) => request(`/api/templates/${id}/design`),
  // options (from the Save template dialog): name, occasions, client_types, only_this_client
  saveTemplateDesign: (id, design, image, options = {}) => request(`/api/templates/${id}/design`, json({ design, image, ...options }, "PUT")),
  saveTemplateSettings: (id, body) => request(`/api/templates/${id}`, json(body, "PUT")),
  deleteTemplate: (id) => request(`/api/templates/${id}`, { method: "DELETE" }),
  // download a font from Google Fonts (open licence); fails with a message for Canva / commercial fonts
  autoFont: (family) => request("/api/templates/fonts/auto", json({ family })),
  addFont: (file, family, weight) => { const f = new FormData(); f.append("file", file); f.append("family", family); f.append("weight", weight); return upload("/api/templates/fonts", f); },
};
