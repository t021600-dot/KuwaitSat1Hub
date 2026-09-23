# .github

## `workflows/ci.yml` is on disk and is NOT in git yet. Here is why, and how to finish it.

It runs `03-security/tests/security-check.mjs` and the four suites in
`04-agents/tests/` on every push to `main`. Today all of that passes, but
**nothing is enforcing it**, because the file has never reached GitHub.

### What happened

`.git/info/exclude` carried a line hiding `.github/workflows/ci.yml` from git.
That was added so that a push would not be rejected, and it worked: the push
succeeded and CI never ran, once, for the life of the project. The exclude line
is gone now.

Pushing it fails like this:

```
! [remote rejected] main -> main (refusing to allow an OAuth App to create or
  update workflow `.github/workflows/ci.yml` without `workflow` scope)
```

That is GitHub refusing on principle: a token that can push code is not
automatically allowed to push something that *runs* code on GitHub's machines.
The account token here carries `gist`, `read:org` and `repo`, and it needs
`workflow` as well.

### How to finish it

One interactive command, which has to be run by a person because it opens a
browser and asks you to confirm:

```
gh auth refresh -s workflow
```

`gh` is at:

```
C:\Users\senpa\AppData\Local\Microsoft\WinGet\Packages\GitHub.cli_Microsoft.Winget.Source_8wekyb3d8bbwe\bin\gh.exe
```

Then, from the repository root:

```
git add .github
git commit -m "CI has never run once. Turn it on."
git push
```

Check it worked at
<https://github.com/t021600-dot/KuwaitSat1Hub/actions> — there should be a run
against your commit, and it should be green.

### Do not re-add the exclude line

If the push is refused again, the answer is the scope, not hiding the file. A
check nobody runs is a check that does not exist, and this repository already
spent its whole life in that state once.
