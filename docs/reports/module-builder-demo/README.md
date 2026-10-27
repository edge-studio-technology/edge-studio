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

## Suggested presentation walkthrough

1. Start at Module Builder. Explore Installed, Drafts, Updates, and Activity. Toggle a module or apply a sample update.
2. Remove HTTP Toolkit. Its installed entry disappears; the rest of the demo remains usable.
3. Follow Public library. Browse collections, search HTTP, and open HTTP Toolkit's listing.
4. Explore Overview, Setup, Versions, and Access. Add the module, then use View in workspace to see it restored in Installed.
5. Open Drafts, then Greenhouse Monitor. Edit a file and save it; change the temperature threshold and run Test sample. The result is an illustrative temperature preview, not execution of the edited code. Use Preview surface to switch between the workflow block, device setup form, and hardware support card; connection/enable controls change sample state only.
6. Choose Activate locally. A local sample module appears under Installed; clicking its title returns to its draft.
7. Choose Publish, review the listing, acknowledge the content check, and publish the demo listing. View in library opens the new community entry within the same session.
8. Explore GPIO Workshop in the library and choose Add to Edge Studio. Its access acknowledgement shows the planned privileged installation experience. Nothing is installed or executed.
9. Use Create module to try template selection and an editable new draft. Import module demonstrates package selection but creates starter content without reading the selected file.

Use on-page links to retain shared demo state. Refreshing, opening a new tab, or choosing Reset demo starts over; Reset also returns to the module manager. Source export downloads a `.demo.json` snapshot of the draft, not an executable package. Sample names, versions, publishers, popularity, compatibility, releases, and output are illustrative.

## Ratings and builder profiles

Library cards and module listings show numeric download counts, a 1-5 star average, and the rating count. Installed modules retain these figures. Use Rate this module on a listing to submit a sample vote, then Edit to replace it without adding another voter. Unrated listings show Not rated rather than a zero score.

Click a builder's name to inspect their profile, modules, total downloads, and aggregate rating. The aggregate is the sum of all star values divided by the number of ratings across their published modules, not an unweighted average of their module averages. Private/local modules are excluded. New public listings start with no ratings or downloads. Republish preserves an existing listing's statistics.

Top rated sorts by module average (then rating count); Most downloaded sorts by numeric download totals. Sample installs/reinstalls and updates increment a public module's counter; no real download is performed or measured. All votes and counter changes remain in the current demo session and reset on refresh/reset. Popularity and ratings are not code-safety guarantees.

## Scope and boundaries

- All new sample data, local state, components, and dialogs live in `frontend/src/features/module-builder-demo/`.
- The demo is lazy-loaded from `frontend/src/App.tsx` before the authenticated application mounts. It makes no backend/API calls and has no access to the real app's authenticated state.
- The library is a frontend vision, not a working catalog service. Install, activation, update, removal, and publication alter sample state only.
- Source text is never evaluated. Test sample parses a temperature fixture and compares it with the chosen threshold; malformed input displays an error.
- No shell, hardware-agent, Docker, device, package-manager, file-upload, or publishing service is connected.
- Existing authentication and API protections remain in force on ordinary routes. The demo paths themselves are intentionally unauthenticated and expose only sample content.

## Verification

Browser walkthrough in headless Chrome: manager entry without backend/login; uninstall/reinstall; library search and category filtering; source editing/save; sample output and invalid JSON; local activation; demo publication; host-access acknowledgement; tablet and phone layouts (1440, 768, and 390px). No backend API requests or browser runtime errors occurred. Checked manager, library, and editor for horizontal overflow on smaller screens.

Frontend lint and TypeScript/Vite production build passed. The existing frontend suite passed 1,782 tests; one unchanged settings-page storage-history test fails because its render omits ToastProvider. Repository-wide docs lint remains blocked by Windows path comparisons and existing mirror/ADR issues. Browser screenshots capture the concept, not a working privileged extension system.

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
- [Tablet manager](./module-manager-tablet.png)
- [Phone manager](./module-manager-mobile.png)
- [Phone editor](./module-editor-mobile.png)
- [Phone library](./public-library-mobile.png)

## Discarding the concept

Remove the demo feature folder, its lazy import and route branch in App, its nav entry/icon and NavId member, and these demo report files. Remove the matching demo-only README/security/changelog/index/session/task entries when cleaning up the branch. No database, backend, package dependency, environment, or runtime service changes need reverting. Keep the implementation plan and earlier stakeholder research/presentation if they remain useful.
