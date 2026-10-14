instructions

The project is a minimalist PWA / SPA built with Preact and MDUI, following Google Material Design guidelines. The app fetches data from a Supabase API and must run as:
- a web PWA in browsers
- a native desktop app via Tauri on Windows and Linux
- an Android app

Focus on implementing a clean, responsive PWA structure, minimal UI, Preact (wouter-preact), Supabase data access, Dexie local db, and configuration for Tauri (Native Windows, Linux and Android).

The component structure is based on scalability and readability, several wrappers/helpers to helps simplify write components (E.g. avoiding repeating supabase/dixie code on each component).

Avoid using inline styles on preact components. Instead, use CSS classes and external stylesheets for styling. Ensure that the app is fully responsive and adheres to Material Design principles.

The project is using Paraglide to have i18n (Spanish and English)

Is a monorepo 
- `./PWA/BusinessFieldOps` for the PWA and tauri (frontend)
- `./DB` for the supabase backend (PostgreSQL)
take this in mind when run commands like `pnpm`

a brief TODO/Roadmap is described in the 'Readme.md'