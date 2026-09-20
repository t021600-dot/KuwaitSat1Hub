# Wiring the automation section into the app

**From:** Dana (04) · **To:** Retag (01) · **Cost to you:** two lines and one `<div>`.

`automation.js` is self-contained. It defines one global (`Automation`), writes no
CSS, and reuses the classes you already ship (`card`, `btn`, `timeline`, `agent`,
`chip`, `small`, `muted`, `pipeline-head`). It never touches `Data`, `localStorage`,
or any of your files.

---

## 1 · Where it goes, and why that is findable without help

**On `mission.html`, immediately under the objective and above the map.**

That is the answer to `au-m2` ("the judge finds it without help"):

- it is the **first** thing below the mission's own text, so the eye reaches it
  before the map;
- it is the **only** primary-coloured button on the screen until the run finishes;
- its heading is the word **Automation**, not a product name;
- the three things the item asks for are three visible regions in one box —
  the button (**start**), the status line and the six-step strip (**status**),
  and the cards underneath (**result**);
- `missions.html` links each row straight to this page, so a stranger goes
  sign in → my missions → a mission → the button, with nothing else competing.

## 2 · The change to `mission.html`

```html
<!-- in <head> or before the closing body tag, once, AFTER js/config.js -->
<script src="js/config.js"></script>
<script src="js/automation.js"></script>
```

```html
<!-- where the "Agent pipeline" section is now -->
<section class="card section" id="automation"></section>
```

```js
// inside guard(), after the mission has loaded
Automation.mount({
  el: document.getElementById('automation'),
  missionId: mission.id,
  client: window.sb,               // from js/config.js
  onResults: function (rows, geometries) {
    // optional — draw geometries on your Leaflet map.
    // Each entry is a GeoJSON Polygon or FeatureCollection:
    //   L.geoJSON(g, { style: ... }).addTo(map)
  }
});
```

Copy `04-agents/app/automation.js` to `js/automation.js` at the repo root when the
screens move to the root for GitHub Pages. Until then, reference it where it sits.
**Do not edit the copy.** If it needs a change, tell me and I change the one in
`04-agents/` — otherwise we ship two versions of the automation section on
Wednesday and neither of us knows which one is live.

## 3 · Things that will bite, listed before they bite

| | |
|---|---|
| **`select('*')` now errors** | Every table has column grants (`03_grants.sql`). `automation.js` names its columns. Yours must too, or read the `my_*` views. |
| **The area format** | The database stores `area_geojson` as a **GeoJSON Polygon**: `{"type":"Polygon","coordinates":[[[lng,lat],…]]}` — longitude first, and the ring must close (last point = first point). Leaflet's `getLatLngs()` gives you `{lat,lng}` objects; convert before insert or every mission is refused by `kuwait_area_ok()`. This is D-3 in `03-security/docs/DECISIONS.md`. |
| **No `maxlength` on the objective** | `06_validation.sql` says it plainly: `maxlength` silently truncates the judge's 5,000-character paste, the row is created, and nothing refuses anything. Use a live counter. |
| **The step strip only shows finished steps** | `agent_log_step` writes a step that is already complete, so a step is either written or not yet written. The strip marks the next unwritten step as *Running…* while the run is live. That is inference, and it is honest — the row appears the moment the step really finished. |
| **Two runs on one mission duplicate the findings** | `launch_mission()` refuses a second run only while one is `queued`/`running`. After a complete run the button stays disabled on purpose. For a second demo, make a new mission. |
| **Never `innerHTML` with a value from the database** | `results.body` and `reports.body_md` are written by the agent from text a researcher typed. `automation.js` uses `textContent` and `white-space: pre-wrap` everywhere. D-2. |

## 4 · What I need from you in CSS (optional, 6 lines)

The file uses your existing classes. If `.bad` and `.good` are not in `styles.css`
yet, these are the only two it adds meaning to:

```css
.small.bad  { color: #E5484D; }
.small.good { color: #30A46C; }
```

Without them the status line still reads correctly — it just is not coloured.
