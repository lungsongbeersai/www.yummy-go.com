---
name: ship-feature
description: Commit all changes on the current numbered feature branch (feature-N), merge it into the "feature" branch, delete the merged branch locally and remotely, then create and push the next incremented feature branch. Use when the user says "use ship-feature", "ship feature", or wants to finish the current feature branch and start the next one.
---

# Ship Feature

Finish the current numbered feature branch: commit, push, merge into `feature`, clean up, and start the next numbered branch.

## Preconditions (verify before running anything)

1. Run `git branch --show-current`. The branch name MUST match the pattern `feature-<number>` (e.g. `feature-23`, `feature-001`). If it does not match, STOP and tell the user this skill only works from a numbered feature branch.
2. Derive:
   - `CURRENT` = current branch name (e.g. `feature-23`)
   - `NEXT` = same prefix with the number incremented, preserving zero-padding width (e.g. `feature-23` → `feature-24`, `feature-001` → `feature-002`)

## Steps

Run these in order. If ANY command fails, STOP immediately, report which step failed and why, and do not continue. Never force-push and never use `git branch -D`.

1. `git add .`
2. `git commit -m "<CURRENT>"` — commit message is exactly the current branch name. If `git status --porcelain` shows nothing to commit, skip steps 1–2 and continue.
3. `git push` — if the branch has no upstream yet, use `git push -u origin <CURRENT>` instead.
4. `git switch feature`
5. `git pull origin feature`
6. `git merge <CURRENT>` — if the merge has conflicts, STOP, leave the repository in the conflicted state, and report the conflicting files to the user. Do not resolve conflicts automatically.
7. `git push origin feature`
8. `git branch -d <CURRENT>`
9. `git push origin --delete <CURRENT>` — if the remote branch does not exist, report it and continue.
10. `git switch -c <NEXT>`
11. `git push -u origin <NEXT>`

## Report

When finished, summarize in one short message: the commit created, that `<CURRENT>` was merged into `feature` and deleted, and that work now continues on `<NEXT>`.
