// Story Studio talks to /api/studio. It is separate from the client app: no client is selected, nothing here belongs to a client.
// If the server has STUDIO_ACCESS_KEY set, every call carries it as X-Studio-Key.
const KEY = "studio-access-key";

export const getKey = () => sessionStorage.getItem(KEY) || localStorage.getItem(KEY) || "";
export const setKey = (key, remember) => { clearKey(); (remember ? localStorage : sessionStorage).setItem(KEY, key); };
export const clearKey = () => { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); };

export class Unauthorized extends Error { name = "Unauthorized"; }

async function call(path, options = {}, key = getKey()) {
  const headers = { ...(options.headers || {}) };
  if (key) headers["X-Studio-Key"] = key;
  let res;
  try { res = await fetch(`/api/studio${path}`, { ...options, headers }); }
  catch { throw new Error("Can't reach the server. Check that the backend is running."); }
  return res;
}

async function request(path, options = {}, key) {
  const res = await call(path, options, key);
  let data = null;
  try { data = await res.json(); } catch { /* an empty or non-JSON answer */ }
  if (res.status === 401) { window.dispatchEvent(new Event("studio:unauthorized")); throw new Unauthorized(data?.detail || "Enter the Story Studio access key."); }
  if (!res.ok) {
    const d = data?.detail;
    throw new Error(typeof d === "string" ? d : Array.isArray(d) ? d.map((x) => x.msg).join(", ") : `Request failed (${res.status})`);
  }
  return data;
}

const json = (body, method = "POST") => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const post = (path) => request(path, { method: "POST" });

// Save a file the server sends. A plain link can't carry the access key, so the file is fetched and saved from here.
async function download(path, fallbackName) {
  const res = await call(path);
  if (res.status === 401) { window.dispatchEvent(new Event("studio:unauthorized")); throw new Unauthorized("Enter the Story Studio access key."); }
  if (!res.ok) { let d = ""; try { d = (await res.json()).detail; } catch { /* not JSON */ } throw new Error(d || "That file isn't available yet."); }
  const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") || "")?.[1] || fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const studio = {
  status: () => request("/status"),
  session: (key) => request("/session", {}, key),
  options: () => request("/options"),
  stories: () => request("/stories"),
  story: (id) => request(`/stories/${id}`),
  create: (brief) => request("/stories", json(brief)),
  remove: (id) => request(`/stories/${id}`, { method: "DELETE" }),
  writeStage: (id, stage, direction = "", retry = false) => request(`/stories/${id}/stages/${stage}/generate`, json({ direction, retry })),
  acceptStage: (id, stage, content = null) => request(`/stories/${id}/stages/${stage}/accept`, json({ content })),
  refreshFacts: (id, stage) => post(`/stories/${id}/stages/${stage}/facts`),
  writeStory: (id) => post(`/stories/${id}/story/generate`),
  validate: (id) => post(`/stories/${id}/story/validate`),
  revise: (id, instruction) => request(`/stories/${id}/story/revise`, json({ instruction })),
  undo: (id) => post(`/stories/${id}/story/undo`),
  acceptStory: (id) => post(`/stories/${id}/story/accept`),
  writeScreenplay: (id, restart = false) => request(`/stories/${id}/screenplay/generate`, json({ restart })),
  downloadFile: (id, name) => download(`/stories/${id}/files/${name}`, name),
  downloadProject: (id) => download(`/stories/${id}/export`, "story-project.zip"),
};
