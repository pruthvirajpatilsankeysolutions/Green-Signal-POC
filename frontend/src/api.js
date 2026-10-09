// All calls to the Python API in one place.
async function request(path, options = {}) {
    const res = await fetch(path, options);
    let data = null;
    try {
        data = await res.json();
    } catch {
        /* empty or non-JSON response */
    }
    if (!res.ok) {
        const detail = data?.detail;
        const message = typeof detail === "string" ? detail
            : Array.isArray(detail) ? detail.map((d) => d.msg).join(", ")
                : `Request failed (${res.status})`;
        throw new Error(message);
    }
    return data;
}

const json = (body) => ({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
});

export const api = {
    status: () => request("/api/status"),

    festivals: () => request("/api/festivals"),
    backgrounds: (fid) => request(`/api/festivals/${fid}/backgrounds`),
    uploadBackground: (fid, file) => {
        const form = new FormData();
        form.append("file", file);
        return request(`/api/festivals/${fid}/backgrounds`, { method: "POST", body: form });
    },
    generateBackgrounds: (fid, layout) => request(`/api/festivals/${fid}/backgrounds/generate`, json({ layout })),
    createFestivalPost: (fid, body) => request(`/api/festivals/${fid}/posts`, json(body)),

    createEvent: (form) => request("/api/events", { method: "POST", body: form }),

    checkFacts: (body) => request("/api/reactions/check", json(body)),
    createReaction: (form) => request("/api/reactions", { method: "POST", body: form }),

    drafts: (status) => request(`/api/drafts${status ? `?status=${status}` : ""}`),
    approve: (id) => request(`/api/drafts/${id}/approve`, { method: "POST" }),
    reject: (id) => request(`/api/drafts/${id}/reject`, { method: "POST" }),
    rewrite: (id, instruction) => request(`/api/drafts/${id}/rewrite`, json({ instruction })),
};