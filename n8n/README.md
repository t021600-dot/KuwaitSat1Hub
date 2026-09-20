# n8n/ — the agent workflow · owner: **04 · Automation and agents**

What goes here:
- the exported workflow JSON (File → Download in n8n)
- `GUARDRAILS.md` — the numbered list, four kinds:
  **never · ask a human first · spend limits · stop and ask**
- notes on each of the six agent steps and its failure plan

## Never export a credential
n8n exports can contain credential data. Check the JSON before committing it.
Keys live in the n8n credential store — never in this repo.
