# Probe dispatch receipt

The user authorized a new BF-bound top-level thread after T3 rejected cross-project local delegation from the Lensmap thread.

- Thread: `<t3-thread://v2/83112fd3-0947-4d13-a1db-a76bf59117a7/mcp:launch:8a27d89df6ab2dc0b68e84d9b4a3c59b61112563a5e0cdbf2f0524178224fff1>`
- Thread ID: `mcp:launch:8a27d89df6ab2dc0b68e84d9b4a3c59b61112563a5e0cdbf2f0524178224fff1`
- Project: `7307e527-6f74-4d79-9bfa-067c8bb78166` (`/home/ensu/Projects/bastion-falls-astro`).
- Requested native workspace strategy: new worktree, branch `lensmap-integration`, base `75725a65c8b120302049c4e91cf1ba3e09cd6994`, `startFromOrigin: false`.
- Launch request ID: `bf-lensmap-integration-worktree-thread-20261107-01`. Reuse this ID if reconciling a lost launch reply; do not duplicate the thread.
- Returned run: `run:thread:mcp%3Alaunch%3A8a27d89df6ab2dc0b68e84d9b4a3c59b61112563a5e0cdbf2f0524178224fff1:ordinal:1`.
- Returned provider/model: `acpRegistry_ran_acp`, `openai-codex:gpt-6.1-sol`; inherited options `reasoning_effort: xhigh`, `service_tier: fast`, `edit_approval_policy: session`.
- Initial readback: BF project and requested branch confirmed; workspace preparation active, worktree path not yet assigned, provider run not yet started. This is a dispatch-time observation, not the current completion state or probe evidence.
- Canonical scope: [brief.md](brief.md). The new thread received its absolute path and instructions to execute the probe, verify BF checkout identity before writing, preserve primary checkouts, and report artifacts back to the Lensmap design-owner thread.

No result, completed build, ready worktree or working integration is established by this receipt. Recover the named thread and its report before continuing or launching replacement work. The failed earlier cross-project delegate request returned no task handle.

The subsequently exercised PoC and its final evidence are recorded in [results.md](results.md). The dispatch-time preparation status above remains historical.
