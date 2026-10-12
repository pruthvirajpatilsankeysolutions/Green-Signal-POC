// /api/clients  (backend: api/routes/clients.py)
import { json, request } from "./request.js";

export const clientsApi = {
  clients: () => request("/api/clients"),
  client: (id) => request(`/api/clients/${id}`),
  createClient: (body) => request("/api/clients", json(body)),
  updateClient: (id, body) => request(`/api/clients/${id}`, json(body, "PUT")),
  uploadAssets: (id, kind, files) => {
    const form = new FormData();
    form.append("kind", kind);
    Array.from(files).forEach((f) => form.append("files", f));
    return request(`/api/clients/${id}/assets`, { method: "POST", body: form });
  },
  deleteAsset: (id, assetId) => request(`/api/clients/${id}/assets/${assetId}`, { method: "DELETE" }),
  addStyle: (id, body) => request(`/api/clients/${id}/styles`, json(body)),
  deleteStyle: (id, styleId) => request(`/api/clients/${id}/styles/${styleId}`, { method: "DELETE" }),
};