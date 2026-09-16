[← Back to index](./README.md)

# Phase 0 — Product decision gate

**Covers:** [2] (high), [5]. Not code. The findings themselves are described in
[Findings in detail](#findings-in-detail) below.

Both are **provisionally defaulted to acceptance** so implementation is not blocked. Neither default
is confirmed; both are re-opened at the [pre-merge decision pass](./README.md#pre-merge-decision-pass).

| Decision | Provisional default | Confirm by | Outcome if confirmed |
| --- | --- | --- | --- |
| [2] First-boot provisioning — enrollment code, physical presence, or documented acceptance | accept, document the LAN threat model | pre-merge | ADR + `SECURITY.md` entry; stays open/accepted in `docs/security/` |
| [5] MQTT device authentication model | accept as-is; off by default and profile-gated | pre-merge | ADR; DEVICE-IO-04/05 and the MQTT half of DEVICE-IO-06 stay open |

Where the choice is acceptance, the matching `docs/security/` entry stays **open/accepted** —
accepted risk is not closed risk, and the register must not read as though it were.

If [2] is overturned at the pre-merge pass, it gets a numbered phase and moves ahead of Phase 5: on
ADR 0010's ordering it outranks everything below Phase 4. That is the one default whose reversal
costs real rework, so raise it early rather than at the pass.

---

## Findings in detail

Each needs a call before any code, and each gets an ADR recording it.

- **[2] Unauthenticated first-boot admin claim (high).** Whoever reaches the appliance first
  becomes admin. Real, and severe if the Pi is powered on in an untrusted network before setup.
  Options: a printed/derived enrollment code, a physical-presence requirement, or accepting it
  with the LAN threat model documented. ADR 0010's ordering assumes a managed single-admin LAN;
  this finding is the one that moves furthest up if that assumption ever changes.
- **[5] Anonymous MQTT (medium).** `mosquitto.conf` has `allow_anonymous true` on
  `listener 1883 0.0.0.0`. Off by default and profile-gated, but unauthenticated when on.
  Needs a device-authentication model, not a config tweak. DEVICE-IO-04 (broker auth) and
  DEVICE-IO-05 (TLS, topic ACLs, bind controls) are the concrete work once that call is made.
