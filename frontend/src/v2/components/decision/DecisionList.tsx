import { useMemo } from "react";
import {
  DATA_UNAVAILABLE_COPY,
  EMPTY_STATE_COPY,
  FALLBACK_DATA_COPY,
} from "../../copy/uiCopy";
import DecisionCard, { type DecisionCardProps } from "./DecisionCard";

type Props = {
  items: DecisionCardProps[];
  isLoading?: boolean;
  isError?: boolean;
  isDegraded?: boolean;
};

const ORDER = { ACT: 0, GUIDE: 1, BLOCK: 2 } as const;

function DecisionListSkeleton() {
  return (
    <div className="decision-list decision-list--skeleton" aria-busy="true" aria-label="Loading decisions">
      {[0, 1, 2].map((i) => (
        <div key={i} className="decision-list-skeleton-card card" />
      ))}
    </div>
  );
}

export default function DecisionList({
  items,
  isLoading = false,
  isError = false,
  isDegraded = false,
}: Props) {
  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const da = ORDER[a.decision.action];
      const db = ORDER[b.decision.action];
      if (da !== db) return da - db;
      return b.decision.confidence - a.decision.confidence;
    });
  }, [items]);

  const showFallbackBanner = isDegraded;
  const showPartialErrorBanner = isError && items.length > 0 && !isDegraded;

  if (isLoading && items.length === 0) {
    return <DecisionListSkeleton />;
  }

  if (isError && items.length === 0) {
    return (
      <div className="decision-list">
        <div className="card page-note decision-list-error" role="alert">
          {DATA_UNAVAILABLE_COPY}
        </div>
      </div>
    );
  }

  if (!isLoading && items.length === 0) {
    return (
      <div className="decision-list">
        <div className="card page-note">{EMPTY_STATE_COPY}</div>
      </div>
    );
  }

  return (
    <div className="decision-list">
      {showFallbackBanner ? (
        <p className="data-degraded-banner page-note" role="status">
          {FALLBACK_DATA_COPY}
        </p>
      ) : null}
      {showPartialErrorBanner ? (
        <p className="data-degraded-banner page-note" role="alert">
          {DATA_UNAVAILABLE_COPY}
        </p>
      ) : null}
      {sorted.map((item, index) => (
        <DecisionCard
          key={`${item.title}-${item.decision.action}-${item.decision.confidence}-${index}`}
          title={item.title}
          decision={item.decision}
          meta={item.meta}
          onPrimaryAction={item.onPrimaryAction}
        />
      ))}
    </div>
  );
}
