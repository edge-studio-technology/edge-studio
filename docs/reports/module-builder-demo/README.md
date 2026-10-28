# Module Builder vision demo

This is a disposable frontend concept on the module-builder branch. It presents the Module Builder and a public-facing library website using sample content and in-memory interactions. It does not implement the extension platform or satisfy the real lifecycle milestone in the [implementation plan](../../plans/module-builder.md).

## Open the demo

From the repository root:

```bash
npm --prefix frontend run dev
```

Use the Local URL printed by Vite (normally port 3030):

- [Module Builder](http://localhost:3030/demo/modules)
- [Public library concept](http://localhost:3030/demo/library)
- [Example editor](http://localhost:3030/demo/modules/editor/greenhouse-monitor)

The routes work without backend services, a login, or a Pi. The normal application sidebar also has a Module builder entry with a Demo badge. Both concept surfaces are served by this frontend; there is no separate hosted website.

The demo reflects the [workshop revision](../../plans/module-builder/workshop-revision.md). The top bar separates Phase 1 (local creation, editing, testing, packaging, activation, import/export) from Phase 2 (hosted discovery, publishing, reputation, and a paid-module concept). Phase 1 does not require a library account. The same demo session connects both concepts for presentation purposes.

## Suggested presentation walkthrough

1. Start at Module Builder. Explore Installed, Drafts, Updates, and Activity. A manual update opens a backup prompt before applying the sample version change.
2. Remove HTTP Toolkit. Its installed entry disappears; the rest of the demo remains usable.
3. Follow Public library. Browse collections, search HTTP, and open HTTP Toolkit's listing.
4. Explore Overview, Setup, Versions, Source, and Access. Add the module and inspect the pre-install backup prompt. Export device/logs downloads clearly labelled sample files, not real backups. Installation leaves the module inactive; return to Module Builder and activate it explicitly with its switch.
5. Open Drafts, then Greenhouse Monitor. Edit a file and save it; change the temperature threshold and run Test sample. The result is an illustrative temperature preview, not execution of the edited code. Use Preview surface to switch between the workflow block, device setup form, and hardware support card; connection/enable controls change sample state only.
6. Open AI-assisted creation. The guide explains external generation in the user's own harness using the planned module-builder-skill, followed by in-app editing and tools. Download example skill provides an illustrative hand-off, not the production skill. No CLI or built-in AI service is connected.
7. Choose Validate draft, then Package demo module. Basic checks inspect manifest/config JSON and entry-file presence; they do not compile or execute code. Packaging downloads a demo snapshot. Any code or metadata change invalidates the current validation/package status. Activate locally becomes available after packaging and includes the backup prompt. A local copy appears under Installed.
8. Choose Publish · Phase 2. Review the basic check results, acknowledge your right to share, and publish the demo listing. No human approval gate is shown. The listing is immediately visible with post-publication spam/content moderation pending. Community management is the long-term goal; AI checks are only a possible future addition.
9. Open the published listing's Source tab and inspect the captured release files. Later saved draft edits do not change those published files. Community inspection reports are separate from ratings and purchase reviews; sample reports reset when leaving Source.
10. Explore GPIO Workshop's paid-module concept. Source is inspectable before purchase. Preview purchase and Record demo purchase create a sample entitlement without a payment. Export sample receipt downloads an unsigned placeholder. Commerce is required in Phase 2; provider, pricing, subscriptions and update terms remain undecided. Add to Edge Studio then demonstrates the backup and full-host-access acknowledgements.
11. Use Create module for a starter draft. Import module reads a source/package JSON snapshot exported by this demo and preserves its source; invalid imports leave existing drafts unchanged. Paste externally generated code directly into the editor, or use a compatible demo snapshot for the file-import walkthrough.

Use on-page links to retain shared demo state. Refreshing, opening a new tab, or choosing Reset demo starts over; Reset also returns to the module manager. Export source downloads `.source.demo.json`; packaging downloads `.module.demo.json`. Both are JSON snapshots accepted by this demo, not production executable packages or device backups. Backup samples explicitly declare `restorable: false`; receipts declare `signed: false`. No restore or license verification occurs. Sample names, versions, publishers, popularity, compatibility, releases, and output are illustrative. MIT in starter files is sample metadata, not an adopted library-wide license; D8 remains open.

## Ratings and builder profiles

Library cards and module listings show numeric download counts, a 1-5 star average, and the rating count. Installed modules retain these figures. Use Rate this module on a listing to submit a sample vote, then Edit to replace it without adding another voter. Unrated listings show Not rated rather than a zero score.

Click a builder's name to inspect their profile, modules, total downloads, and aggregate rating. The aggregate is the sum of all star values divided by the number of ratings across their published modules, not an unweighted average of their module averages. Private/local modules are excluded. New public listings start with no ratings or downloads. Republish preserves an existing listing's statistics.

Top rated sorts by module average (then rating count); Most downloaded sorts by numeric download totals. Sample installs/reinstalls and updates increment a public module's counter; no real download is performed or measured. All votes and counter changes remain in the current demo session and reset on refresh/reset. Popularity and ratings are not code-safety guarantees.

## Scope and boundaries

- All new sample data, local state, components, and dialogs live in `frontend/src/features/module-builder-demo/`.
- The demo is lazy-loaded from `frontend/src/App.tsx` before the authenticated application mounts. It makes no backend/API calls and has no access to the real app's authenticated state.
- The library is a frontend vision, not a working catalog service. Install, activation, update, removal, and publication alter sample state only.
- Source text is never evaluated. Test sample parses a temperature fixture and compares it with the chosen threshold; malformed input displays an error.
- File import reads only a user-selected demo JSON snapshot into browser memory. No source is uploaded. Published source is an in-memory copy; seeded listings use illustrative fixtures rather than real driver code. Source export and device/log sample exports stay local.
- Paid distribution is required Phase 2 scope, represented here by a simulation with no checkout, pricing commitment, payment verification, signatures, DRM, or license enforcement. Publisher identity and inspection reports do not certify safety.
- No shell, hardware-agent, Docker, device, package-manager, file-upload, or publishing service is connected.
- Existing authentication and API protections remain in force on ordinary routes. The demo paths themselves are intentionally unauthenticated and expose only sample content.

## Verification

Browser walkthrough in hidden Chrome: manager entry without backend/login; uninstall/reinstall; separate install/activation; backup prompts and sample exports before install/update/local activation; skill hand-off; malformed manifest rejection and preparation invalidation after edits; source/package exports and round-trip import; invalid-import preservation; publication and pending moderation; immutable published source despite later draft edits; inspection reports; paid entitlement/unsigned receipt; ratings and sorting; schema previews; and tablet/phone layouts (1440, 768, and 390px). No backend API requests or browser runtime errors occurred. Checked manager, library, editor, source inspection, and the skill dialog for horizontal overflow on smaller screens.

Frontend lint, TypeScript/Vite production build, and 12 focused module-demo tests passed. Earlier full-suite verification had one unchanged settings-page storage-history failure because its render omits ToastProvider; the full suite was not rerun for this isolated concept update. Repository-wide docs lint remains blocked by Windows path comparisons and existing mirror/ADR issues. Browser screenshots capture the concept, not a working privileged extension system.

## Screenshots

- [Module manager](./module-manager.png)
- [Public library](./public-library.png)
- [Module details](./module-details.png)
- [Module rating and new-builder score](./module-ratings.png)
- [Builder reputation profile](./builder-reputation.png)
- [Editor and block preview](./module-editor.png)
- [Device setup preview](./device-setup-preview.png)
- [Hardware support preview](./hardware-support-preview.png)
- [Publish preview](./publish-preview.png)
- [Host access preview](./host-access-preview.png)
- [Backup before installation](./backup-before-install.png)
- [Backup before manual update](./backup-before-update.png)
- [Skill-assisted creation guide](./skill-assisted-creation.png)
- [Release source inspection](./release-source-inspection.png)
- [Source inspection before purchase](./paid-source-before-purchase.png)
- [Paid-module purchase concept](./paid-module-purchase.png)
- [Phone source inspection](./release-source-mobile.png)
- [Tablet manager](./module-manager-tablet.png)
- [Phone manager](./module-manager-mobile.png)
- [Phone editor](./module-editor-mobile.png)
- [Phone library](./public-library-mobile.png)

## Discarding the concept

Remove the demo feature folder, its lazy import and route branch in App, its nav entry/icon and NavId member, and these demo report files. Remove the matching demo-only README/security/changelog/index/session/task entries when cleaning up the branch. No database, backend, package dependency, environment, or runtime service changes need reverting. Keep the implementation plan and earlier stakeholder research/presentation if they remain useful.
