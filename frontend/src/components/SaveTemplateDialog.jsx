import { useState } from "react";
import { Save, X } from "lucide-react";

// "Save template" options: name, which posts it is for, which client types, only this client.
export default function SaveTemplateDialog({ template, choices, busy, onSave, onClose }) {
    const all = !template.occasions?.length;
    const [name, setName] = useState(template.name || "");
    const [forAll, setForAll] = useState(all);
    const [picked, setPicked] = useState(new Set(template.occasions || []));
    const [types, setTypes] = useState(new Set(template.client_types || []));
    const [onlyThis, setOnlyThis] = useState(!!template.only_this_client);
    const toggle = (set, setter, id) => { const n = new Set(set); n.has(id) ? n.delete(id) : n.add(id); setter(n); };

    const save = () => onSave({
        name: name.trim() || template.name,
        occasions: forAll ? [] : [...picked],
        client_types: [...types],
        only_this_client: onlyThis,
    });
    const nothingPicked = !forAll && picked.size === 0;

    return (
        <div className="dlg-backdrop" role="dialog" aria-modal="true" aria-label="Save template">
            <div className="dlg">
                <div className="dlg-head"><h2>Save template</h2><button className="dlg-x" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
                <label className="field"><span className="field-label">Template name</span>
                    <input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>

                <div className="field">
                    <span className="field-label">Use this template for</span>
                    <label className="check"><input type="radio" name="use" checked={forAll} onChange={() => setForAll(true)} /> All posts</label>
                    <label className="check"><input type="radio" name="use" checked={!forAll} onChange={() => setForAll(false)} /> Only these:</label>
                    {!forAll && (
                        <div className="dlg-choices">
                            {choices.post_types.map((p) => (
                                <label key={p.id} className="check"><input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(picked, setPicked, p.id)} /> {p.label}</label>
                            ))}
                            <div className="dlg-sub">Or specific festivals:</div>
                            <div className="dlg-scroll">
                                {choices.festivals.map((f) => (
                                    <label key={f.id} className="check"><input type="checkbox" checked={picked.has(f.id)} onChange={() => toggle(picked, setPicked, f.id)} />
                                        {f.name} <span className="muted">{f.date}</span></label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="field">
                    <span className="field-label">Client types <span className="muted">(none ticked = all types)</span></span>
                    <div className="dlg-row">
                        {choices.client_types.map((c) => (
                            <label key={c.id} className="check"><input type="checkbox" checked={types.has(c.id)} onChange={() => toggle(types, setTypes, c.id)} /> {c.label}</label>
                        ))}
                    </div>
                </div>

                <label className="check"><input type="checkbox" checked={onlyThis} onChange={(e) => setOnlyThis(e.target.checked)} />
                    Only for this client ({template.client_name})</label>

                {nothingPicked && <p className="hint">Tick at least one post type or festival, or choose All posts.</p>}
                <div className="actions end">
                    <button className="btn" onClick={onClose}>Cancel</button>
                    <button className="btn primary" onClick={save} disabled={busy || nothingPicked}><Save size={16} aria-hidden="true" /> {busy ? "Saving…" : "Save template"}</button>
                </div>
            </div>
        </div>
    );
}