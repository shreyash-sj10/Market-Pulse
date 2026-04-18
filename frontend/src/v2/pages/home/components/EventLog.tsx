import type { EventLogEntryVM } from "../mapHomeViewModel";

type EventLogProps = {
  entries: EventLogEntryVM[];
  /** Tighter vertical rhythm (e.g. portfolio context rail). */
  dense?: boolean;
};

export default function EventLog({ entries, dense }: EventLogProps) {
  const rootCls = dense ? "home-event-log home-event-log--dense" : "home-event-log";

  if (entries.length === 0) {
    return (
      <div className={rootCls}>
        <p className="home-event-log__empty">No log lines — stream not initialized</p>
      </div>
    );
  }

  return (
    <div className={rootCls}>
      <ul className="home-event-log__list">
        {entries.map((e) => {
          const t = e.type.toUpperCase();
          const typeClass =
            t === "WARN" || t === "ERR" || t === "ERROR"
              ? "home-event-log__type home-event-log__type--warn"
              : t === "CHECK" || t === "EXEC"
                ? "home-event-log__type home-event-log__type--check"
                : t === "INFO" || t === "DECISION"
                  ? "home-event-log__type home-event-log__type--info"
                  : "home-event-log__type";
          return (
            <li key={e.id} className="home-event-log__row">
              <span className="home-event-log__time">{e.time}</span>
              <span className={typeClass}>[{e.type}]</span>
              <span className="home-event-log__msg">{e.message}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
