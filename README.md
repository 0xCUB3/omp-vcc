<div align="center">

# 🗜️ omp-vcc

**Algorithmic conversation compactor for [Oh My Pi](https://github.com/can1357/oh-my-pi)**

_No LLM calls — 35-99% token reduction via extraction and formatting. Same input = same output, always._

[![omp extension](https://img.shields.io/badge/omp-extension-blueviolet)](https://github.com/can1357/oh-my-pi)
[![license](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

</div>

---

Inspired by [VCC](https://github.com/lllyasviel/VCC) **(View-oriented Conversation Compiler)**.
Ported from [pi-vcc](https://github.com/monotykamary/pi-vcc) for omp.

## What it does

omp-vcc replaces the LLM-based compaction summarizer with a deterministic, purely algorithmic alternative. It registers as a `session_before_compact` hook that intercepts every compaction event (manual `/compact`, auto-threshold, overflow) and produces a structured summary from the conversation history — no API calls, zero token cost, sub-100ms latency.

Unlike omp's native `snapcompact` (bitmap rendering), omp-vcc produces actual text summaries in bracket-tagged sections that the model reads and understands directly. No vision-capable model required.

## vs omp's native strategies

| | `snapcompact` | `context-full` | `handoff` | `omp-vcc` |
|---|---|---|---|---|
| **Method** | Bitmap PNG render | LLM summarizer | Model handoff | Algorithmic extraction |
| **LLM calls** | None (rendering only) | 1 per compaction | 1 per compaction | None |
| **Vision required** | Yes (current model) | No | No | No |
| **Deterministic** | Yes (same render) | No (LLM varies) | No (LLM varies) | Yes (same input → same output) |
| **Latency** | Milliseconds | LLM call time | LLM call time | 2-64ms |
| **Output** | Images of old text | Free-form prose | Free-form prose | Structured sections with anchors, type catalog, error register |
| **History searchable** | No | No | No | Yes (`vcc_recall`) |
| **Per-model thresholds** | No | No | No | Yes |

omp-vcc is a hook overlay, not a `compaction.strategy` option — it overrides whatever native strategy is configured. To disable it and fall back to native: set `overrideDefaultCompaction: false` in `~/.omp/agent/omp-vcc-config.json`.

## Features

- **No LLM, no vision requirement** — works with any model, including text-only ones like GLM 5.2
- **Brief transcript** — chronological conversation flow, each tool call collapsed to a one-liner with `(#N)` refs
- **8 semantic sections** — session goal, files & changes, type catalog, commits, outstanding context, earlier turns, anchors, user preferences
- **Bounded merge** — rolling sections re-capped after merge instead of growing unbounded
- **Lossless recall** — `vcc_recall` tool reads raw session JSONL, so active-lineage history stays searchable across compactions
- **Scoped recall** — `scope:"lineage"` (default), `scope:"all"`, `scope:"compaction:N"`, `scope:"compaction:latest"`
- **Priority error tags** — `[ERROR]`, `[WARN]`, `[INFO]`, `[RESOLVED]` on outstanding context items
- **Error resolution detection** — tsc errors tagged `[RESOLVED]` when the referenced file was subsequently edited
- **Compaction counter** — post-compaction notification reports ordinal (e.g. "3rd compaction")
- **Cache-friendly ordering** — stable sections first (goal, preferences, files, commits, anchors); volatile sections last
- **Regex search** — `vcc_recall` supports regex patterns and OR-ranked multi-word queries
- **`/vcc-recall`** — slash command to search history, results auto-fed to agent as context
- **`/omp-vcc`** — manual compaction on demand
- **Multi-resolution transcript** — three-zone brief: `[Earlier Turns]` (one-liner per turn), brief transcript, kept tail
- **Task-boundary-aware cut** — splits at complete conversational turns, never mid-tool-call
- **Structured anchors** — commit hashes, error IDs, key file paths for zero-tool-call recall
- **Per-model thresholds** — configure `reserveTokens`, `compactAtTokens`, or `compactPercent` per model via `modelThresholds` in config
- **Proactive triggering** — hooks `agent_end` and `model_select` to compact before context overflows for small-window models
- **Invisible continue** — automatically resumes the agent after threshold compaction, no user input needed
- **`/tmp/omp-vcc-debug.json`** — full debug snapshot on each compaction when `debug: true`

## Install

```bash
git clone https://github.com/0xCUB3/omp-vcc.git /tmp/omp-vcc
omp plugin link /tmp/omp-vcc
```

## Usage

Once installed, `/omp-vcc` triggers manual compaction. With `overrideDefaultCompaction: true` (default), omp-vcc also handles all automatic compaction paths — `/compact`, threshold triggers, overflow — replacing omp's native summarizer entirely.

```bash
# Manual compaction
/omp-vcc

# Search compacted history
/vcc-recall authentication bug
/vcc-recall hook|inject scope:all
/vcc-recall scope:compaction:2

# Combined: search and feed to agent
/vcc-recall "fix auth" page:2
```

## Config

`~/.omp/agent/omp-vcc-config.json` (created automatically on first load):

```json
{
  "overrideDefaultCompaction": true,
  "debug": false,
  "modelThresholds": {
    "neuralwatt/zai-org/GLM-5.1-FP8": {
      "compactPercent": 65
    }
  },
  "globalThreshold": {
    "reserveTokens": 16384
  }
}
```

- `overrideDefaultCompaction` — when true, omp-vcc intercepts all compaction events. Set to `false` to use omp's native strategy instead (omp-vcc still handles `/omp-vcc`).
- `debug` — write `/tmp/omp-vcc-debug.json` snapshot on each compaction.
- `modelThresholds` — per-model compaction thresholds. Keys match `provider/modelId` or just `modelId`. Each entry can specify `reserveTokens` (tokens to keep free for response), `compactAtTokens` (absolute context token trigger), or `compactPercent` (1-99, trigger when context is X% full).
- `globalThreshold` — fallback for models not matched by `modelThresholds`. Also supports deprecated `defaultThreshold` key for backward compat.

Threshold precedence: `modelThresholds[provider/modelId]` → `modelThresholds[modelId]` → `globalThreshold` → omp's global `compaction.reserveTokens`.

## Compacted message structure

```
[Session Goal]
- Fix the authentication bug in login flow
- [Scope change]
- Also update the session token refresh logic

[Files And Changes]
- Modified: src/auth/session.ts (refreshToken, verifyToken, Session)
- Read: src/types.ts (User, AuthPayload)
- Created: tests/auth-refresh.test.ts

[Type Catalog]
- src/auth/session.ts [modified]:
  export function refreshToken(token: string): Promise<Session>
  export function verifyToken(token: string): Promise<User>
  export interface Session {

[Commits]
- a1b2c3d: fix(auth): refresh token after password reset

[Anchors]
- commits: a1b2c3d
- errors: TS2304
- files: src/auth/session.ts, src/types.ts, tests/auth-refresh.test.ts

[Outstanding Context]
- [RESOLVED] [tsc] src/session.ts(5,18): error TS2304: Cannot find name 'authenticateUser'
- [ERROR] [bash:exit 1] bun test tests/auth.test.ts -> 3 tests failed
- [WARN]  [tests] FAIL auth.test.ts > refresh token should work
- [INFO]  [no matches] grep "verifyCredentials"

[Earlier Turns]
- Set up the project structure -> read package.json, tsconfig.json
- Install auth dependencies -> ran bun add, edited package.json

[Current Status]
- Working on: fix the auth bug
- Last action: Edit "src/auth/session.ts"
- Next: need to add the refreshToken function signature

---

[user]
Fix the auth bug, users can't log in after password reset

[assistant]
Let me look at the auth flow...
```

## Real session metrics

Measured on real session JSONLs under `~/.omp/agent/sessions`:

| Session | Messages | Before (chars) | After (chars) | Reduction | Time |
|---|---|---|---|---|---|
| A | 2,943 | 997,162 | 7,959 | 99.2% | 64ms |
| B | 1,703 | 428,334 | 7,762 | 98.2% | 29ms |
| C | 1,657 | 424,183 | 9,577 | 97.7% | 54ms |
| D | 1,004 | 2,258,477 | 4,439 | 99.8% | 30ms |
| E | 486 | 295,006 | 11,163 | 96.2% | 30ms |
| F | 46 | 5,234 | 3,364 | 35.7% | 5ms |
| G | 27 | 8,595 | 2,489 | 71.0% | 2ms |

## Architecture

```
omp-vcc extension
├── session_before_compact hook → intercepts all compaction events
│   ├── buildOwnCut() — task-boundary-aware message split
│   ├── compile() — algorithmic summary generation
│   └── mergeHeaderSection() — bounded section merge across compactions
├── session_compact hook → invisible continue after threshold compaction
├── agent_end / model_select hooks → proactive threshold triggering
├── /omp-vcc command → manual compaction
├── /vcc-recall command → search compacted history
├── vcc_recall tool → programmatic recall for the agent
└── settings → ~/.omp/agent/omp-vcc-config.json
```

## License

MIT
