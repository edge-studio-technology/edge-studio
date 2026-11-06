---
name: commit-message
description: This skill should be used when the user asks to "write a commit message", "give me a commit message", "commit message please", or wants a git commit message generated for the current changes without actually running `git commit`.
---

# Commit Message

Produce a single-line commit message subject for the current changes. Output the subject line only — no body, no bullet list, no trailing `Co-Authored-By` line.

## Process

1. Run `git status --short` and `git diff --cached` to see what's staged. If nothing is staged, use `git diff` instead.
2. Read `docs/guides/releases.md` for the current Conventional Commit policy; older history may use the superseded plain-subject format.
3. Write a Conventional subject describing the effect, for example `feat(devices): support a new sensor`, `fix(workflows): handle a missing device` or `ci: automate release preparation`. Use the type matching the actual change, an optional scope, and a short imperative description without a trailing period. Add `!` for a breaking change and ensure migration details are documented. Do not prefix the subject with an OpenProject identifier. Feature PRs squash into `dev` using their Conventional title; promotion and synchronization merge commits preserve history.
4. Output only that single line, in a fenced code block, with no preamble ("Here's a commit message:"), no explanation, and no alternatives to choose from.
5. Do not run `git commit`. Do not add a `Co-Authored-By` trailer or any other trailer. This skill only produces text for the user to commit themselves.
