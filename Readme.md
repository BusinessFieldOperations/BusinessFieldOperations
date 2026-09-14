<div align="center">
<h3>Business Field Operations</h3>
<img src="src/favicon.svg" width="100" alt="logo" title="icon"/>
<hr/>
Business Field Operations is a App that helps you manage your business operations efficiently.
</div>

---

### Overview

### Structure

```
Frontend        -> PWA
                   Preact (React/SPA)
                   Tauri [Bundler]
                   Material 3 [UI]
                   PDF.js [report generation]
Backend         -> Postgresql [db]

Providers (Dev) -> Netlify (WebApp)
                -> Supabase
```

### Folder Stucture

```

PWA/  (PWA, vite)
DB/ (sql)
src/ (assets)
---
Test/ (Unit test)
Scripts/ (Automation)


```

### Project Structure

- [Git flow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow) (non strcit)
- `.gitignore` for each main folder (WebApp, Backend, Docs etc)
- Conventional Commits format [![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196?logo=conventionalcommits&logoColor=white)](https://conventionalcommits.org)
    - types been:  fix, feat, build, CI, CD, docs ...
    - scopes been: sqlite, tauri, PWA, i18n...

### TODO

- [ ] WebApp
- [ ] Tauri Builder
- [ ] Local DB
- [ ] Remote DB
- [ ] Google Spreadsheets API
- [ ] PDF reports
- [ ] Better Readme
- [ ] CI/CD
- [ ] Test Suite
- [ ] i18n
- [ ] User Manual

### Roadmap

- 0.1v
    - db (sql) ~Conceptual~ and Logical design
    - db (provider) API details, security constrains, access time etc
    - pwa (splash) UI
    - pwa (login) UI, and server side
    - pwa (register) Logic and security constrains

...

- 1.0v (demo goals)
    - pwa (ui/ux) Functional Login, Register, Three users, Dashboard, Exports (pdf, xlsx...), Camera (security, location)...
    - db (ui/ux) Physical design, cost per usage estimate etc
    - tauri (app) working apk, desktop app [maybe]
    - docs (manual) basic user manual (maybe build it in the app) [maybe]