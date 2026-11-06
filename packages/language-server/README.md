# @lensmap/language-server

Experimental Lensmap stdio language server and authenticated loopback browser
preview. Includes its compiled browser assets; npm installs the document engine
and other runtime dependencies before startup. No workspace checkout, pnpm,
Rust, runtime dependency download or separate web server is needed to run it.

Requires Node 24.16 or newer. ESM only. The API and document format are
experimental. Native host integration is currently qualified on Linux/X11;
other platforms are not yet qualified. Automatic browser launching uses
`xdg-open`; `--no-open` leaves opening the preview URL to the host/client.

```sh
npm install --global @lensmap/language-server@next
lensmap-lsp --help
lensmap-lsp --configure-zed --zed /usr/bin/zeditor
```

The last command **prints** settings, without modifying your editor. Use your
verified Zed executable path. Keep the Node installation and package path stable,
and regenerate settings if either changes. Zed still requires the separately
installed Lensmap **dev extension** from the source repository's `editors/zed`
directory; the npm package does not install or register an editor extension.

The editor launches `lensmap-lsp --stdio`. Its stdout is reserved for LSP; it is
not a standalone saved-file viewer or persistent background web daemon. Attach a
`.lensmap` buffer and invoke **Lensmap: Open preview** through editor code
actions. The server defaults to its package-local built viewer. `--assets PATH`
remains available for development/custom assets.

Preview URLs and API tokens are private per-run credentials. Do not log, paste
or retain them in traces. The server binds to loopback, validates Host/Origin,
and limits source access to attached buffers. Content writes use revision checks
and live-buffer readback, **not atomic compare-and-swap**.

See [Zed setup, API and limitations](https://github.com/nicodoggie/lensmap/blob/main/docs/zed-browser.md).
The library export exposes `startServer` and its TypeScript declarations; custom
hosts supply their own `assets` and host callbacks. MIT licensed; see `LICENSE`.
