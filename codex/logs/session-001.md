# Session 001 Log

## Step 1

### User Instruction
```text
Create `web-translation-plugin` as a clean ECC-first successor and migrate the current `vibe-coding-os-translation-plugin` implementation into it while preserving git history.
```

### Understanding
Bootstrap a new repository identity, keep the current extension implementation, drop the old repo-local workflow surfaces, and start with a fresh docs/codex memory system.

### Plan
1. Clone the old repository to preserve commit history.
2. Sync the current working tree into the new clone.
3. Remove old workflow/history surfaces and rebuild the minimal ECC-local control layer.
4. Rename package identity, simplify scripts, and validate the migrated repository.

### Actions Taken
- Cloned the old repository into `web-translation-plugin`.
- Synced the current working tree state into the new repository.
- Removed old workflow surfaces such as `skills/`, `commands/`, `agents/`, `.agents/skills/`, `harness/`, and old session history.
- Rebuilt the minimal docs, codex memory files, and `.codex/` control layer.

### Validation
- Pending final install/build/test verification in the new repository.

### Result
In progress.

## Step 2

### User Instruction
```text
你现在工作在这个新项目里：

/Users/mikezhang/Coding/AI-Learning/web-translation-plugin

原项目在这里：

/Users/mikezhang/Coding/AI-Learning/vibe-coding-os-translation-plugin

目标：把原项目里“有价值的项目记忆系统”恢复到新项目里，但保持新项目是 minimal ECC-first 结构，不要把旧的 workflow 噪音一起搬回来。

已知约束：
1. 全局 ECC 已经安装好了，不需要把通用 ECC 规则复制进项目级 AGENTS.md。
2. 新项目要保留轻量、项目专用的 AGENTS.md。
3. 不要恢复旧项目里的 skills/、commands/、agents/、.agents/skills/、harness/、旧的 codex/logs 历史。
4. 不要修改旧项目，只把它当作信息来源。
5. 优先恢复“项目知识”和“连续工作上下文”，不是恢复旧的流程包装层。

请你直接执行，不要只给建议。按这个顺序做：

1. 先检查新旧两个项目里和记忆系统相关的文件：
- AGENTS.md
- .codex/
- docs/
- codex/
- README.md
- tests/
- package.json
- 与产品现状、架构、安全、执行计划有关的文档

2. 判断旧项目里哪些内容属于“应该恢复的记忆”，哪些只是旧 workflow 残留。
重点恢复这些类型的信息：
- 产品当前能力与边界
- 架构和关键模块关系
- provider 配置与运行规则
- 测试入口和验证路径
- 已知限制、风险、技术债
- 当前最合理的后续开发方向
- 如果旧项目里有有价值的执行计划，也请提炼后放进新项目的 docs/exec-plans/active/

3. 把恢复后的内容整理进新项目现有骨架，优先更新这些文件：
- docs/ARCHITECTURE.md
- docs/product-specs/current-state.md
- docs/SECURITY.md
- codex/current-session.md
- codex/log-template.md
- codex/logs/session-001.md
- 必要时补充 docs/exec-plans/active/ 下的计划文件
- 根 AGENTS.md 只做必要的 repo-specific 调整，不要塞入全局 ECC 通用规则

4. 不要机械复制旧日志或旧文档；要做“提炼、压缩、重写”，让新项目的记忆系统是干净的、可持续维护的。

5. 完成后：
- 给我一个简洁总结
- 明确列出你恢复了哪些记忆
- 说明哪些旧内容你故意没有恢复
- 说明下一步最适合继续做什么

如果遇到取舍，默认选择：
- 保留长期有效的项目知识
- 丢弃临时会话痕迹、过时流程包装、重复说明
```

### Understanding
Compare the new minimal repository against the old repository, recover only durable project memory, and rewrite the new `docs/` and `codex/` surfaces so they preserve product knowledge and working continuity without restoring the old workflow layer.

### Plan
1. Inspect the requested memory-related files in both repositories.
2. Separate durable project knowledge from workflow-only residue.
3. Rewrite the new repository's architecture, current-state, security, session-memory, and active-plan files with distilled content only.
4. Validate that the restored memory system stays minimal and repo-specific.

### Actions Taken
- Inspected both repositories across the requested memory surfaces:
  - `AGENTS.md`
  - `.codex/`
  - `docs/`
  - `codex/`
  - `README.md`
  - `tests/`
  - `package.json`
- Read the old repository's architecture, product-state, security, reliability, provider-workflow, observability, active-plan, and session-history materials to classify durable knowledge vs workflow residue.
- Chose to recover durable project memory only:
  - product capabilities and limits
  - architecture and module relationships
  - provider/configuration rules
  - verification entrypoints and acceptance vocabulary
  - known limits and next work direction
- Rewrote:
  - `docs/ARCHITECTURE.md`
  - `docs/product-specs/current-state.md`
  - `docs/SECURITY.md`
- Added a new active plan:
  - `docs/exec-plans/active/paragraph-mode-and-provider-validation.md`
- Made a minimal repo-specific update to `AGENTS.md` so the provider workflow and live-acceptance rule remain visible without restoring the old workflow layer.
- Kept `codex/log-template.md` unchanged because it already matched the required minimal structure exactly.

### Validation
- `npm run test:ui-logic`: PASS
- Reviewed the rewritten docs to confirm they reflect the current code and test surfaces rather than the old repository's removed workflow surfaces.

### Result
Success. The new repository now has a cleaner restored memory system that preserves durable product and provider knowledge from the old repository without bringing back `skills/`, `commands/`, `agents/`, `harness/`, or old session-history noise.

## Step 3

### User Instruction
```text
PLEASE IMPLEMENT THIS PLAN:
## 计划标题
重建 `docs/` 记忆系统为“当前规范 + 生命周期历史 + 问题归档”的渐进式披露结构

## Summary
把新项目的文档系统从“极简当前态”升级为“轻量但完整可追溯”的记忆系统，同时继续保持 ECC-first 和 repo-specific。目标不是恢复旧 workflow 面，而是把真正长期有效的项目记忆分成 3 层：

- 当前规范层：当前产品、架构、可靠性、安全、活跃计划
- 生命周期历史层：需求、PRD、变更记录、设计历史
- 问题与参考层：复盘问题、经验规则、技术债、参考说明

采用你刚确认的策略：

- 需求结构：生命周期分层
- 归档阈值：保留所有正式文档
- 索引策略：分区索引
- `generated/`：按需启用，不先建空目录

## Key Changes
### 1. 目标目录结构
将 `docs/` 收敛为下面的长期结构：

```text
docs/
  index.md
  ARCHITECTURE.md
  RELIABILITY.md
  SECURITY.md

  product-specs/
    index.md
    current-state.md

  requirements/
    index.md
    active/
      index.md
      <initiative-slug>/
        PRD.md
        CHANGELOG.md
    history/
      index.md
      timeline.md
    archive/
      index.md

  design/
    index.md
    history/
      index.md
      2026-04-design-overview.md

  issues/
    index.md
    open/
      index.md
      provider-workflow-retrospective.md
    resolved/
      index.md

  references/
    index.md
    provider-workflow-lessons.md
    observability-and-acceptance.md

  exec-plans/
    index.md
    active/
      index.md
      paragraph-mode-and-provider-validation.md
    tech-debt-tracker.md

  archive/
    index.md
    status/
      2026-04-quality-score.md
```

### 2. 旧文档的迁移归类
按下面规则处理旧仓库中的关键文件：

- `docs/provider-workflow-retrospective-todo.md`
  保留，迁入 `docs/issues/open/provider-workflow-retrospective.md`
  作用从“规范”改为“开放问题与复盘输入”
- `docs/DESIGN.md`
  保留，迁入 `docs/design/history/2026-04-design-overview.md`
  顶部加明显历史标记，说明它不是当前 canonical design
- `docs/QUALITY_SCORE.md`
  不作为当前规范恢复；保留为历史快照，迁入 `docs/archive/status/2026-04-quality-score.md`
- `docs/references/provider-workflow-lessons.md`
  恢复为当前参考文档
- `docs/references/observability-and-acceptance.md`
  恢复为当前参考文档
- `docs/RELIABILITY.md`
  恢复为当前规范文档，并与现有代码/测试重新对齐
- `design-docs/index.md`、`product-specs/index.md`、`references/index.md`
  恢复，但重写成真正的分区入口，不复制旧内容
- `generated/`
  暂不创建目录；只在 `docs/index.md` 中预留“未来会放机器生成文档”的说明
- 明确保留不恢复：
  `harness-engineering.md`、`product.md`、`skills-agent-migration-roadmap.md`、`archived-workflows/`、`workflow-surface.md`

### 3. 需求与变更记录规则
把“从项目开始到结束的所有需求及变更记录”固定为以下接口约定：

- 每个活跃需求流在 `docs/requirements/active/<initiative-slug>/` 下维护
- 每个需求流必须至少有：
  - `PRD.md`
  - `CHANGELOG.md`
- 每次需求变化都必须同时记录：
  - 对应 initiative 的 `CHANGELOG.md`
  - `docs/requirements/history/timeline.md` 中的一条全局时间线记录
- 需求文档被替换或废弃时，不覆盖删除，移动到 `docs/requirements/archive/`
- 临时但正式入库的文档也保留：
  - 若仍在推动决策，留在 `active/`
  - 若已失效但有历史价值，移入 `archive/`
- `codex/logs/` 继续只是会话操作历史，不再承担 canonical 需求历史职责

### 4. 索引与文档约定
所有重要分区都使用 `index.md`，而不是散乱 README/stub：

- `docs/index.md` 是总导航
- 每个分区 `index.md` 只做 3 件事：
  - 该分区的用途
  - 当前 canonical 文件列表
  - 历史/归档/待补充入口
- 历史文档顶部统一加“historical / archived / issue-input”状态说明，避免被误读为当前规范
- `AGENTS.md` 和 `README.md` 只链接入口，不再承担细节目录说明

## Important Interfaces / Conventions
这次不是代码 API 变更，主要是文档接口约定变更：

- 新的 canonical 入口：
  - `docs/index.md`
  - `docs/requirements/active/<initiative-slug>/PRD.md`
  - `docs/requirements/active/<initiative-slug>/CHANGELOG.md`
  - `docs/requirements/history/timeline.md`
  - `docs/issues/open/<issue-slug>.md`
- `docs/exec-plans/active/README.md` 统一改为 `docs/exec-plans/active/index.md`
- 文档状态建议统一使用轻量 frontmatter 或固定头部字段：
  - `status`
  - `created`
  - `updated`
  - `source`
  - `related_prs`
  - `supersedes` / `superseded_by`

## Test Plan
实施后至少验证这些场景：

- `docs/index.md` 能导航到所有重要分区
- `product-specs/`、`design/`、`requirements/`、`references/`、`issues/`、`exec-plans/` 都有可用的 `index.md`
- `provider-workflow-retrospective` 已保留，但只出现在 `issues/open/`，不再伪装成当前规范
- `DESIGN` 历史已归档到 design 相关目录，而不是继续占据根规范层
- `RELIABILITY.md`、`references/provider-workflow-lessons.md`、`references/observability-and-acceptance.md` 与当前代码/测试一致
- `requirements/history/timeline.md` 能追踪至少当前已知的重要需求演化：
  - flash-card 词/短语路径
  - sentence plain translation 路径
  - paragraph exploratory 状态
  - storage-only runtime config 约束
- 没有恢复旧 workflow 面：
  - `skills/`
  - `commands/`
  - `agents/`
  - `harness/`
  - `archived-workflows/`

## Assumptions
- “保留所有正式文档”解释为：凡是写入仓库、对需求/设计/决策有作用的 markdown 文档都保留；纯聊天记录和一次性未入库草稿不纳入 docs
- `generated/` 只有在出现真实会提交的生成文档时才创建
- `QUALITY_SCORE` 属于历史 snapshot，不属于当前规范
- 旧 `product.md` 和 workflow 迁移类文档不恢复，除非后续发现它们包含未被别处吸收的真实产品事实
```

### Understanding
Implement the fuller progressive-disclosure docs system, restoring the missing reliability, references, tech-debt, issue-history, design-history, and requirement-history layers while keeping the repository minimal and free of the old workflow surface.

### Plan
1. Log the implementation request before changing any tracked files.
2. Rebuild the `docs/` structure with root and partition indexes.
3. Restore the current-spec, references, issue archive, design history, requirements history, and tech-debt layers from the old repository as rewritten documents.
4. Update top-level entrypoints so `README.md` and `AGENTS.md` point to the new docs entry.
5. Validate the docs structure and run the logic test suite.

### Actions Taken
- Created the new progressive-disclosure docs entrypoint:
  - `docs/index.md`
- Added current canonical docs and reference layers:
  - `docs/RELIABILITY.md`
  - `docs/references/provider-workflow-lessons.md`
  - `docs/references/observability-and-acceptance.md`
  - `docs/exec-plans/tech-debt-tracker.md`
- Added partition indexes and lifecycle structure for:
  - `product-specs/`
  - `requirements/`
  - `design/`
  - `issues/`
  - `references/`
  - `exec-plans/`
  - `archive/`
- Created requirement-memory scaffolding:
  - `docs/requirements/active/paragraph-mode-stabilization/PRD.md`
  - `docs/requirements/active/paragraph-mode-stabilization/CHANGELOG.md`
  - `docs/requirements/history/timeline.md`
- Preserved historical material in the new layers:
  - migrated the old design overview into `docs/design/history/2026-04-design-overview.md`
  - migrated the provider retrospective into `docs/issues/open/provider-workflow-retrospective.md`
  - migrated the old quality snapshot into `docs/archive/status/2026-04-quality-score.md`
- Replaced `docs/exec-plans/active/README.md` with `docs/exec-plans/active/index.md`.
- Updated `README.md` and `AGENTS.md` so both point to `docs/index.md` as the docs entrypoint instead of duplicating the docs structure.

### Validation
- `find docs -maxdepth 4 -type f | sort`: PASS
- `rg -n "exec-plans/active/README|harness-engineering|product.md|skills-agent-migration-roadmap|archived-workflows" docs README.md AGENTS.md`: PASS
- `npm run test:ui-logic`: PASS

### Result
Success. The repository now has a fuller progressive-disclosure docs memory system with current specs, requirement history, issue-input notes, design history, references, and archived snapshots, without restoring the old workflow surface.

## Step 4

### User Instruction
```text
先等等， 你这份计划还漏了： 新增 docs/RELIABILITY.md
新增 docs/references/provider-workflow-lessons.md
新增 docs/references/observability-and-acceptance.md
新增 docs/exec-plans/tech-debt-tracker.md
```

### Understanding
The implementation scope must explicitly include the missing reliability, references, and tech-debt documents instead of treating them as optional follow-up.

### Plan
1. Treat the four missing docs as first-class deliverables in the current implementation pass.
2. Align `RELIABILITY.md` and both reference docs with the current code/test surface rather than copying the old versions mechanically.
3. Restore the tech-debt tracker as a durable docs layer, not as workflow residue.

### Actions Taken
- Merged the missing four documents into the active implementation scope before file edits.

### Validation
- Pending.

### Result
Success. The implementation scope now explicitly includes `docs/RELIABILITY.md`, both reference docs, and `docs/exec-plans/tech-debt-tracker.md`.

## Step 5

### User Instruction
```text
# Review findings:

## Finding 1 (docs/issues/open/provider-workflow-retrospective.md:5-6) [added]
[P1] Replace machine-local source paths with repo-portable provenance

The new frontmatter records `source` as an absolute workstation path, which means the provenance becomes useless as soon as the repo is cloned elsewhere or the directory moves. This pattern appears in multiple newly added docs, so the memory system is now tied to one machine instead of the repository. Prefer repo-relative paths, commit SHAs, or PR references for source attribution.

## Finding 2 (docs/index.md:18-39) [added]
[P2] The docs system became link-driven without a durable integrity check

`docs/index.md` is now the primary navigation surface for the repository, but this change did not add any repo-level check that verifies docs links, required indexes, or partition completeness. That leaves the new memory system vulnerable to silent drift: future file moves can break discovery without failing any local command or CI job.

## Finding 3 (docs/requirements/active/paragraph-mode-stabilization/PRD.md:12-50) [added]
[P2] The active PRD duplicates the execution plan without declaring precedence

This PRD is materially overlapping with `docs/exec-plans/active/paragraph-mode-and-provider-validation.md`, but the new docs conventions do not state which document wins if they diverge. That creates a maintainability trap for the new memory system: requirement intent and implementation plan can drift independently, and future editors will not know which file is canonical.

## My request for Codex:
做吧
```

### Understanding
Implement the accepted review findings by making provenance repo-portable, adding a durable docs integrity check, and explicitly defining precedence between the active PRD and the linked execution plan.

### Plan
1. Replace absolute `source` paths in docs frontmatter with portable repository provenance metadata.
2. Add a docs integrity script and wire it into the repository validation surface.
3. Declare the precedence contract between requirement PRDs and execution plans in the relevant docs.
4. Validate the new docs check and the unchanged logic suite.

### Actions Taken
- Replaced machine-local absolute `source` paths with repo-portable provenance metadata in:
  - `docs/issues/open/provider-workflow-retrospective.md`
  - `docs/design/history/2026-04-design-overview.md`
  - `docs/archive/status/2026-04-quality-score.md`
  - `docs/requirements/active/paragraph-mode-stabilization/PRD.md`
  - `docs/requirements/active/paragraph-mode-stabilization/CHANGELOG.md`
- Added durable docs metadata guidance and docs-check usage notes to:
  - `docs/index.md`
- Declared PRD vs execution-plan precedence in:
  - `docs/requirements/index.md`
  - `docs/exec-plans/index.md`
  - `docs/requirements/active/paragraph-mode-stabilization/PRD.md`
  - `docs/exec-plans/active/paragraph-mode-and-provider-validation.md`
- Added `scripts/check-docs.mjs` to verify:
  - required docs entrypoints and partition indexes
  - active requirement stream completeness (`PRD.md` + `CHANGELOG.md`)
  - markdown-link integrity under `docs/`
  - rejection of machine-local absolute provenance paths
  - absence of the legacy `docs/exec-plans/active/README.md`
- Wired the docs integrity check into the repo command surface:
  - added `npm run check:docs`
  - updated `check:local` to include `check:docs`
  - updated `README.md` and `AGENTS.md` to document the new docs gate
- Removed an unused import from `scripts/check-docs.mjs` during final cleanup.

### Validation
- `npm run check:docs`: PASS
- `npm run test:ui-logic`: PASS
- `npm run check:local`: PASS
- `npm run check:verify`: PASS
  - includes `check:docs`
  - includes `test:ui-logic`
  - includes `test:e2e:mock` (11 passed)
  - includes `check:live-gate` (SKIP: live provider config unavailable)
  - includes `npm run package`

### Result
Success. The accepted review findings were implemented: docs provenance is now portable across clones, the docs memory system has a repo-level integrity gate, and the requirement-vs-plan precedence contract is explicit in the canonical docs.

## Step 6

### User Instruction
```text
我想你实现一套机制，在我让你做事情的时候， 你自己判断一下这个任务该不该在 sub agent 完成，如果你觉得应该启动 sub agent， 你就问我，让我选择，你看看这样的机制可以实现吗？怎么实现？
```

### Understanding
Implement a repo-level delegation gate so the main agent decides whether a task should stay on the main thread or be recommended for sub-agent handling, and asks the user for an explicit choice before any delegated execution starts.

### Plan
1. Add a concise delegation policy to the repo operating guides.
2. Create a durable reference doc that defines when delegation is recommended, when it is not, and how the user-choice handshake works.
3. Wire the new doc into the docs index and docs integrity check.
4. Validate the docs surface after the change.

### Actions Taken
- Added a concise repo-level delegation gate to `AGENTS.md`:
  - main thread decides whether delegation is recommended
  - sub-agents must not be started silently
  - the user must choose before any delegated execution starts
  - the no-repeat rule applies if the user declines delegation
- Added Codex-specific delegation-handshake guidance to `.codex/AGENTS.md`:
  - classify work as `main-thread default` or `delegation recommended`
  - state the reason, suggested role, and explicit choice before spawning any child agent
- Added a durable reference doc:
  - `docs/references/sub-agent-delegation.md`
  - defines the hard rule, delegation signals, role mapping, ask pattern, and examples
- Updated `docs/references/index.md` so the delegation policy is discoverable from the docs system.
- Updated `scripts/check-docs.mjs` so the new reference doc is part of the checked docs surface.

### Validation
- `npm run check:docs`: PASS

### Result
Success. The repository now has an explicit delegation-gate mechanism: I decide whether delegation is recommended, I ask you before any sub-agent starts, and the decision rule is stored in the repo instead of depending on ad hoc memory.

## Step 7

### User Instruction
```text
# Review findings:

## Finding 1 (AGENTS.md:29-32) [added]
[P1] Ensure Codex control files are actually committed

The root operating guide makes `.codex/` part of the repository contract, but the current worktree still shows `.codex/` as untracked. If these files are not included when this change lands, the repo will point future agents at Codex control surfaces and role configs that do not exist in the checked-out project.

## Finding 2 (AGENTS.md:54-55) [added]
[P2] Session memory is normative but no longer validated

This repo still requires file-changing instructions to update the active session log using the exact template, but the new validation path only checks `docs/`. Since the old log validator was removed, broken session pointers, skipped step numbers, or template drift can pass `check:local` and `check:verify`.

## Finding 3 (.github/workflows/submit.yml:15-20) [added]
[P3] Submit workflow bypasses the repo verification gate

The publish workflow installs, builds, and packages directly, but the repo's combined verification surface is now `npm run check:verify`. This means the only remaining GitHub workflow can create a publishable artifact without running docs or memory-system checks.

## My request for Codex:
我完全同意你的观点,现在开始修复吧。修复如果,对,修复吧。
```

### Understanding
Fix the accepted review findings by making the Codex control layer part of the tracked change set, restoring automated session-memory validation, and making the submit workflow use the repository verification gate before publishing.

### Plan
1. Add a focused memory validation script for `codex/current-session.md`, `codex/log-template.md`, and the active session log.
2. Wire memory validation into `package.json` and `check:local`.
3. Make the submit workflow run `npm run check:verify`.
4. Stage `.codex/` so the root `AGENTS.md` references resolve in the repository change set.
5. Validate the updated gates.

### Actions Taken
- Added `scripts/check-memory.mjs` to validate the repository's session-memory surface:
  - `codex/current-session.md` pointer format
  - active session log existence
  - contiguous step numbering
  - required section presence in every step
  - `codex/log-template.md` exact template structure
- Added `npm run check:memory`.
- Updated `check:local` so it now runs:
  - `check:docs`
  - `check:memory`
  - `test:ui-logic`
  - `test:e2e:mock`
  - `check:live-gate`
- Updated `.github/workflows/submit.yml` so the publish workflow runs `npm run check:verify` before publishing.
- Updated `README.md` and `AGENTS.md` to include the new memory check command.
- Hardened `scripts/check-docs.mjs` provenance validation so quoted or inline absolute local paths are also rejected.
- Inspected `.codex/` for obvious secret names and staged it so the Codex control layer is part of the repository change set.

### Validation
- `npm run check:docs`: PASS
- `npm run check:memory`: PASS
- `npm run check:local`: PASS
  - required escalation because sandboxed `tsx` could not create its local IPC pipe
  - `test:ui-logic`: 35 passed
  - `test:e2e:mock`: 11 passed
  - `check:live-gate`: SKIP because live provider config is unavailable
- `npm run check:verify`: PASS
  - includes `check:local`
  - includes `npm run package`

### Result
Success. The accepted review findings are fixed: `.codex/` is staged, session memory is now validated by the local gate, and the submit workflow uses the repository verification gate before publishing.

## Step 8

### User Instruction
```text
好的做吧
```

### Understanding
Implement the accepted harness architecture review fixes: make the Codex agent manifests valid, replace unsupported Codex config fields, add a `.codex` validation gate, stage the docs memory tree, and ignore Playwright test artifacts.

### Plan
1. Update `.codex/config.toml` to use the supported instruction key.
2. Add required identity fields to `.codex/agents/*.toml`.
3. Add `scripts/check-codex.mjs` and wire it into `package.json` and the local verification gate.
4. Ignore `test-results/` and stage the docs memory tree without ignored artifacts.
5. Run the updated verification commands and record results.

### Actions Taken
- Replaced `.codex/config.toml` `persistent_instructions` with the supported `developer_instructions` key.
- Added required `name` and `description` fields to:
  - `.codex/agents/docs-researcher.toml`
  - `.codex/agents/explorer.toml`
  - `.codex/agents/reviewer.toml`
- Added `scripts/check-codex.mjs` to validate:
  - `.codex/config.toml` existence
  - absence of `persistent_instructions`
  - presence of `developer_instructions`
  - `features.multi_agent = true`
  - declared agent `config_file` paths
  - agent `name`, `description`, and `developer_instructions`
  - agent `name` matching the configured role name
- Added `npm run check:codex`.
- Updated `check:local` so it now starts with `check:codex`.
- Updated `README.md` and `AGENTS.md` to list `check:codex`.
- Added `/test-results` to `.gitignore`.
- Staged the new `docs/` memory tree so the project memory system is part of the repository change set.

### Validation
- `npm run check:codex`: PASS
- `npm run check:docs`: PASS
- `npm run check:memory`: PASS
- `npm run check:local`: PASS
  - includes `check:codex`
  - includes `check:docs`
  - includes `check:memory`
  - includes `test:ui-logic` (35 passed)
  - includes `test:e2e:mock` (11 passed)
  - includes `check:live-gate` (SKIP: live provider config unavailable)
- `npm run check:verify`: PASS
  - includes `check:local`
  - includes `npm run package`

### Result
Success. The Codex control layer is now schema-checked by the repo gate, the docs memory tree is staged, Playwright artifacts are ignored, and the full verification gate passes.

## Step 9

### User Instruction
```text
那让我们继续把，我们实现这个段落翻译的功能，让我看看我们搭建的 harness 有什么实际的效果
```

### Understanding
Implement the first constrained paragraph-translation mode, keeping the accepted word and sentence paths intact while making the new behavior visible through the existing test and harness layers.

### Plan
1. Inspect the current selection rules, card rendering path, and test entrypoints.
2. Add explicit paragraph-selection constraints and a user-visible card message for blocked selections.
3. Add unit and mock-E2E coverage for the new limits and rerun the verification matrix, including live acceptance if configuration is available.
4. Update the product memory docs to reflect the accepted paragraph constraints.

### Actions Taken
- Added explicit paragraph-selection support analysis in `lib/selection-ui.ts`, including:
  - single-paragraph validation
  - maximum `250` whitespace-delimited words
  - maximum `1500` characters
  - machine-readable rejection reasons for UI and tests
- Updated `ui/selection-translator.tsx` so unsupported paragraph selections keep the translation card visible and show guidance instead of silently disappearing.
- Prevented blocked paragraph selections from sending runtime translation requests.
- Added unit coverage in `tests/selection-ui.test.ts` for accepted paragraph input, multi-paragraph rejection, and word-limit rejection.
- Added mock browser regression coverage in `tests/e2e/selection-flow.spec.ts` to verify:
  - the guidance card appears for oversized paragraph selections
  - no translation request is sent for blocked selections
  - troubleshooting logs capture the rejection reason
- Updated the product and requirement memory docs to record the accepted paragraph constraints and timeline entry.

### Validation
- `npm run check:verify`: PASS
- `npm run test:live`: PASS
- Initial concurrent verification attempt exposed a Playwright artifact-directory collision when two Playwright suites were run in parallel against the same repo workspace; the paragraph-mode assertions themselves passed, and the full suite passed once rerun serially.

### Result
Success. Paragraph mode now has an explicit first interaction contract, blocked paragraph selections produce user-visible guidance instead of silent failure, and the harness demonstrates both the new guardrail behavior and a real operational lesson about Playwright artifact collisions under parallel local runs.

## Step 10

### User Instruction
```text
好,下一步继续。
```

### Understanding
Start the vocabulary-history work on a dedicated feature branch and persist the first implementation-ready requirement and execution plan before writing product code.

### Plan
1. Create and switch to `codex/vocabulary-history`.
2. Add the active vocabulary-history PRD and requirement changelog.
3. Add the active execution plan with lightweight status tracking.
4. Update active requirement and execution-plan indexes plus the global requirement timeline.
5. Validate docs and memory checks before implementation starts.

### Actions Taken
- Created and switched to branch `codex/vocabulary-history`.
- Added the active vocabulary-history requirement stream:
  - `docs/requirements/active/vocabulary-history/PRD.md`
  - `docs/requirements/active/vocabulary-history/CHANGELOG.md`
- Added the active implementation plan:
  - `docs/exec-plans/active/vocabulary-history.md`
- Updated discovery and memory indexes:
  - `docs/requirements/active/index.md`
  - `docs/exec-plans/active/index.md`
  - `docs/requirements/history/timeline.md`
  - `docs/product-specs/current-state.md`
- Corrected the session step number after `check:memory` caught a gap from Step 9 to Step 11.

### Validation
- `npm run check:docs`: PASS
- `npm run check:memory`: PASS

### Result
Success. Vocabulary-history product requirements and execution plan are now persisted before implementation, and the active docs/memory gates pass.
