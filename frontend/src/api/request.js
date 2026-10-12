// Shared request helper: sends the selected client with every call
// and turns API errors into readable messages.
export const getClientId = () => localStorage.getItem("clientId") || "";
export const setClientId = (id) => localStorage.setItem("clientId", id);

export async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (getClientId()) headers["X-Client-Id"] = getClientId();
  const res = await fetch(path, { ...options, headers });
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

export const json = (body, method = "POST") => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});