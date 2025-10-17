# Clip2Demo exporter

Clip2Demo is a Chrome DevTools extension that captures a selected DOM subtree and assembles a self-contained demo with HTML, CSS, optional JavaScript listeners, and linked assets. The project is organized into two main areas:

- `extension/` – Manifest V3 Chrome extension sources (DevTools panel UI, inspected page bridge, background worker, and optional AI helpers).
- `core/` – TypeScript utilities that mirror the extraction and packaging logic for unit testing or reuse in other runtimes.

## Features

- Capture the current selection from the Elements panel or a custom selector.
- Serialize markup with resolved asset URLs and optional computed style fallbacks.
- Extract relevant author CSS rules, inline handlers, and registered event listeners.
- Gather referenced assets (images, fonts) with an option to inline them as data URIs.
- Package captures into a single downloadable HTML document or open a prefilled CodePen demo.
- Optional AI hooks for CSS minimization and behavior reconstruction.

## Development

1. Load `extension/` as an unpacked extension in Chrome.
2. Open DevTools on any page and switch to the **Clip2Demo** panel.
3. Select an element in the Elements panel, configure capture options, and click **Capture subtree**.

The core TypeScript modules are framework agnostic and can be compiled with your bundler of choice to target additional runtimes or automated tests.
