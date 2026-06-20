export type RiskLevel = "verified" | "incomplete" | "unverified" | "suspicious";

export interface TimelineEvent {
  id: string;
  timestamp: string;
  type: "tool_call" | "terminal" | "file_change" | "test" | "screenshot" | "api" | "claim";
  action: string;
  detail?: string;
  evidence?: boolean;
}

export interface ClaimValidation {
  claim: string;
  checks: { label: string; passed: boolean; required: boolean }[];
  verdict: RiskLevel;
  message: string;
}

export interface FlightRecord {
  runId: string;
  startedAt: string;
  timeline: TimelineEvent[];
  claims: ClaimValidation[];
}

export function parseAgentLogs(logs: string): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const lines = logs.split("\n").filter(Boolean);
  let i = 0;
  for (const line of lines) {
    const toolMatch = line.match(/tool[_\s]?call[:\s]+(\w+)/i) || line.match(/called\s+(\w+)/i);
    const claimMatch = line.match(/claim[:\s]+(.+)/i) || line.match(/completed[:\s]+(.+)/i);
    if (toolMatch) {
      events.push({ id: `e${i++}`, timestamp: new Date().toISOString(), type: "tool_call", action: toolMatch[1], evidence: true });
    } else if (claimMatch) {
      events.push({ id: `e${i++}`, timestamp: new Date().toISOString(), type: "claim", action: claimMatch[1].trim(), evidence: false });
    } else if (line.trim()) {
      events.push({ id: `e${i++}`, timestamp: new Date().toISOString(), type: "tool_call", action: line.trim().slice(0, 80), evidence: true });
    }
  }
  return events;
}

export function parseTerminalOutput(output: string): TimelineEvent[] {
  return output.split("\n").filter((l) => l.startsWith("$") || l.includes("npm") || l.includes("git")).map((l, i) => ({
    id: `t${i}`, timestamp: new Date().toISOString(), type: "terminal" as const, action: l.replace(/^\$\s*/, ""), evidence: true,
  }));
}

export function parseGitDiff(diff: string): TimelineEvent[] {
  const files = [...diff.matchAll(/^diff --git a\/(.+?) b\//gm)].map((m) => m[1]);
  return files.map((f, i) => ({ id: `g${i}`, timestamp: new Date().toISOString(), type: "file_change" as const, action: `Modified: ${f}`, detail: f, evidence: true }));
}

export function parseTestOutput(output: string): TimelineEvent[] {
  const passed = /(\d+)\s+passed/i.exec(output)?.[1] ?? "0";
  const failed = /(\d+)\s+failed/i.exec(output)?.[1] ?? "0";
  const ok = failed === "0" && parseInt(passed) > 0;
  return [{ id: "test0", timestamp: new Date().toISOString(), type: "test", action: `${passed} passed, ${failed} failed`, evidence: ok }];
}

export function buildTimeline(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function validateClaim(
  claim: string,
  evidence: { tests?: boolean; browser?: boolean; db?: boolean; screenshot?: boolean; api?: boolean }
): ClaimValidation {
  const checks = [
    { label: "Test executed", passed: !!evidence.tests, required: true },
    { label: "Browser verified", passed: !!evidence.browser, required: claim.toLowerCase().includes("flow") || claim.toLowerCase().includes("ui") },
    { label: "DB state checked", passed: !!evidence.db, required: claim.toLowerCase().includes("login") || claim.toLowerCase().includes("data") },
    { label: "Screenshot exists", passed: !!evidence.screenshot, required: false },
    { label: "API response verified", passed: !!evidence.api, required: claim.toLowerCase().includes("api") },
  ];

  const requiredFails = checks.filter((c) => c.required && !c.passed);
  const requiredPasses = checks.filter((c) => c.required && c.passed);
  const anyPass = checks.some((c) => c.passed);

  let verdict: RiskLevel = "verified";
  let message = "Claim supported by evidence";
  if (requiredFails.length > 0) {
    verdict = "incomplete";
    message = `Incomplete claim: missing ${requiredFails.map((c) => c.label.toLowerCase()).join(", ")}`;
  } else if (!anyPass) {
    verdict = "unverified";
    message = "No evidence provided for claim";
  } else if (requiredPasses.length > 0 && requiredFails.length === 0) {
    verdict = "verified";
    message = "All required evidence present";
  } else if (checks.filter((c) => !c.required && !c.passed).length > 3) {
    verdict = "suspicious";
    message = "Partial evidence — claim may be overstated";
  }

  return { claim, checks, verdict, message };
}

export function generateEvidenceMd(record: FlightRecord): string {
  const lines = ["# Agent Run Evidence", "", `Run: ${record.runId}`, `Started: ${record.startedAt}`, "", "## Timeline", ""];
  for (const e of record.timeline) {
    lines.push(`- [${e.type}] ${e.action}${e.evidence ? " ✓" : ""}`);
  }
  lines.push("", "## Claim Validations", "");
  for (const c of record.claims) {
    lines.push(`### ${c.claim}`);
    lines.push(`**Verdict:** ${c.verdict} — ${c.message}`, "");
    for (const ch of c.checks) {
      lines.push(`- [${ch.passed ? "x" : " "}] ${ch.label}${ch.required ? " (required)" : ""}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function generateSuspiciousClaimReport(claims: ClaimValidation[]): string {
  const bad = claims.filter((c) => c.verdict !== "verified");
  if (!bad.length) return "# Suspicious Claim Report\n\nNo suspicious claims detected.";
  const lines = ["# Suspicious Claim Report", ""];
  for (const c of bad) {
    lines.push(`## ${c.claim}`, `**Verdict:** ${c.verdict}`, c.message, "");
    lines.push("Missing:", ...c.checks.filter((ch) => !ch.passed).map((ch) => `- ${ch.label}`), "");
  }
  return lines.join("\n");
}

export function buildFlightRecord(inputs: {
  logs?: string; terminal?: string; diff?: string; tests?: string; claim?: string;
  evidence?: { tests?: boolean; browser?: boolean; db?: boolean; screenshot?: boolean };
}): FlightRecord {
  const events = buildTimeline([
    ...parseAgentLogs(inputs.logs ?? ""),
    ...parseTerminalOutput(inputs.terminal ?? ""),
    ...parseGitDiff(inputs.diff ?? ""),
    ...parseTestOutput(inputs.tests ?? ""),
  ]);

  const claims: ClaimValidation[] = [];
  if (inputs.claim) {
    claims.push(validateClaim(inputs.claim, {
      tests: inputs.evidence?.tests ?? inputs.tests?.includes("passed") ?? false,
      browser: inputs.evidence?.browser ?? false,
      db: inputs.evidence?.db ?? false,
      screenshot: inputs.evidence?.screenshot ?? false,
    }));
  }

  const claimEvents = events.filter((e) => e.type === "claim");
  for (const e of claimEvents) {
    if (!claims.some((c) => c.claim === e.action)) {
      claims.push(validateClaim(e.action, { tests: events.some((ev) => ev.type === "test" && ev.evidence) }));
    }
  }

  return {
    runId: `run-${Date.now()}`,
    startedAt: new Date().toISOString(),
    timeline: events,
    claims,
  };
}