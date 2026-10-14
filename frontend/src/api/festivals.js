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

  // post planner: AI word options, pick, edit, approve
  plan: (fid) => request(`/api/festivals/${fid}/plan`),
  generatePlan: (fid) => request(`/api/festivals/${fid}/plan/generate`, { method: "POST" }),
  rewritePlan: (fid, part, instruction) => request(`/api/festivals/${fid}/plan/rewrite`, json({ part, instruction })),
  savePlan: (fid, chosen) => request(`/api/festivals/${fid}/plan`, json(chosen, "PUT")),
  approvePlan: (fid) => request(`/api/festivals/${fid}/plan/approve`, { method: "POST" }),
  pickPlan: (fid, body) => request(`/api/festivals/${fid}/plan/pick`, json(body, "PUT")),
  planCaptions: (fid) => request(`/api/festivals/${fid}/plan/captions`, { method: "POST" }),

  // month plan: hooks and titles for every occasion in a month
  monthPlan: (month) => request(`/api/plans/month?month=${month}`),
  generateMonth: (month, onlyMissing = true) => request("/api/plans/month/generate", json({ month, only_missing: onlyMissing })),
  approveMonth: (month) => request("/api/plans/month/approve", json({ month })),
};