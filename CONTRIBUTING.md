# How our team works in one repo

*Idea-independent: this works for any capstone team.*

One repo, four people, four evenings. These rules exist so nobody overwrites anybody else's
work at 9 PM on Tuesday.

## 1. Get write access (once)

1. Make a free GitHub account if you do not have one, and send your **GitHub username** to the
   team chat.
2. The repo owner adds you under **Settings → Collaborators → Add people**.
3. Accept the invitation from your email or from <https://github.com/notifications>.
   Until you accept it, you cannot push.

## 2. Get the code on your laptop (once)

```bash
git clone <repo-url>
cd <repo-folder>
```

Or in VS Code: **Ctrl+Shift+P → Git: Clone**, then paste the repo URL.

## 3. Every time you sit down to work

```bash
git pull                       # get everybody else's work first
git checkout -b front-end/sign-in-screen   # one branch per piece of work: <job>/<what>
# ...work...
git add .
git commit -m "sign in screen shows an error when the email is empty"
git push -u origin front-end/sign-in-screen
```

Then open a **Pull Request** on GitHub and ask one teammate to look at it before merging.
Small pull requests, merged the same evening, beat one giant one on Wednesday.

**What is on `main` is what is live** (checklist MUST: live = main). Never push half-finished
work straight to `main`.

## 4. Who answers first

Each of the five jobs has one owner (we are four, so one person holds two) (see the table on your repo front page (`README.md`)). Owning a job does
not mean doing it alone. It means that when somebody asks a question about that area, you answer
first. Jobs can overlap. Ownership cannot.

| Branch prefix | Job |
|---|---|
| `front-end/` | 01 · Front end |
| `data/` | 02 · Back end and data |
| `security/` | 03 · Security |
| `agent/` | 04 · Automation and agents |
| `ship/` | 05 · Ship and present |

## 5. The freeze rule

The feature list in your frozen scope file (for example `docs/SCOPE.md`) is **frozen**. A new feature only goes in if
an old one comes out, and you name the one that comes out, out loud, in front of the other three.
Then edit that scope file in the same pull request.

## 6. Never commit a secret

- Keys, tokens and passwords go in a local `.env` file, which `.gitignore` already blocks.
- Put the *names* of the variables (never the values) in `.env.example`.
- If a key ever lands in a commit, tell the Security owner at once. Deleting the file is not
  enough, because the key stays in the history. **Rotate the key.**
- The Supabase **anon** key is designed to be public, and it is only safe while row level
  security is on. The **service role** key must never appear in this repo.
