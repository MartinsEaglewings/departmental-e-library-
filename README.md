# Departmental E-Library — Termux starter

This is a **portable starter rebuild** of the Departmental E-Library interface, not a byte-for-byte export of the AppDeploy project. AppDeploy's original backend depends on `@appdeploy/sdk` and `@appdeploy/client`, so it cannot be deployed unchanged to Render without replacing those services.

## Current features
- Responsive green-and-gold academic library interface
- Search, department and level filters
- PDF upload up to 8 MB, download and local deletion
- Local browser storage for this demo

## Important limitations
This starter is browser-local: uploads are stored in the current browser on the current device, not shared with other users. It has no real login, shared database, or server-side file storage. Do not treat it as a production public library yet. A Render deployment of this front end will serve the page, but each visitor's resources remain private to that visitor's browser.

## Run in Termux
Install Node.js and Git if needed, then:
```sh
cd ~/departmental-e-library
npm install
npm run dev -- --host 0.0.0.0
```
Open the local URL printed by Vite. For a production build:
```sh
npm run build
```

## Before public launch
Implement server-backed authentication, a persistent database, and object storage; add upload authorization and malware/content checks; then configure Render environment variables and test the full deployment. Keep the original AppDeploy site as a backup until the replacement is verified.