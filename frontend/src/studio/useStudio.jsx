import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useMatch, useNavigate } from "react-router-dom";
import { studio } from "./api.js";
import { SP, progressOf } from "./data.js";

const Ctx = createContext(null);
export const useStudio = () => useContext(Ctx);
const useWide = () => {
  const [wide, setWide] = useState(() => window.matchMedia("(min-width: 901px)").matches);
  useEffect(() => { const m = window.matchMedia("(min-width: 901px)"); const f = () => setWide(m.matches); m.addEventListener("change", f); return () => m.removeEventListener("change", f); }, []);
  return wide;
};

// Everything the Story Studio pages share: the list, the selected story, filters, and every action (so each one is handled the same way).
export function StudioProvider({ children }) {
  const navigate = useNavigate();
  const match = useMatch(`${SP}/story/:id/*`);
  const routeId = match?.params.id || null;
  const wide = useWide();
  const [options, setOptions] = useState(null);
  const [stories, setStories] = useState(null);
  const [story, setStory] = useState(null);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("recent");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [loadError, setLoadError] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const searchRef = useRef(null);

  const flash = useCallback((message) => { setToast(message); clearTimeout(flash.t); flash.t = setTimeout(() => setToast(""), 3200); }, []);
  const refreshList = useCallback(() => studio.stories().then((d) => { setStories(d.stories); setLoadError(""); }).catch((e) => { if (e.name !== "Unauthorized") setLoadError(e.message); }), []);

  const visible = useMemo(() => {
    const text = q.trim().toLowerCase();
    let a = (stories || []).filter((s) =>
      (filter === "all" || (filter === "screen" ? s.has_screenplay : s.state === filter)) &&
      (!text || `${s.title} ${s.content_type} ${s.language}`.toLowerCase().includes(text)));
    if (sort === "title") a = [...a].sort((x, y) => x.title.localeCompare(y.title));
    else if (sort === "progress") a = [...a].sort((x, y) => progressOf(y) - progressOf(x));
    return a;
  }, [stories, filter, q, sort]);

  const selectedId = routeId || (wide ? visible[0]?.id || null : null);

  useEffect(() => { studio.options().then(setOptions).catch(() => {}); refreshList(); }, [refreshList]);
  useEffect(() => {                                              // open the selected story
    if (!selectedId) { setStory(null); return undefined; }
    let alive = true;
    setStory((s) => (s && s.id === selectedId ? s : null));
    studio.story(selectedId).then((d) => alive && setStory(d)).catch((e) => { if (alive && e.message === "Story not found.") navigate(SP, { replace: true }); });
    return () => { alive = false; };
  }, [selectedId, navigate]);

  // a step that calls the AI runs in the background: look again every 1.5 seconds until it is done
  const running = story?.job?.status === "running";
  useEffect(() => {
    if (!running) return undefined;
    const t = setTimeout(() => { studio.story(story.id).then((d) => { setStory(d); if (d.job?.status !== "running") refreshList(); }).catch(() => {}); }, 1500);
    return () => clearTimeout(t);
  }, [running, story, refreshList]);
  const anyWorking = (stories || []).some((s) => s.working);
  useEffect(() => { if (!anyWorking) return undefined; const t = setInterval(refreshList, 4000); return () => clearInterval(t); }, [anyWorking, refreshList]);

  // every action: sets "busy", shows a plain message if it fails, refreshes what changed
  const act = useCallback(async (label, fn) => {
    setBusy(label); setError("");
    try {
      const next = await fn(studio);
      if (next?.id) setStory(next);
      refreshList();
      return next;
    } catch (e) {
      if (e.name !== "Unauthorized") { setError(e.message); flash(e.message); }
      return null;
    } finally { setBusy(""); }
  }, [refreshList, flash]);

  const create = async (brief) => {
    const next = await studio.create(brief);                      // errors are shown by the form
    setStory(next); refreshList(); navigate(`${SP}/story/${next.id}`);
    return next;
  };
  const remove = async (id) => {
    await act("delete", (api) => api.remove(id));
    setStory(null); navigate(SP); refreshList();
  };
  const save = (id, name, label) => studio.downloadFile(id, name).catch((e) => flash(e.message || `Could not download ${label}.`));
  const saveProject = (id) => studio.downloadProject(id).catch((e) => flash(e.message));
  const open = (id) => navigate(`${SP}/story/${id}`);

  const value = { options, stories, story, visible, selectedId, filter, setFilter, q, setQ, sort, setSort, busy, error, setError, toast, flash, loadError,
                  act, create, remove, save, saveProject, open, refreshList, wide, searchRef, routeId, newOpen, setNewOpen, helpOpen, setHelpOpen };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
