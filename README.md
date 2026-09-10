# Ginomai Pro

> **The Word in Motion**

Next-Generation Church Presentation, Multi-Monitor Projection & Broadcast Media System.

---

## Highlights

- **0ms Tactile Latency**: Instantaneous slide switching, verse transitions, and agenda sequencing.
- **Presenter Studio & Multi-Display Engine**: Native multi-monitor projection, OBS NDI/browser integration, Lower-Thirds, and sanctuary projection.
- **Bento & Modern Workstation**: High-contrast, hardware-accelerated interface without GPU-heavy blur bottlenecks.
- **Embedded Broadcast Server**: Serves mobile and tablet remote operator consoles over LAN.
- **Automated Over-The-Air (OTA) Updates**: Differential background updates powered by `electron-updater` and GitHub Releases.

---

## Desktop Development & Building

### Run Locally (Desktop)
```bash
npm start
```

### Build Installers (Local)
```bash
npm run dist:win
```

### Publish Over-The-Air (OTA) Release
```powershell
$env:GH_TOKEN="your_github_token"
npm run dist:publish
```
