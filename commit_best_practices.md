# Git Best Practices

## Structuring Commits

- **Keep commits atomic.** One logical change per commit. Don't bundle a bug fix, a feature, and a typo fix. Small commits are easier to review, test, and revert.
- **Commit often.** Frequent small commits are easier to merge and keep your history useful. Push regularly to avoid long-lived divergent branches.
- **Don't push broken code.** Every commit on a shared branch should build and pass tests.
- **Keep generated and sensitive files out.** Maintain a `.gitignore` for `node_modules/`, `.env`, build artifacts, and OS files like `.DS_Store`.

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/) so messages stay consistent and support automated changelogs and semantic versioning.

### Format

```text
<type>(<optional scope>): <description>

[optional body]

[optional footer]
```

### Rules

- Use the imperative mood ("add", "fix", "update").
- Keep the subject under 50 characters if you can, 72 at most.
- Don't end the subject with a period.
- Separate subject and body with a blank line.
- Wrap body lines at 72 characters and explain *why* the change was made.
- Mark breaking changes with `!` after the type (`feat!:`) or a `BREAKING CHANGE:` footer.

### Types

| Type | Purpose |
| --- | --- |
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no logic change |
| `refactor` | Restructuring without behavior change |
| `perf` | Performance improvement |
| `test` | Add or update tests |
| `build` / `ci` | Build system or CI changes |
| `chore` | Maintenance and dependency updates |

### Examples

```text
feat(ui): add dark mode toggle

fix(api): handle missing user records

Return a 404 instead of throwing when the user ID doesn't exist,
which was crashing the profile endpoint.

Closes #482
```
