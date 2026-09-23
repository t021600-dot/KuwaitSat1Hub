# The front end brief, as it was given to the team

**This is a source document. Do not edit it to read better.**

It is the brief 01 Front End was handed for the second phase of the site: make
the platform feel real without losing the cinematic identity, and without
sacrificing scientific accuracy to do it. Kept for the same reason as the
agents brief, so that what was asked for can be read beside what was built.

| | |
|---|---|
| **Received** | September 2026 |
| **Committed** | 23 September 2026, unchanged |
| **Implemented across** | `index.html` and the `js/ksat-*.js` layers |

## The line that is hardest to live up to

> *"Please do not sacrifice scientific accuracy for visual effects."*

Read that before changing anything on the public page. Two things in the
codebase exist because of it:

- **Simulation is labelled wherever it appears** and is never presented as
  KuwaitSat-1 measurement. The brief asks for that distinction explicitly and
  it is load bearing.
- **The researcher workspace reports "no vegetation was detected"** on every
  run, because the archive contains none that a visible-band index can detect.
  Measured, not assumed: the numbers are in the header of `js/ksat-geo.js`.
  The temptation this brief warns about is real, and the honest answer is the
  worse looking one.

## Requirements on this page that are NOT built

Recorded so nobody reads the brief and assumes all of it shipped:

- **A single real-data / simulation mode toggle.** Simulation is labelled per
  surface instead of switched globally.
- **Surface temperature and per-area environmental indicators** on the public
  Kuwait map. KuwaitSat-1 carries no thermal band, so there is no temperature
  to show from this mission's own data.
- **The Falcon 9 style photoreal launch.** The intro is a countdown, original
  sound design and a space scene, not a rendered orbital launch vehicle.

---

I want you to improve the existing KuwaitSat-1 environmental platform without removing or breaking any of the features, design elements, scientific requirements, or workflows that we previously established.

The goal of this update is to make the website feel much more realistic, functional, interactive, and professional, as if it were an early prototype of a real environmental intelligence platform.

Do NOT rebuild the concept from scratch. Improve the existing website and preserve the cinematic space-tech identity.

⸻

### MAKE THE WEBSITE FEEL REAL

The current website should feel less like a visual prototype and more like a real working platform.

I want users/ reserachers to be able to actually interact with the system.

Every important section should have a clear purpose and a functional interaction.

Avoid:

* Static cards that do nothing
* Decorative buttons
* Fake loading screens with no result
* Empty dashboards
* Unconnected sections
* Generic AI text
* Random numbers without explanation

Instead, make the website behave like a real research and environmental analysis platform.

```text
⸻
 The prroject is essentially a research pipeline:
Research Question
↓
Satellite Data
↓
Environmental Analysis
↓
Recommendation
↓
Impact Prediction
↓
Visualization
↓
Monitoring
↓
Report
But I would not present every box as an “agent.”
Some are better described as agents, while others are automated tools/workflows.
That's important because your rubric specifically asks:
“Does it choose its own next step?”
```

### INTERACTIVE KUWAIT MAP

Connect the data input system to the Kuwait map.

When the user selects an area:

The map should update.

Show:

* Area
* Environmental indicators
* Surface temperature
* Vegetation coverage
* Environmental status
* Potential intervention
* Data source
* Date

Allow users to click different areas of Kuwait.

The selected area should become visually highlighted.

⸻

### SIMULATION MODE

Create a clear toggle:

### REAL DATA MODE

and

### SIMULATION MODE

This distinction is extremely important.

### REAL DATA MODE:

Only use verified/publicly available data.

### SIMULATION MODE:

Allow users to experiment with hypothetical values.

Clearly display:

### SIMULATION — NOT REAL SATELLITE DATA

This allows us to demonstrate the concept without falsely claiming that simulated values are real KuwaitSat-1 measurements.

⸻

### BEFORE / AFTER ENVIRONMENTAL SIMULATION

After analyzing an area, provide:

### SIMULATE A GREENER FUTURE

The user can adjust:

* Vegetation coverage
* Number of trees
* Green-space area
* Shaded area
* Green corridor size

Then generate a visual comparison:

### CURRENT SCENARIO

versus

CONCEPTUAL FUTURE SCENARIO via visualizer tool

Use a draggable Before / After slider.

Clearly label the future visualization:

### CONCEPTUAL SIMULATION

Do not present it as a guaranteed prediction.

⸻

⸻

### REALISTIC DASHBOARD

Upgrade the dashboard so it resembles a professional Earth-observation platform.

Include:

### ENVIRONMENTAL OVERVIEW

* Areas analyzed
* Data records
* Average surface temperature
* Average vegetation coverage
* Priority areas
* Monitoring status

Then include:

* Interactive charts
* Kuwait map
* Environmental heat-map
* Trend graphs
* Data table

The numbers must come from actual input/uploaded/demo data, not arbitrary random values.
AI AGENT SHOULD USE THE USER’S DATA

The AI Agent should not give generic answers.

If the user uploads data or enters values, the AI Agent should reference those actual values.

For example:

User enters:

Surface Temperature = 49°C
Vegetation = 4%

The AI should explain:

“Based on the values entered, the area shows relatively high surface temperature and limited vegetation coverage…”

Do not fabricate satellite observations that were not provided.

⸻

### KEEP THE CINEMATIC DESIGN

Do NOT turn the website into a boring data-entry system.

The cinematic identity must remain.

Keep:

* Space opening
* English countdown from 10 to 0
* Rocket launch animation
* Rocket-launch sound design
* Earth / Kuwait transition
* KuwaitSat-1 visualization
* Real team photograph
* 3D satellite
* 3D Earth
* Cinematic transitions
* Premium typography
* Space/environmental aesthetic

The important improvement is:

CINEMATIC FRONT-END + REALISTIC FUNCTIONAL BACK-END EXPERIENCE

It should look beautiful AND behave like a real application.

⸻

### FINAL USER EXPERIENCE

The ideal user journey should be:

### OPEN WEBSITE

```text
↓
```

### CINEMATIC SPACE INTRO

```text
↓
```

KUWAITSAT-1

```text
↓
```

### THE REAL TEAM BEHIND THE MISSION

```text
↓
```

ReSearcher sign in then open researcher PLATFORM

This should make the website feel like a real working prototype, not just a presentation.

### MOST IMPORTANT REQUIREMENT

Please do not sacrifice scientific accuracy for visual effects.

The goal is:

REALISTIC + INTERACTIVE + SCIENTIFICALLY RESPONSIBLE + CINEMATIC + PROFESSIONAL

The website should make a judge think:

“This looks like an actual environmental intelligence platform.”

### REALISTIC CINEMATIC INTRO — IMPORTANT UPGRADE

Please make the opening sequence significantly more realistic and cinematic.

I do NOT want the rocket, Earth, smoke, lighting, or space environment to look cartoonish, illustrated, or obviously computer-generated.

I want the opening to feel as close as possible to real cinematic space footage.

### REALISTIC ROCKET LAUNCH

During the countdown from 10 to 0, prepare the scene for a realistic rocket launch.

At ZERO:

* Show a highly realistic Falcon 9 / SpaceX-style rocket launching vertically.
* The rocket should look like a real modern orbital launch vehicle, with realistic proportions, materials, lighting, and surface details.
* The rocket should visibly lift off from the launch pad and move upward into the sky.
* Add realistic rocket-engine flames underneath the engines.
* Add a large, realistic cloud of exhaust smoke and vapor spreading beneath and around the launch area.
* Add realistic atmospheric effects caused by the engine exhaust.
* The smoke should move naturally as the rocket gains altitude.
* The rocket should gradually become smaller as it moves upward.
* Add realistic camera shake at ignition and liftoff.
* Add cinematic motion blur and depth of field.
* Use realistic sunlight and atmospheric lighting.
* Make the launch feel powerful, physical, and believable.

The rocket should NOT look like a 3D cartoon or game asset.

It should feel like real launch footage recreated as a cinematic digital experience.

### REALISTIC ROCKET AUDIO

Synchronize the visuals with realistic launch sound design:

Countdown:

TEN… NINE… EIGHT… SEVEN… SIX… FIVE… FOUR… THREE… TWO… ONE… ZERO.

At ZERO:

### IGNITION → ENGINE RUMBLE → LIFTOFF → ROCKET ASCENT

The engine sound should become louder and deeper during liftoff.

Include:

* Countdown beeps
* Engine ignition
* Deep engine rumble
* Powerful liftoff sound
* Low-frequency vibration
* Atmospheric transition as the rocket rises

If an authentic SpaceX recording cannot legally be used, create an original realistic rocket-launch sound design instead of using copyrighted audio.

Do not claim that the audio is an official SpaceX recording.

### REALISTIC EARTH

After the rocket launch, transition into a photorealistic Earth.

The Earth must look realistic rather than illustrated.

Show:

* Realistic Earth textures
* Realistic oceans
* Realistic cloud formations
* Atmospheric glow
* Realistic sunlight
* Night/day lighting
* Natural curvature of Earth
* Realistic space lighting
* Stars in the background

The camera should smoothly move away from the rocket and reveal Earth from orbit.

Then gradually zoom toward:

```text
Earth → Arabian Peninsula → Kuwait → KuwaitSat-1
```

The transition should feel like a continuous cinematic camera movement.

### CINEMATIC TRANSITION TO KUWAITSAT-1

After revealing Kuwait from space:

Transition smoothly into the KuwaitSat-1 section.

TheN RESERACHER SECTION
