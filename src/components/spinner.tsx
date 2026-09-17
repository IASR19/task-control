const DOTS = [
  "#eef8f9",
  "#cfecee",
  "#a9dce1",
  "#7fc8d0",
  "#58b3bd",
  "#3b9aa4",
  "#2b818b",
  "#236d75",
  "#1c5a61",
  "#174b51",
  "#143f44",
  "#12363a",
];

export function Spinner({
  label,
  size = 56,
}: {
  label?: string;
  size?: number;
}) {
  return (
    <div className="page-loading" role="status" aria-live="polite" aria-label={label ?? "Carregando"}>
      <div className="dot-spinner" style={{ width: size, height: size }} aria-hidden>
        {DOTS.map((color, index) => (
          <span
            key={color}
            style={{
              background: color,
              ["--i" as string]: index,
            }}
          />
        ))}
      </div>
      {label ? <p className="kicker">{label}</p> : null}
    </div>
  );
}
