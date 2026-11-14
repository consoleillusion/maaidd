# MAID - Metric Assisted AI Driven Development

**MAID** is a Bun/TypeScript tool that gives developers and AI agents one measurable interface for iterating on a codebase.

**Problem:** AI-assisted changes lack objective governance. Agents add scope and dependencies without evidence that the code actually improved.

**Solution:** MAID combines formatting, FTA metrics, test results, git state, dependency analysis, and commit guidance into a structured feedback loop.

**Two interfaces, one core:**
- **CLI**. Fully usable standalone.
- **MCP server**. Identical inputs and payloads for agents.

Both expose:
- `status` Project, snapshot, git, score, and commit summary.
- `benchmark` Current vs baseline metrics and test changes.
- `score` Transparent weighted 0–100 commit score.
- `dependencies` Dependency impact and library guidance.
- `commit-guide` Commit readiness, size checks, split suggestions.

**Design principles:** deterministic over model-generated, transparent scoring, configurable governance, and small iterative commits.
