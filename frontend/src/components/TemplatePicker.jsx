import { useEffect, useState } from "react";
import { LayoutTemplate } from "lucide-react";
import { api } from "../api.js";

// Pick a saved template for this post, or the standard design. Hidden when no template fits.
export default function TemplatePicker({ occasion = "", postType = "", value, onChange }) {
    const [list, setList] = useState([]);
    useEffect(() => {
        api.templatesForPost({ occasion, postType }).then((d) => setList(d.templates)).catch(() => setList([]));
    }, [occasion, postType]);
    if (!list.length) return null;
    return (
        <div className="field">
            <span className="field-label">Design: standard, or one of your templates</span>
            <div className="tpl-pick">
                <button className={!value ? "on" : ""} onClick={() => onChange("")} aria-pressed={!value}>
                    <span className="std"><LayoutTemplate size={20} aria-hidden="true" /> Standard design</span>Standard
                </button>
                {list.map((t) => (
                    <button key={t.id} className={value === t.id ? "on" : ""} onClick={() => onChange(t.id, t)} aria-pressed={value === t.id} title={t.name}>
                        <img src={t.thumbnail_url} alt="" />{t.name}
                    </button>
                ))}
            </div>
        </div>
    );
}