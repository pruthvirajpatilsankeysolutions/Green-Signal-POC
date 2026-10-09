// Calendar tear-off style date: big day number, month below.
export default function DateBlock({ date }) {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return <span className="date-block">{date}</span>;
  return (
    <span className="date-block" aria-label={d.toDateString()}>
      <span className="date-month">{d.toLocaleDateString("en-IN", { month: "short" })}</span>
      <span className="date-day">{d.getDate()}</span>
      <span className="date-year">{d.getFullYear()}</span>
    </span>
  );
}