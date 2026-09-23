# ADR (Architecture Decision Records)

- Rationale, tradeoffs, rejected alternatives, and decision history belong in `docs/adr/`, never inline.
- Changelog entries, commit messages, and code comments state what changed, not why. Point to the ADR file instead of carrying the reasoning.
- Use the `adr` skill to create or update an ADR.
- ADR numbers are unique. After merging `dev` (or any base branch) into a branch, run `ls docs/adr | cut -c1-4 | sort | uniq -d` before committing the merge. If a number is duplicated, keep the base branch's ADR and renumber the branch's own ADR to the next free number: rename the file, update its heading, and update every repo reference, including the `docs/README.md` table.
- When an ADR is renumbered, leave existing OpenProject comments unchanged and add one new comment to each ticket that cited the old path, naming the new path.
