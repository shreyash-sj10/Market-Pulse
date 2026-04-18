import { Loader } from "lucide-react";
import type { PreTradeResult } from "../../../api/trade.api";

type Snap = PreTradeResult["data"]["snapshot"] | null;

export type RiskValidatorProps = {
  mode: "local" | "server";
  side: "BUY" | "SELL";
  price: string;
  quantity: string;
  stopLoss: string;
  target: string;
  thesis: string;
  thesisMin: number;
  /** Profile-linked: single-lot until journal unlock. */
  scalingBlocked?: boolean;
  snapshot: Snap;
  authorityVerdict: string | null;
  analyzing: boolean;
};

type Line = { key: string; severity: "pass" | "warn" | "block"; text: string };

function ValidatorRow({ severity, text }: { severity: Line["severity"]; text: string }) {
  const glyph = severity === "pass" ? "✔" : severity === "block" ? "✖" : "⚠";
  return (
    <div className={`trade-terminal-line trade-terminal-line--${severity}`}>
      <span className={`trade-terminal-line__glyph trade-terminal-line__glyph--${severity}`} aria-hidden>
        {glyph}
      </span>
      <span className="trade-terminal-line__text">{text}</span>
    </div>
  );
}

function push(lines: Line[], severity: Line["severity"], text: string): void {
  lines.push({ key: `line_${lines.length}_${severity}`, severity, text });
}

function buildLocalLines(p: Omit<RiskValidatorProps, "mode" | "snapshot" | "authorityVerdict" | "analyzing">): Line[] {
  const lines: Line[] = [];
  const qty = parseInt(p.quantity || "0", 10);
  const ep = parseFloat(p.price || "0");
  const sl = parseFloat(p.stopLoss || "0");
  const tp = parseFloat(p.target || "0");
  const thesisOk = p.thesis.trim().length >= p.thesisMin;

  if (p.scalingBlocked && qty > 1) {
    push(lines, "block", "Scaling policy: journal/profile lock — use quantity 1 until unlock streak.");
  }

  if (qty <= 0) push(lines, "block", "Position size: quantity must be at least 1 share.");
  else push(lines, "pass", `Position size: ${qty} share(s).`);

  if (ep <= 0) push(lines, "block", "Exposure: enter a positive limit price.");
  else {
    const notional = ep * Math.max(qty, 0);
    push(lines, "pass", `Exposure: ~₹${notional.toLocaleString("en-IN", { maximumFractionDigits: 0 })} notional.`);
    if (notional > 750_000) {
      push(lines, "warn", "Exposure: notional is elevated for one ticket.");
    }
  }

  if (!thesisOk) {
    push(lines, "warn", `Thesis: minimum ${p.thesisMin} characters required.`);
  } else {
    push(lines, "pass", "Thesis: minimum length satisfied.");
  }

  if (p.side === "BUY") {
    if (sl <= 0 || tp <= 0) {
      push(lines, "block", "Stop loss and target required for buys.");
    } else if (ep > 0) {
      if (sl >= ep) push(lines, "block", "Stop loss must be below limit entry.");
      else if (tp <= ep) push(lines, "block", "Target must be above limit entry.");
      else push(lines, "pass", "Risk bracket: stop and target frame entry.");
    }
  }
  return lines;
}

function buildServerLines(snapshot: NonNullable<Snap>): Line[] {
  const lines: Line[] = [];
  const pillars = snapshot.pillars;
  const addPillar = (label: string, status?: string, reasoning?: string) => {
    if (!status && !reasoning) return;
    const st = String(status || "").toUpperCase();
    const bad = st === "CONFLICTED" || st === "COMPROMISED" || st === "POOR";
    const good = st === "ALIGNED" || st === "STRONG" || st === "DISCIPLINED" || st === "OPTIMAL";
    push(lines, bad ? "warn" : good ? "pass" : "warn", `${label} — ${reasoning || status || "—"}`);
  };
  addPillar("Market alignment", pillars?.marketAlignment?.status, pillars?.marketAlignment?.reasoning);
  addPillar("Sector correlation", pillars?.sectorCorrelation?.status, pillars?.sectorCorrelation?.reasoning);
  addPillar("Behavioral risk", pillars?.behavioralRisk?.status, pillars?.behavioralRisk?.reasoning);
  addPillar("R:R quality", pillars?.rrQuality?.status, pillars?.rrQuality?.reasoning);
  return lines;
}

export default function RiskValidator({
  mode,
  side,
  price,
  quantity,
  stopLoss,
  target,
  thesis,
  thesisMin,
  scalingBlocked,
  snapshot,
  authorityVerdict,
  analyzing,
}: RiskValidatorProps) {
  if (analyzing) {
    return (
      <div className="trade-terminal-risk-loading">
        <Loader size={18} className="trade-terminal-loader" aria-hidden />
        <span>Running system checks…</span>
      </div>
    );
  }

  if (mode === "local") {
    return (
      <div className="trade-terminal-eval-details">
        {buildLocalLines({ side, price, quantity, stopLoss, target, thesis, thesisMin, scalingBlocked }).map((l) => (
          <ValidatorRow key={l.key} severity={l.severity} text={l.text} />
        ))}
      </div>
    );
  }

  if (!snapshot) {
    return <p className="trade-terminal-note">Run ANALYZE RISK to load engine output.</p>;
  }

  return (
    <div className="trade-terminal-risk-server">
      <div className="trade-terminal-risk-summary">
        <div>
          <span className="trade-terminal-risk-label">Risk score</span>
          <span className="trade-terminal-risk-value">{snapshot.risk?.score ?? "—"}</span>
        </div>
        <div>
          <span className="trade-terminal-risk-label">Authority</span>
          <span className="trade-terminal-risk-value">{authorityVerdict ?? "—"}</span>
        </div>
        {snapshot.risk?.rr != null && snapshot.risk.rr > 0 ? (
          <div>
            <span className="trade-terminal-risk-label">R:R</span>
            <span className="trade-terminal-risk-value">{snapshot.risk.rr.toFixed(2)}:1</span>
          </div>
        ) : null}
      </div>
      {snapshot.risk?.reason ? <p className="trade-terminal-risk-reason">{snapshot.risk.reason}</p> : null}
      <div className="trade-terminal-eval-details">
        {buildServerLines(snapshot).map((l) => (
          <ValidatorRow key={l.key} severity={l.severity} text={l.text} />
        ))}
      </div>
      {(snapshot.behavior?.flags?.length ?? 0) > 0 ? (
        <>
          <p className="trade-terminal-subkicker">Flags</p>
          <div className="trade-terminal-eval-details">
            {snapshot.behavior!.flags.map((f) => (
              <ValidatorRow key={f} severity="warn" text={f.replace(/_/g, " ")} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
