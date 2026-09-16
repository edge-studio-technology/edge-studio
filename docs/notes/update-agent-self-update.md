# Update-agent self-update support

**Status:** Implemented.

`update-agent`'s digest is carried in the signed manifest but remains excluded from
`MANIFEST_SERVICE_KEYS` (`["frontend", "backend"]`). It updates itself through the dedicated
`update-agent/src/self-update/` path rather than the generic service swap loop.

The running agent launches a one-shot orchestrator from the target image. That orchestrator starts
and health-checks a candidate container before stopping the current agent. If the candidate fails,
the current container remains running.

This separate orchestration is required because the normal update supervisor cannot safely replace
its own running container from inside that same container.
