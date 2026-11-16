# Contextual contribution links — 2026-11-16

Implemented on feat/help-feedback. Devices and Workflows have matching secondary request/contribution strips below pagination. The device picker and workflow toolkit have compact request links; the picker link disappears once a device's configuration starts. Requests are clearly labeled public and open fixed, specific GitHub forms. Contribution links open the matching device/workflow guide. No app context or private data is added to URLs.

## Verification

- All 60 existing list/picker/toolkit tests passed, including assertions for exact request/guide destinations, safe new-tab attributes and selection-stage placement. Existing list, wizard and block interactions remain covered.
- All 1,840 frontend tests passed with coverage (92.33% lines), and frontend lint/typecheck/build plus docs/whitespace checks passed. Existing Vite native-config/chunk-size warnings remain. Root full checks were not repeated for this frontend-only change; previously documented Windows root-script limitations still apply, and Ubuntu CI remains the merge gate.
- Isolated browser previews used the real list/picker/toolkit components with synthetic data and intercepted API responses. Devices, Workflows and Toolkit were checked at 1440/390 px; the existing desktop-only device wizard was checked at 1440 px. New support-link regions had no horizontal overflow; no runtime exceptions or API writes occurred.
- Screenshots were visually reviewed. No public issue, device action, workflow execution or feedback submission was created. No backend code or GitHub settings changed.
- Temporary preview sources and the frontend-only server were removed/stopped after verification.

## Screenshots

- [Devices footer](./devices-1440.png)
- [Workflows footer on mobile](./workflows-390.png)
- [Device picker](./wizard-1440.png)
- [Toolkit on mobile](./toolkit-390.png)
- [Browser results](./results.json)
