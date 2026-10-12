// /api/status  (backend: api/routes/status.py)
import { request } from "./request.js";

export const statusApi = {
  status: () => request("/api/status"),
};