import { describe, expect, it } from "vitest";
import {
  buildFlightRecord,
  generateEvidenceMd,
  generateSuspiciousClaimReport,
  parseAgentLogs,
  parseGitDiff,
  parseTestOutput,
  validateClaim,
} from "./recorder";

describe("agent-flight-recorder", () => {
  it("parses agent logs", () => {
    const events = parseAgentLogs("tool_call: read_file\nclaim: Login flow fixed");
    expect(events.length).toBe(2);
  });

  it("parses git diff", () => {
    const events = parseGitDiff("diff --git a/src/auth.ts b/src/auth.ts");
    expect(events[0].action).toContain("auth.ts");
  });

  it("parses test output", () => {
    const events = parseTestOutput("Tests: 5 passed, 0 failed");
    expect(events[0].evidence).toBe(true);
  });

  it("validates incomplete login claim", () => {
    const v = validateClaim("Login flow fixed", { tests: true, browser: false, db: false, screenshot: true });
    expect(v.verdict).toBe("incomplete");
  });

  it("validates complete claim", () => {
    const v = validateClaim("API endpoint added", { tests: true, api: true });
    expect(v.verdict).toBe("verified");
  });

  it("builds flight record", () => {
    const record = buildFlightRecord({
      logs: "claim: Login flow fixed",
      tests: "3 passed, 0 failed",
      claim: "Login flow fixed",
      evidence: { tests: true, screenshot: true },
    });
    expect(record.timeline.length).toBeGreaterThan(0);
    expect(record.claims.length).toBeGreaterThan(0);
  });

  it("generates evidence markdown", () => {
    const record = buildFlightRecord({ claim: "Done", tests: "1 passed" });
    const md = generateEvidenceMd(record);
    expect(md).toContain("# Agent Run Evidence");
  });

  it("generates suspicious report", () => {
    const v = validateClaim("Login flow fixed", { tests: true, browser: false, db: false });
    const md = generateSuspiciousClaimReport([v]);
    expect(md).toContain("incomplete");
  });
});