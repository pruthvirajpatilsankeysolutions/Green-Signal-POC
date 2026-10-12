// /api/festivals  (backend: api/routes/festivals.py)
import { json, request } from "./request.js";

export const festivalsApi = {
  festivals: () => request("/api/festivals"),
  backgrounds: (fid) => request(`/api/festivals/${fid}/backgrounds`),
  uploadBackground: (fid, file) => {
    const form = new FormData();
    form.append("file", file);
    return request(`/api/festivals/${fid}/backgrounds`, { method: "POST", body: form });
  },
  generateBackgrounds: (fid, layout) => request(`/api/festivals/${fid}/backgrounds/generate`, json({ layout })),
  createFestivalPost: (fid, body) => request(`/api/festivals/${fid}/posts`, json(body)),
};