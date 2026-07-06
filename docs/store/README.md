# Chrome Web Store assets

Ready-to-upload screenshots for the Chrome Web Store listing, sized to the
store's **1280×800** requirement (light mode, since the store shows one theme).

| File | Shows |
| --- | --- |
| `record.png` | The Record split button and past sessions — getting started. |
| `recording.png` | A live recording: timeline of clicks, network, screenshots, and voice. |
| `annotate.png` | The annotation editor marking up a frozen screenshot. |
| `report.png` | The rendered report beside the export panel with detail levels. |

Suggested upload order: `recording` → `report` → `annotate` → `record`.

The website and README use the higher-resolution, theme-aware versions under
`docs/screenshots/` (light + dark, swapped via `<picture>`). Regenerate all of
these from source captures if the UI changes.
