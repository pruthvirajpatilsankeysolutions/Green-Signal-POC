// /api/drafts/{id}/design  (backend: api/routes/designs.py)
import { getClientId, json, request } from "./request.js";

export const designsApi = {
  design: (id) => request(`/api/drafts/${id}/design`),
  saveDesign: (id, design, image) => request(`/api/drafts/${id}/design`, json({ design, image }, "PUT")),
  // HD version (2x / 3x) of a post image, downloaded as a file
  downloadHd: async (id, image = 0, scale = 2) => {
    const headers = getClientId() ? { "X-Client-Id": getClientId() } : {};
    const res = await fetch(`/api/drafts/${id}/hd?scale=${scale}&image=${image}`, { headers });
    if (!res.ok) { let msg = "HD download failed."; try { msg = (await res.json()).detail || msg; } catch { /* not JSON */ } throw new Error(msg); }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a"); a.href = url; a.download = `post-${id}-${image + 1}-hd${scale}x.png`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },
};
