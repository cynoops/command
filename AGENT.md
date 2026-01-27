# AGENT Guidelines

## Purpose
Use this document while collaborating with AI on the **cynoops command** application to ensure safe, consistent, and high‑quality code changes.

## General Rules
- Be explicit, concise, and reproducible in all prompts.
- Prefer small, incremental changes with clear rationale.
- Keep a changelog entry or commit message for every change.
- Do not introduce new dependencies without approval; justify any additions.
- Maintain cross-platform compatibility (macOS/Linux) and avoid hardcoded paths.

## Pre-Change Checklist (AI must verify)
- [ ] Understand the task and existing behavior; restate the goal.
- [ ] Identify impacted files, modules, and interfaces.
- [ ] Confirm tests to update or add.
- [ ] Check coding standards: formatting, linting, typing (if applicable).
- [ ] Review security implications: input validation, secrets handling, logging of sensitive data.
- [ ] Confirm backward compatibility and public API stability.

## Implementation Guidelines
- Keep functions small, pure where possible, and well-named.
- Add or update docstrings and comments only where they add clarity.
- Use consistent error handling; return actionable error messages.
- Prefer standard library over new packages.
- Include examples in docs for new/changed behaviors.

## Post-Change Checklist (AI must perform)
- [ ] Summarize the change and its intent.
- [ ] List files modified and why.
- [ ] Run formatting and linting.
- [ ] Run tests and report results (or why they were not run).
- [ ] Re-check security/privacy concerns.
- [ ] Note any follow-up tasks or open questions.

## Code Quality Checks
- **Style**: Enforce project formatter/linter (e.g., `ruff`, `black`, `eslint`, etc. as applicable).
- **Types**: Run type checker if available (e.g., `mypy`, `tsc`).
- **Tests**: Run relevant test suite or targeted tests for changed areas.
- **Docs**: Update README/usage docs when behavior changes; ensure examples still work.

## Review Guidance
- Validate logic and edge cases.
- Ensure errors and logs are actionable and not verbose with secrets.
- Confirm performance implications for critical paths.
- Keep PRs minimal; defer extras to future tasks.

## Communication
- When unsure, ask clarifying questions.
- Provide step-by-step plans before large changes.
- Report any assumptions made.

## Safety and Compliance
- Never commit secrets, tokens, or credentials.
- Avoid unsafe commands in examples; use placeholders.
- Respect licenses and note third-party code origins.

Use this file as a pre-flight and post-flight checklist whenever using AI to propose, implement, or review changes.