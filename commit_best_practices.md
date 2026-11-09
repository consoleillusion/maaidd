# Git Best Practices
Effective Git usage relies on two core pillars: how you structure your changes and how you write your commit messages. Following these industry standards keeps your repository history clean, makes code reviews efficient, and simplifies debugging or rolling back changes.

## How to Commit (Structuring Changes)

- Make atomic, single-purpose commits: A commit should wrap a single, logical change. Do not bundle a bug fix, a new feature, and a typo fix into one massive commit. Small commits are easier to review, test, and revert if something breaks.
- Commit early and often: Share and save your progress frequently rather than waiting for a "perfect" or massive end-of-week update. This minimizes devastating merge conflicts.
- Never commit broken or uncompilable code: While opinions on personal workflows differ on platforms like Stack Overflow, a widely supported guideline is that every commit pushed to a shared branch should compile, pass automated tests, and run successfully.
- Don't commit auto-generated or sensitive files: Always maintain a .gitignore file to exclude node_modules/, local environment files (.env), build artifacts, and OS-specific files (like .DS_Store).

## Conventional Commits Guidelines

Follow the Conventional Commits specification to keep commit messages consistent, readable, and compatible with automated changelog generation and semantic versioning.

### 1. Commit Format

text

```text
<type>(<optional scope>): <description>

[optional body]
```

### 2. Subject Line Rules

- Separate subject and body with a blank line.
- Keep the subject within 50 characters (72 maximum if necessary).
- Capitalize the first letter.
- Do not end with a period.
- Use the imperative mood (e.g., Add, Fix, Update).

### 3. Body Rules

- Wrap lines at 72 characters.
- Explain what changed and why, not how.
- Include additional context only when necessary.

### 4. Commit Types

| Type | Purpose |
| --- | --- |
| `feat` | Add a new feature |
| `fix` | Fix a bug |
| `docs` | Update documentation |
| `style` | Formatting-only changes |
| `refactor` | Improve code structure without changing behavior |
| `perf` | Improve performance |
| `test` | Add or update tests |
| `chore` | Update dependencies or configuration |

### 5. Examples

text

```text
feat(ui): Add dark mode toggle

fix(api): Handle missing user records

docs: Update setup instructions
```

Goal: Keep commit history clean, consistent, and easy to understand while supporting automated changelogs and semantic versioning.
