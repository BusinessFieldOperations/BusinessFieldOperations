<div align="center">
<h3>Business Field Operations</h3>
<img src="src/favicon.svg" width="100" alt="logo" title="icon"/>
<hr/>
Business Field Operations is a App that helps you manage your business operations efficiently.
</div>

---

### Overview

#### development workflow (Before commit)

*DB*

any change on the db schemas is follow by
```
# Start a docker container
# pnpm supabase start
pnpm supabase db schema declarative sync 
pnpm supabase db push
pnpm run generate:types
```

this makes a migration from the schemas files, push the changes and gen the types (PWA)

any change on the edge functions (`DB/supabase/functions`) is follow by
```
# deploys every function of the folder to the linked project
pnpm supabase functions deploy
```

the project ref and the access token come from `DB/.env`
(`SUPABASE_PROJECT_ID`, `SUPABASE_ACCESS_TOKEN`)

> the PWA calls these functions at runtime: if one is missing on the server the
> browser gets a `404` with a CORS error, not a readable answer. Deploy them
> before shipping a release that uses them.

*PWA*
any change on PWA is follow by
```
pnpm run fix        # lint
pnpm run prepare    # build i18n, images etc
pnpm run compile    # tsc
```

### Structure

```
Frontend (Dev)  -> PWA
                   Preact (React/SPA)
                   Tauri [Bundler]
                   Material 3 [UI]
                   Paraglide [i18n]
                   Dexie [IndexedDB, local DB cache]
                   PDF.js [report generation]
Backend         -> PostgreSQL [db]

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
- [x] Github CI/CD: deploy supabase edge functions
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
- [ ] Time/date sync with the server (report capture time)

#### Tabs

- [ ] Home, User profile, Tasks
- [ ] Tasks tab (user and admin assign)
- [ ] Contacts
- [ ] Reports
- [ ] Establishments
- [ ] Brands
- [ ] Product
- [ ] Clients