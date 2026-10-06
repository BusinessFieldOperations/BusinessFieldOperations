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
Frontend (Dev)  -> PWA
                   Preact (React/SPA)
                   Tauri [Bundler]
                   Material 3 [UI]
                   Paraglide [i18n]
                   PDF.js [report generation]
Backend         -> Postgresql [db]

Providers (Dev) -> Netlify (WebApp)
                -> Supabase
```

### Folder Structure

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
    - scopes been: db, tauri, PWA, i18n, supabase...

### Roadmap/ToDo

- [ ] Better Readme (yes even better)
- [ ] Handle `error.message` translations
- [x] Github CI/CD: PWA lint/test and build
- [ ] Github CI/CD: DB lint/test
- [ ] PDF report download
- [ ] User profile image (supabase? workspaces?)
- [x] i18n support
- [ ] Report images (workspaces)
- [ ] User manual/guide
- [ ] Developer manual/guide
- [ ] User invitation tokens (give a user a on use URL to create a user (username and photo))
- [ ] Embed location in photos
- [ ] Better CRM
- [ ] MainTitle handle text or images

#### Tabs

- [ ] Home, User profile, Tasks
- [ ] Tasks tab (user and admin assign)
- [ ] Contacts
- [ ] Reports
- [ ] Establishments
- [ ] Brands
- [ ] Product
- [ ] Clients