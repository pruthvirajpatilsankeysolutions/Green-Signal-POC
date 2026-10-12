// /api/reactions  (backend: api/routes/reactions.py)
import { json, request } from "./request.js";

export const reactionsApi = {
  checkFacts: (body) => request("/api/reactions/check", json(body)),
  createReaction: (form) => request("/api/reactions", { method: "POST", body: form }),
};