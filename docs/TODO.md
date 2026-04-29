# Project TODO (master shelf)

Short-lived personal follow-ups and pointers to deeper lists. **Backend-specific items** live in [`TODO_BACKEND.md`](./TODO_BACKEND.md).

## Repo & security

- [ ] **GitHub authentication cleanup** (if you ever had a token in `git remote`):
  - Revoke that personal access token in GitHub → Settings → Developer settings → Personal access tokens.
  - Set `origin` to the plain HTTPS URL (no `user:token@` in the URL), e.g.  
    `git remote set-url origin https://github.com/<user>/<repo>.git`
  - Use **Git Credential Manager** (Windows) or **SSH** (`git@github.com:...`) so secrets are not stored in `.git/config`.

## Media / assets (local only)

- [ ] Optional: add `docs/cool stuff/targetmousecursor.mp4` to the repo (or Git LFS) if you want it versioned; it was left untracked to avoid bloating history.

## Backend & product

- See **[`TODO_BACKEND.md`](./TODO_BACKEND.md)** — Phase 4 gaps, VETO/trace visibility, Phase 3C safety, mediation, pagination, trace proxy deadlines, etc.
