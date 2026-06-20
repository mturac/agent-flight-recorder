"use client";

import { useMemo, useState } from "react";
import { buildFlightRecord, generateEvidenceMd, generateSuspiciousClaimReport } from "@/lib/recorder";

const verdictColor: Record<string, string> = {
  verified: "text-green-400 border-green-500/40 bg-green-500/10",
  incomplete: "text-amber-400 border-amber-500/40 bg-amber-500/10",
  unverified: "text-red-400 border-red-500/40 bg-red-500/10",
  suspicious: "text-orange-400 border-orange-500/40 bg-orange-500/10",
};

export default function Home() {
  const [claim, setClaim] = useState("Login flow fixed");
  const [tests, setTests] = useState("Tests: 5 passed, 0 failed");
  const [logs, setLogs] = useState("tool_call: run_tests\nclaim: Login flow fixed");
  const [evidence, setEvidence] = useState({ tests: true, browser: false, db: false, screenshot: true, api: false });

  const record = useMemo(
    () => buildFlightRecord({ logs, tests, claim, evidence }),
    [logs, tests, claim, evidence]
  );

  return (
    <div className="min-h-screen bg-[#080c08] text-slate-200">
      <header className="border-b border-green-900/40 bg-black/40 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
          <h1 className="text-xl font-bold text-green-100">agent-flight-recorder</h1>
          <span className="text-green-700 text-sm">Black-box runtime evidence</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 grid lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <Field label="Agent Claim" value={claim} onChange={setClaim} />
          <Field label="Agent Logs" value={logs} onChange={setLogs} rows={4} />
          <Field label="Test Output" value={tests} onChange={setTests} rows={2} />
          <div className="p-4 rounded-xl border border-green-900/30 bg-green-950/20">
            <p className="text-sm text-green-600 mb-3">Evidence Checklist</p>
            {(["tests", "browser", "db", "screenshot", "api"] as const).map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                <input type="checkbox" checked={evidence[k]} onChange={(e) => setEvidence({ ...evidence, [k]: e.target.checked })} className="accent-green-500" />
                {k.replace("_", " ")}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <section>
            <h2 className="text-sm uppercase tracking-wider text-green-700 mb-3">Timeline</h2>
            <div className="relative pl-6 border-l border-green-800/50 space-y-4">
              {record.timeline.map((e) => (
                <div key={e.id} className="relative">
                  <div className="absolute -left-[25px] w-3 h-3 rounded-full bg-green-600 border-2 border-[#080c08]" />
                  <div className="text-xs text-green-700 font-mono">{e.type}</div>
                  <div className="text-sm">{e.action}</div>
                </div>
              ))}
            </div>
          </section>

          {record.claims.map((c) => (
            <div key={c.claim} className={`p-5 rounded-2xl border ${verdictColor[c.verdict]}`}>
              <div className="flex justify-between items-start mb-3">
                <span className="font-semibold">{c.claim}</span>
                <span className="text-xs uppercase font-bold">{c.verdict}</span>
              </div>
              <p className="text-sm mb-3 opacity-80">{c.message}</p>
              <div className="grid grid-cols-2 gap-2">
                {c.checks.map((ch) => (
                  <div key={ch.label} className={`text-xs px-2 py-1 rounded ${ch.passed ? "bg-green-500/20" : "bg-red-500/10"}`}>
                    {ch.passed ? "✓" : "✗"} {ch.label}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="flex gap-2">
            <button onClick={() => download(generateEvidenceMd(record), "evidence.md")} className="flex-1 py-2 rounded-lg bg-green-600 text-black font-semibold text-sm">evidence.md</button>
            <button onClick={() => download(generateSuspiciousClaimReport(record.claims), "suspicious-claim-report.md")} className="flex-1 py-2 rounded-lg border border-amber-600 text-amber-400 text-sm">suspicious report</button>
            <button onClick={() => download(JSON.stringify(record, null, 2), "run.timeline.json")} className="flex-1 py-2 rounded-lg border border-green-800 text-green-500 text-sm">timeline.json</button>
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div className="rounded-xl border border-green-900/30 overflow-hidden">
      <div className="px-3 py-2 text-xs text-green-700 border-b border-green-900/30">{label}</div>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className="w-full p-3 bg-transparent font-mono text-sm resize-none focus:outline-none" />
    </div>
  );
}

function download(content: string, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content]));
  a.download = name;
  a.click();
}