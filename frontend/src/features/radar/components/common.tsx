import type { ModuleState } from "../../../types";

export function LayerHeader({
  description,
  eyebrow,
  meta,
  title,
}: {
  description: string;
  eyebrow: string;
  meta: string;
  title: string;
}) {
  return (
    <div className="layer-header">
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <small>{meta}</small>
    </div>
  );
}

export function PanelHeader({
  eyebrow,
  inverted = false,
  meta,
  title,
}: {
  eyebrow: string;
  inverted?: boolean;
  meta: string;
  title: string;
}) {
  return (
    <div className={`panel-header ${inverted ? "inverted" : ""}`}>
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      <small>{meta}</small>
    </div>
  );
}

export function ModuleMeter({
  compact = false,
  label,
  module,
}: {
  compact?: boolean;
  label: string;
  module: ModuleState;
}) {
  return (
    <div className={`module-meter ${compact ? "compact" : ""}`}>
      <div>
        <strong>{label}</strong>
        <span>{module.state}</span>
      </div>
      <div className="meter-track">
        <i style={{ width: `${Math.min(100, Math.max(12, module.strength * 25))}%` }} />
      </div>
      <small>{module.transition}</small>
    </div>
  );
}

export function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
