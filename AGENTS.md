# AGENTS

Repository-level rules for engineering execution agents.

## 1) Non-Negotiable Logging Rules

1. Every execution-affecting user instruction MUST be recorded.
2. Logging is mandatory before or during execution.
3. No step can skip logging.
4. Persisted log content in this repository MUST be in English.
5. If the user instruction is not in English, record a faithful English translation and mark it as translated.
6. Small-step execution only. Large, uncontrolled changes are not allowed.
7. Exempt from session logging:
   - Pure explanation questions (for example, "what does this mean?")
   - Tool or skill usage guidance with no repository mutation
   - General Q&A that does not run commands, edit files, or change project state
8. Session rollover rule:
   - When a session file exceeds 100 steps, create the next file using zero-padded sequence naming:
     - `session-001.md` -> `session-002.md` -> `session-003.md`
   - Start each new session file at `Step 1`.
   - Update `codex/current-session.md` to point to the new active session file.

## 2) Behavioral Rules (Execution Quality)

1. Think before coding.
   State assumptions explicitly. Surface ambiguity instead of guessing silently.
2. Simplicity first.
   Implement only what was requested. Avoid speculative abstraction and unnecessary configurability.
3. Surgical changes.
   Touch only code required by the request. Do not refactor unrelated areas.
4. Goal-driven execution.
   Define verifiable success criteria, execute, then validate with concrete checks.

## 3) Project Operations (This Repository)

1. Stack baseline: Plasmo + React + TypeScript + Manifest V3.
2. Standard commands:
   - `npm install`
   - `npm run dev`
   - `npm run build`
   - `npm run package`
3. Do not add dependencies unless strictly required by the current step.
4. Do not implement business logic unless explicitly requested.

## 4) Required Log Files

- `codex/logs/session-001.md` (or the active session file)
- `codex/current-session.md`
- `codex/log-template.md`

## 5) Step Record Minimum

Each step record must follow `codex/log-template.md`:

- User Instruction
- Understanding
- Plan
- Actions Taken
- Validation
- Result
