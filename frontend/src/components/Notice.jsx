export default function Notice({ kind = "info", children }) {
  if (!children) return null;
  return <div className={`notice ${kind}`} role={kind === "error" ? "alert" : "status"}>{children}</div>;
}