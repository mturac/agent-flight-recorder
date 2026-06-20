# agent-flight-recorder

> Black-box recorder for AI agent runs — what happened, what was claimed, what was actually proven.

![Screenshot](docs/screenshot.png)

## Features

- Ingest agent logs, terminal output, git diff, test results
- Build chronological timeline
- Validate completion claims against evidence checklist
- Export `run.timeline.json`, `evidence.md`, `suspicious-claim-report.md`

## Quick Start

```bash
npm install
npm run dev      # http://localhost:3103
npm test
```

## Demo

```
Claim: Login flow fixed.
Evidence: test=yes, browser=no, db=no, screenshot=yes
Verdict: incomplete claim
```

## License

MIT
