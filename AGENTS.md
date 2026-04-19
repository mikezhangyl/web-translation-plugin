# AGENTS

Repository-level rules for engineering execution agents.

## 1) Non-Negotiable Logging Rules

1. Only file-changing instructions MUST be recorded in session logs.
   - Record when the request edits files, creates/deletes files, or otherwise changes repository state.
   - Do not record when the request is only explanation, clarification, Q&A, or usage guidance with no repository mutation.
2. For file-changing instructions, logging is mandatory before or during execution.
3. No step can skip logging.
4. Persisted log content in this repository MUST be in English.
5. If the user instruction is not in English, record a faithful English translation and mark it as translated.
6. Small-step execution only. Large, uncontrolled changes are not allowed.
7. Explicit non-logging cases:
   - Pure explanation questions (for example, "what does this mean?")
   - Tool or skill usage guidance with no repository mutation
   - General Q&A and command questions that do not change files
8. Session rollover rule:
   - When a session file exceeds 100 steps, create the next file using zero-padded sequence naming:
     - `session-001.md` -> `session-002.md` -> `session-003.md`
   - Start each new session file at `Step 1`.
   - Update `codex/current-session.md` to point to the new active session file.
9. Branch-scoped session changes:
   - Session file changes created during active work stay on the active feature branch.
   - Do not force-move session changes to unrelated branches.
   - Session files are merged through the same PR as the work they describe.

## 2) Behavioral Rules (Execution Quality)

1. Think before coding.
   State assumptions explicitly. Surface ambiguity instead of guessing silently.
2. Simplicity first.
   Implement only what was requested. Avoid speculative abstraction and unnecessary configurability.
3. Surgical changes.
   Touch only code required by the request. Do not refactor unrelated areas.
4. Goal-driven execution.
   Define verifiable success criteria, execute, then validate with concrete checks.

## 3) Instruction Precedence and Conflict Resolution

1. Conflict precedence order:
   - explicit user instruction in current turn
   - this `AGENTS.md`
   - skill-level defaults/templates
2. If `AGENTS.md` and a skill conflict, follow `AGENTS.md`.
3. If current-turn user instruction conflicts with a default rule in this file, follow the user instruction and document the override in the session log.

## 4) Project Operations (This Repository)

1. Stack baseline: Plasmo + React + TypeScript + Manifest V3.
2. Standard commands:
   - `npm install`
   - `npm run dev`
   - `npm run build`
   - `npm run package`
3. Do not add dependencies unless strictly required by the current step.
4. Do not implement unrelated business logic outside the current requested scope.
5. Branch-first execution rule:
   - Before any file-changing work, create/switch to a feature branch.
   - Do not start implementation on `main`.
   - Allowed work on `main` is read-only exploration plus branch/PR hygiene (`checkout`, `pull`, merge sync).
6. Branch reuse rule:
   - Reuse the current feature branch while the same in-progress task is not merged.
   - Create a new feature branch when starting a distinct new task or after the previous task is merged.

## 5) Workflow Surface Policy

1. `skills/` is the canonical workflow surface.
2. `commands/` is compatibility-only and must remain thin shims that delegate to skills.
3. New workflow logic must be added in skills, not duplicated in command shims.
4. `/ship` preflight must use `npm run check:local` as the unified local gate.

## 6) Sub-Agent Role Defaults

1. Prefer sub-agent execution for:
   - local test execution
   - change review
2. Keep the main thread concise:
   - only high-signal pass/fail summary
   - actionable blocker details
3. Default role templates in this repository:
   - `test-runner`: test execution only + failure evidence only
   - `planner`: planning breakdown only
   - `code-reviewer`: quality/risk review only
   - `build-error-resolver`: build/type error fixes only, minimal diffs
4. `/test` execution policy:
   - `/test` must run through `test-runner` sub-agent.
   - Main thread should not execute test commands directly by default.
   - If sub-agent startup/execution fails, request explicit fallback authorization.
   - After authorization, main-agent fallback is allowed but MUST display a clear `DEGRADED MODE` warning that includes the failure reason.
5. Model default for repository agent templates:
   - use `gpt-5.3-codex` unless a specific step explicitly requires another model.
   - do not use Claude-specific model labels (for example `sonnet`, `opus`) in this repository's agent templates.

## 7) Skill/Agent Adoption Gate

Before adding any new skill or agent template, it must pass all checks:

1. Directly relevant to translation-plugin engineering efficiency.
2. Runnable with the current repository command/tooling surface.
3. No heavy external runtime dependency required.
4. Clear acceptance checks exist (commands + expected pass/fail outcome).
5. At most one new skill or one new agent template per iteration.

## 8) Required Log Files

- `codex/logs/session-XXX.md` (the active session file referenced by `codex/current-session.md`)
- `codex/current-session.md`
- `codex/log-template.md`

## 9) Step Record Minimum

Each step record must follow `codex/log-template.md`:

- User Instruction
- Understanding
- Plan
- Actions Taken
- Validation
- Result
