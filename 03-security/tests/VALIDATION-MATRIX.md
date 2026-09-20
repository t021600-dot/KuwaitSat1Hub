# VALIDATION MATRIX — se-m5

**Owner:** 03 · Security · **Run:** Monday, re-run Tuesday
**The judge's test, word for word:** *"Paste 5,000 characters and submit. It refuses, does not freeze, creates no row."*

---

## The one that would embarrass us most

> **The 5,000-character paste.** It is the judge's own written test, it is one
> keystroke, and if our only guard is the browser counter then a `fetch` call
> walks straight past it.

And the way we would fail it without noticing: **`maxlength="1500"` on the
textarea.** The browser silently truncates the paste to 1,500 characters, the
form accepts it, **a row is created**, and nothing ever says no. From the front
it looks like the form handled it. It refused nothing.

`maxlength` must not be on that textarea. Use a counter that turns red instead.

---

## How to run every row

Two passes per row. **The second pass is the real test.**

1. **Through the form** — does the researcher see a message?
2. **Through the console, skipping the form entirely** — does the database
   still refuse?

```js
// the fetch that skips our page — this is the test that counts
await sb.from('missions').insert({
  title: 'x'.repeat(200),          // or whatever this row is testing
  objective: 'a'.repeat(5000),
  area_geojson: { type:'Polygon', coordinates:[[[47.6,29.3],[47.8,29.3],[47.8,29.4],[47.6,29.4],[47.6,29.3]]] }
});
```

**Count before, count after, then REFRESH and count again.** Everyone watches
the message and nobody watches the count. A refusal message rendered by a
`catch` block while the insert quietly succeeded is a real pattern — and the
refresh is what proves it, because the count could be stale state in JavaScript.

```js
const before = (await sb.from('my_missions').select('id')).data.length;
// ... attempt ...
const after  = (await sb.from('my_missions').select('id')).data.length;
console.log('before', before, 'after', after, before === after ? 'NO ROW ✓' : 'ROW CREATED ✗');
```

---

## The matrix

| Field | Test | Exact input to paste | Refused by | Message the researcher sees | Row? |
|---|---|---|---|---|---|
| `objective` | empty | *(nothing, press Launch)* | browser + **db** (NOT NULL) | "Describe your research objective — at least 20 characters." | no |
| `objective` | too short | `vegetation` | browser + **db** | same message, counter red | no |
| `objective` | **far too long** | the letter `a` × **5000** | browser counter + **db** (`missions_objective_len`) | "Too long — 1,500 characters maximum. You typed 5,000." | no |
| `objective` | only spaces | 40 space characters | **db** (`btrim` in the check) | "Describe your research objective — at least 20 characters." | no |
| `objective` | wrong type | `{"objective": 12345678901234567890}` by fetch | **db** (`missions_objective_has_letter`) | API 400, the page stays usable | no |
| `objective` | Arabic, valid | `خريطة الغطاء النباتي في شمال الكويت وتحديد المناطق المناسبة للتشجير` | **accepted** — this must WORK | — (mission is created) | **yes, on purpose** |
| `title` | empty | *(nothing)* | browser + **db** (NOT NULL) | "Give the mission a short name." | no |
| `title` | far too long | the letter `b` × 400 | browser + **db** | "Name must be 3–120 characters." | no |
| `title` | wrong type | `{"title": true}` by fetch | **db** (`missions_title_has_letter`) | API 400 | no |
| `area_geojson` | **absent entirely** | `{title:'x', objective:'valid…'}` — no area key | **db** (NOT NULL) | "Draw an area on the map first." | no |
| `area_geojson` | wrong type | `{"area_geojson": "hello"}` | **db** (`missions_area_shape`) | "That area is not a valid map shape." | no |
| `area_geojson` | wrong type | `{"area_geojson": 123}` | **db** | same | no |
| `area_geojson` | empty shape | `{"area_geojson": []}` | **db** | same | no |
| `area_geojson` | far too long | a polygon with 5,000 vertices | **db** (`missions_area_size`, 8192 bytes) | "That area is too detailed — draw a simpler shape." | no |
| `area_geojson` | junk padding | `{type:'Polygon',coordinates:[…], junk:'b'.repeat(50000)}` | **db** (`missions_area_size`) | same | no |
| `area_geojson` | **wrong place** | a valid polygon over Paris `[[2.3,48.8],…]` | **db** (`kuwait_area_ok`) | "Mission areas must be inside Kuwait." | no |
| `area_geojson` | wrong coord type | `[["47.6","29.3"],…]` (strings not numbers) | **db** | "That area is not a valid map shape." | no |
| `researcher_id` | **claim someone else's** | `{researcher_id:'<A uuid>', …}` by fetch | **db** (no insert grant + trigger) | API 400 permission denied | no |
| `status` | **set it to complete** | `{status:'complete', …}` by fetch | **db** (no insert grant + trigger) | API 400 permission denied | no |
| rate limit | 6th mission in an hour | launch six missions | **db** (trigger) | "Limit reached: 5 missions per hour." | no |
| kill switch | with `accepting_new_missions = false` | any valid mission | **db** (trigger) | "The prototype is not accepting new missions right now." | no |
| report body | too short | `hi` to `generate_report()` | **db** (RPC) | "A report needs at least 50 characters." | no |

### Nothing in the "Refused by" column says *browser only*

If any row ever reads **browser only**, that row is **WEAK** and must be backed
by a database constraint before it is ticked. A browser check is a courtesy to
the user. It is not security.

---

## The refusal contract — hand this to 01 · Front end

The database raises these exact strings. 01 maps each one to a sentence and an
i18n key. **Neither of us changes a string without telling the other** — if the
screen says one thing and the database says another, a judge can trip it.

| Database signal | The sentence on screen | i18n key |
|---|---|---|
| `missions_objective_len` | Describe your research objective — 20 to 1,500 characters. | `err.objective.length` |
| `missions_objective_has_letter` | That objective needs to be words, not just numbers. | `err.objective.letters` |
| `missions_title_len` | Give the mission a short name — 3 to 120 characters. | `err.title.length` |
| `missions_area_shape` | That area is not a valid map shape. Draw it again. | `err.area.shape` |
| `missions_area_size` | That area is too detailed — draw a simpler shape. | `err.area.size` |
| `kuwait_area_ok` (same constraint) | Mission areas must be inside Kuwait. | `err.area.place` |
| `null value in column "area_geojson"` | Draw an area on the map first. | `err.area.missing` |
| `P0001 Sign in before launching a mission.` | Your session ended. Sign in again. | `err.session` |
| `P0001 Limit reached: 5 missions per hour.` | You have launched 5 missions this hour. Try again later. | `err.ratelimit` |
| `P0001 The prototype is not accepting new missions right now.` | New missions are paused. | `err.paused` |
| `P0001 Mission not found.` | That mission is not available. | `err.notfound` |
| `permission denied for column …` | Something went wrong. *(never show this raw)* | `err.generic` |

**Never show a raw Postgres error on screen.** A message naming a table or a
column is information disclosure — it tells a stranger our schema. The last row
is the catch-all for everything unmapped.

**Messages must be in the researcher's own language**, both English and Arabic.
The i18n keys are what make that possible — hand the final wording to whoever
owns the language file.

---

## Evidence to save (or se-m6 / se-m5 score NOT PROVEN)

```
audit/evidence/se-m5-5000-chars.png     the paste, the red counter, the refusal
audit/evidence/se-m5-console-refusal.png the fetch that skipped the form, refused
audit/evidence/se-m5-row-count.txt       before / after / after-refresh
```
