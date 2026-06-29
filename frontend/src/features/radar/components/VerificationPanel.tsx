import { ShieldCheck } from "lucide-react";

import type { ValidationResponse } from "../../../types";

export function VerificationPanel({ validation }: { validation: ValidationResponse | null }) {
  const coverage = validation?.coverage;
  return (
    <article className="verification-panel dashboard-card">
      <div>
        <ShieldCheck size={14} />
        <span>Validation</span>
        <strong>{validation?.status ?? "unvalidated"}</strong>
      </div>
      <p>Walk-forward 검증 전에는 확률, 승률, 기대수익률을 판단 문구에 쓰지 않습니다.</p>
      <dl>
        <div>
          <dt>sector samples</dt>
          <dd>{coverage?.sector_snapshots ?? 0}</dd>
        </div>
        <div>
          <dt>history days</dt>
          <dd>{coverage?.sector_history_days ?? 0}</dd>
        </div>
      </dl>
    </article>
  );
}
