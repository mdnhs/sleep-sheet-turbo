# Husky Git Hooks

Always generated. Sets up pre-commit linting with lint-staged and commit message validation
with commitlint. Ensures no bad code or malformed commit messages ever reach the repository.

## Files to generate

### `commitlint.config.mjs`

Use `.mjs` for the same reason as the Prettier config — `module.exports` breaks under
`"type": "module"`.

```javascript
export default { extends: ['@commitlint/config-conventional'] };
```

### `.husky/pre-commit`

```sh
npx lint-staged
```

### `.husky/commit-msg`

```sh
npx --no -- commitlint --edit "$1"
```

### `.husky/pre-push`

```sh
pnpm tsc --noEmit && pnpm lint
```

A full `pnpm build` on every push costs a minute or more and mostly re-checks what lint-staged
already covered. Type-check plus lint catches the same class of breakage in seconds. Let CI run the
real build.

> Husky v9+ hook files need no shebang and no `. "$(dirname -- "$0")/_/husky.sh"` line — those are
> removed in v10. A plain command is the whole file.

### Add to `package.json` scripts section

```json
{
  "scripts": {
    "prepare": "husky"
  }
}
```

## Commit message format (conventional commits)

| Type       | When to use                     |
| ---------- | ------------------------------- |
| `feat`     | New feature                     |
| `fix`      | Bug fix                         |
| `chore`    | Build, deps, config             |
| `refactor` | Code change, no new feature/fix |
| `docs`     | Documentation only              |
| `style`    | Formatting, whitespace          |
| `test`     | Adding or fixing tests          |
| `perf`     | Performance improvement         |
| `build`    | Build system or dependencies    |
| `ci`       | CI configuration                |
| `revert`   | Reverts a previous commit       |

Example: `feat(orders): add order export to CSV`

## Setup commands

```bash
pnpm add -D husky @commitlint/cli @commitlint/config-conventional
pnpm exec husky init          # creates .husky/ and adds the prepare script
chmod +x .husky/pre-commit .husky/commit-msg .husky/pre-push
```

`husky init` writes a `prepare` script and a sample `pre-commit` — overwrite its contents with the
files above rather than appending. Hooks only run after `pnpm install` has executed `prepare`, so
tell the user to re-install once if hooks appear to do nothing.
