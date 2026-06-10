# Sohoj TV

Sohoj TV is a static live TV website by Butterfly Devs. It loads channels from `web/sohoj-tv-api.json` and plays HLS streams with `hls.js`.

Brand assets live in `assets/`; `assets/sohoj tv logo.jpg` is mirrored into `web/assets/sohoj-tv-logo.jpg` for the web build.

## Run

Serve the `web` folder with any static server:

```bash
npx http-server web -p 8080 -c-1
```

Then open:

```text
http://localhost:8080
```

Do not open `web/index.html` directly with `file://`, because browsers can block the JSON fetch.
