---
description: Commit conventions and guidelines
applyTo: '\.md$|\.ts$|\.tsx$|\.js$|\.jsx$' # Apply to code and documentation files
---

## Commit Conventions

This project follows the [Conventional Commits](https://conventionalcommits.org) format.

### Commit Types

- `feat` - A new feature
- `fix` - A bug fix
- `build` - Changes to build system or dependencies
- `ci` - Changes to CI/CD configuration
- `cd` - Changes to CD configuration
- `docs` - Documentation changes
- `style` - Code style changes (formatting, semicolons, etc.)
- `refactor` - Code refactoring without feature or fix changes
- `perf` - Performance improvements
- `test` - Test-related changes

### Commit Scopes

- `tauri` - Tauri framework changes
- `pwa` - Progressive Web App changes
- `i18n` - Internationalization changes
- `db` - Database related changes
- `docs` - Documentation related changes (includes Readme and ./Docs)

### Commit Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Examples

- `feat(pwa): add login UI component`
- `fix(sqlite): resolve database connection issue`
- `docs(pwa): update project structure`
- `build(tauri): update dependencies`