// /api/custom  (backend: api/routes/custom_posts.py) — the "Create post" page
import { json, request } from "./request.js";

export const customApi = {
  customTypes: () => request("/api/custom/types"),
  customOptions: (ptype, form) => request(`/api/custom/${ptype}/options`, json({ form })),
  createCustomPost: (ptype, data) => request(`/api/custom/${ptype}/posts`, { method: "POST", body: data }),
};