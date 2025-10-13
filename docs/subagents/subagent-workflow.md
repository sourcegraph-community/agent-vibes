# Long-Running Workflow and Communication Guide

This guide defines how we run agents for long-running work (up to 24h) and how those agents communicate.

## What Amp Is (in brief)
- A threads + tools orchestration engine that runs an AI agent with a controlled toolbox.
- Produces normal replies and can take actions via tools (file edits, shell commands, searches, diagrams, etc.).
- Extensible: add custom tools, enable MCP servers for remote tools, and define specialized sub‑agents.

## Core Principles
- Simplicity first: file-backed state; avoid external services.
- Small, completable tasks: one deliverable per task with crisp acceptance checks.
- Evidence-first: exchange chunk IDs and file ranges, not large text blobs.
- Token-aware: short resume notes; keep context lean.
- Self-correction: verify after each step, revert quickly, checkpoint always.
- Self-evolution: trial lightweight tools/agents; graduate only when clearly valuable.

## Roles and Ownership
- Main Agent (Coordinator): orchestrates from `plan/Manifest.json`, enforces advisory path locks, and schedules sub-agents (via Task Tool); does not validate outputs or re-read artifacts for correctness (Verifier owns validation).
- Planner Agent: produces a thin task skeleton (slices, deps, acceptance checks).
- Executor Agent: applies small, auditable changes; emits outputs and evidence.
- Verifier Agent: runs diagnostics/tests; writes a terse resume note and follow‑ups.
- Toolsmith Agent(optional): proposes/sandboxes ephemeral tools; promotes or retires.

## Minimal Artifacts
- Location: All artifacts live under `plan/`.
- Planner must create/update:
  - Manifest.json (authoritative state)
    - tasks: id, name, status, deps[], ownerAgent, materials.chunkIds[], evidence[{path, range}], outputs, resumeNote
  - locks: path‑scoped edit locks with expiry
  - indexRef: path to the docs index file
  - Index.json (lightweight local index)
    - chunks: [{id, path, startLine, endLine, headingPath, summary?, keywords?}]
- Optional:
  - Mailboxes.jsonl — small, structured handoffs (e.g., tool proposals, briefings); rotate aggressively.
- Handoffs/resume notes: Persist every handoff and resume note as a file entry under `plan/` for downstream agents.

## Work Order Template Example
```json
{
  "taskId": "slice-1.setup",
  "ownerAgent": "Executor",
  "objective": "Create scaffolding for X",
  "acceptance": ["diagnostics clean", "file exists: path"],
  "materials": { "chunkIds": ["doc-A#L10-L80"] },
  "locks": ["src/feature/"]
}
```

## Workflow Sequence

1. Main Agent - inputs: Goal → processes: delegate Planner → Read Manifest.json/Index.json → delegate Executors.
2. After one or more Executors completed → Verifier → revise Planner:
  - If there is still work to be done claimed by Verifier → Executors then go back to step 2 of the workflow sequence.
  - If work is completed, summarize and stop.

## Parallel vs Sequential Execution
- Parallel: when tasks touch disjoint path prefixes (no lock overlap).
- Sequential: when paths overlap or explicit dependencies exist.
- Locks: advisory and file-based; record path-scoped locks in Manifest.json, acquire before edit, release on completion/failure; enforcement is by cooperating agents.

## Agent Contracts (Short, Deterministic)
- Planner — inputs: goal → outputs: manifest.tasks skeleton + acceptance checks.
- Executor — inputs: materials.chunkIds → outputs: artifacts + evidence[{path, range}]; persist Agent Briefing and resume note under `plan/`; update `Manifest.json` outputs/evidence for the task.
- Verifier — inputs: outputs/evidence → outputs: pass/fail + resumeNote (≤8 lines) + follow-ups; persist the resume note under `plan/` and update task status in `Manifest.json`.
- Toolsmith — inputs: tool proposal → outputs: sandbox verdict + registration decision.

## Communication Rules Between Sub-Agents
- Agents are stateless: rely only on persisted artifacts under `plan/` and repository files; do not assume conversational memory.
- All inter-agent communication persists via files in `plan/` (e.g., Manifest.json, Mailboxes.jsonl, resume notes, briefings).
- Always pass references, not blobs: prefer chunk IDs and explicit file ranges.
- Keep handoffs short: ≤8 lines per resume note; include decisions, failing ranges, next keywords.
- Use the Agent Briefing format for every handoff and include exact line ranges from discovered files, and persist it under `plan/`:

  Agent Briefing for Next Phase:
  - Key Findings: [Most important discoveries]
  - Architecture/Patterns: [Code patterns, tech stack, conventions found]
  - Important Files/Locations: [Absolute paths with precise line ranges]
  - Guidance for Next Phase: [Concrete next focus]

- Evidence discipline: every claim should cite file path + Lx–Ly; do not restate large excerpts.
- Acceptance checks up front: each task declares what “done” means; Verifier enforces it.

## Self-Correction Loop
1) Executor record a concise change summary in the resume note under `plan/` → update task outputs/evidence in `Manifest.json`.
2) Verifier runs get_diagnostics/tests → success → mark done and persist status/resume note under `plan/`; else
3) Verifier records precise failures with file ranges → persist findings under `plan/`.
4) If still failing, stop; write resume note; enqueue follow-ups and update `Manifest.json`.

## Restart/Resume Strategy
- Reload `plan/Manifest.json`; pick next ready task; include only its resume note and top‑K chunks.
- Main agent must not re-open code artifacts at this stage; rely on Manifest status/evidence and the latest resume note.
- Avoid injecting long history; retrieve content just-in-time via Read.

## Token-Aware Retrieval (No Vectors Required)
- Build Index.json with glob + Grep + optional run_javascript for chunking by headings/paragraph windows.
- Rank by simple keyword/BM25‑style scoring in a Node script; return top‑K chunk IDs.
- Store 1–3 sentence summaries on first use; keep them short.

## Safety
- If token usage exceeds 70%, immediately stop and hand off the completed or partial resume note to a sub-folder under `plan/`.

## Ground Rules We Enforce Here
- Main agent orchestrates sequencing and locking only; it must not re-validate outputs or re-run diagnostics, nor read code artifacts for validation. Sub-agent prompts must instruct pre-reading of `plan/Manifest.json` and `plan/Index.json` (when present), include the taskId, acceptance checks, and any path locks, and apply the 70% token stop rule with resume notes persisted under `plan/`.
- Before execution, sub-agents (Task tool) must read relevant docs under `plan/` to determine scope and acceptance.
- Do only what the task requests; avoid extras.
- Do not modify or overwrite code produced by previous sub-agents; open a new task if changes are needed.
- Sub-agents must not run `git add` or stage files; version control actions are out of scope.
- Sub-agents must include exact file ranges for all discovered evidence in every handoff.
- Keep changes small, auditable, and reversible.
- Checkpoint after each task with a short resume note (no patch files); persist it under `plan/` and update the task in `Manifest.json`.

## Main Agent Prompt Requirements
- Include pre-reading of `plan/Manifest.json` and `plan/Index.json`; locate `taskId`, acceptance checks, and path locks; honor locks.
- After a sub-agent completes, do not read/validate code artifacts; consult only `plan/Manifest.json` status/evidence and the latest resume note to decide next steps.
- Apply the 70% token stop rule; persist resume notes under `plan/` (no diff patch files).
- If plan files are missing, proceed with the prompt and note the fallback in the resume note.
- Require Agent Briefing with exact file ranges; persist under `plan/`; update `Manifest.json`.

```text
PROMPT PREAMBLE (include in every sub-agent prompt):
- Read: `plan/Manifest.json` and `plan/Index.json` (if present)
- TaskId: <TASK_ID>
- Acceptance: <ACCEPTANCE_CHECKS>
- Locks: <PATH_LOCKS>
- 70% token rule: stop and persist resume note under plan/
- Persist artifacts: resume note (no patch files); update Manifest; Agent Briefing
- Stateless: cite file ranges for all evidence
```
