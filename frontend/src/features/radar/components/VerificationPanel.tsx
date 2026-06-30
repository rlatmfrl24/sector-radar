import { ShieldCheck } from "lucide-react";

import type { ValidationResponse } from "../../../types";

export function VerificationPanel({ validation }: { validation: ValidationResponse | null }) {
  const coverage = validation?.coverage;
  return (
    <article className="verification-panel dashboard-card">
      <div>
        <ShieldCheck size={14} />
        <span>검증 상태</span>
        <strong>{validationStatusLabel(validation?.status)}</strong>
      </div>
      <p>이력 진단 결과는 표본 관측 확률과 신뢰도를 함께 표시합니다. 현재 화면의 판단 문구는 규칙과 패턴 근거만 사용합니다.</p>
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

function validationStatusLabel(status?: string) {
  if (!status || status === "unvalidated") return "검증 전";
  if (status === "historical_ready") return "이력 진단 완료";
  if (status === "insufficient_history") return "표본 부족";
  return status;
}
