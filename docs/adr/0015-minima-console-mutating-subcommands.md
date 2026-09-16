# 0015: Constrain Mutating Subcommands in the Minima Console Catalog

**Status:** Accepted
**Date:** 2026-09-08

## Context

The V1.5 external security review, finding [10]: the Minima RPC console resolves a submitted
command against its catalog by the **first token only**. Three catalog entries are classified
`read` and therefore default-enabled, but their verbs also accept mutating `action:` forms:

- `tokens` — `action:import` writes to the node's token database; `action:export` is a read.
- `maxcontacts` — `action:add` / `action:remove` change the Maxima contact list; `action:list` and
  `action:search` are reads.
- `cointrack` — every documented form changes coin tracking state. It has no read form at all, so
  it was misclassified outright rather than under-constrained.

The catalog's own labels ("List, import, or export tokens", "Track or untrack a coin", "Manage
Maxima contacts") already described the mutating forms; the classification did not follow them.

ADR 0010 rated this medium. The plan offered two fixes: constrain the accepted argument shape per
entry, or default the three verbs to disabled.

## Decision

Constrain per entry, except where no read form exists.

Classification is now **per accepted argument shape, not per verb**. A verb whose `action:` argument
can turn a read into a mutation gets a sibling entry — `kind: "write"`, `defaultEnabled: false` —
listed ahead of the read entry, whose `match()` claims every `action:` value outside an explicit
read allowlist. Lookup already returns the first entry whose `match()` succeeds, so the mutating
form resolves to the disabled entry and is refused unless an admin deliberately enables it. This
reuses the `peers` / `peers.add` pattern already in the catalog rather than adding a second
mechanism.

The allowlist is on the **read** actions, so an `action:` value the catalog has never heard of falls
to the write entry and is disabled. A new mutating action added by a future Minima release is
therefore refused by default rather than silently allowed.

`cointrack` is reclassified `write` / default-disabled in full. Constraining it would mean writing
an allowlist with nothing in it.

## Consequences

- Operators who used `tokens action:import`, `maxcontacts action:add`/`action:remove`, or any
  `cointrack` form through the console must now enable the corresponding entry in the whitelist,
  which requires re-entering the admin credential.
- Read forms — bare `tokens`, `tokens action:export`, `maxcontacts action:list`/`action:search` —
  are unaffected and stay default-enabled.
- An existing stored whitelist that explicitly listed `cointrack` keeps it. That is an admin's prior
  explicit choice, and silently dropping it would be a surprise of a different kind. Defaults change
  only for deployments that never customized the whitelist.
- The `read()` / `write()` helpers no longer tell the whole story; `mutatingAction()` is the third
  case and the catalog header comment points at it.

## Alternatives considered

- **Default the three verbs to disabled.** The plan allowed this if recorded as a deliberate call.
  Rejected for `tokens` and `maxcontacts` because it removes working read-only functionality to fix
  a problem in the write forms. Accepted for `cointrack`, which has no read form to preserve.
- **Parse the full argument grammar per command.** Rejected as disproportionate: it means carrying a
  model of every Minima command's arguments and keeping it current against upstream, to gain
  nothing over allowlisting the read actions.
- **Blocklist the known mutating actions instead.** Rejected because it fails open — a mutating
  action introduced upstream would be allowed until someone noticed and added it.
