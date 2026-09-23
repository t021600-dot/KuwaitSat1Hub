# The agents brief, as it was given to the team

**This is a source document. Do not edit it to read better.**

It is the brief 04 Automation and agents was handed, reproduced here because
nothing else in this repository records what was actually ASKED for. Every
design decision in `js/ksat-agents.js` and every rule in `GUARDRAILS.md`
answers something on this page, and an assessor comparing the two should be
able to see the request and the answer side by side.

| | |
|---|---|
| **Received** | before 20 September 2026 |
| **Committed** | 23 September 2026, unchanged |
| **Implemented in** | `js/ksat-agents.js` - the Orchestrator and six agents, running in the browser |
| **Guardrails** | `04-agents/GUARDRAILS.md` expands the seven numbered rules below into sixteen, each enforced in SQL rather than in prompt text |
| **Not implemented** | the n8n execution path. The schema was built for it (`mission_runs.n8n_execution_id`, `08_agent_claim.sql`) and it is not wired. The top of `04-agents/README.md` says which implementation actually runs. |

## Where the brief was followed, and where it was not

- **The decision loop, the human checkpoint, the tool permission table and the
  "insufficient evidence" rule are all implemented.** They are the strongest
  parts of the platform.
- **The Monitoring agent** exists as a nightly sweep (`api/monitor.js`,
  `03-security/db/11_monitoring.sql`), not as the change-alerting workflow
  described below. The archive has no repeat coverage, so there is nothing to
  compare against.
- **The impact estimate cannot be produced at all** on the current archive.
  Change detection needs the same ground on two dates and there are no repeat
  visit pairs, so the agent returns the "unable to make a reliable estimate"
  outcome this brief asks for on every run. That is the brief being met, not
  missed.
- **One thing here was implemented and then deliberately moved.** The tool
  permission table was proved by having an agent attempt the forbidden write
  on every mission. Correct argument, wrong place: a denial in the middle of a
  scientific record reads as a fault. The proof now lives in the Access Test
  on the Provenance / Audit view, which fires four forbidden requests on
  demand instead of one.

---

## 🧠 1. The Mission Orchestrator Agent ⭐

This should be your MAIN agent.
This is the brain of the system.
The researcher enters:
“Identify areas in Kuwait where increasing vegetation could improve environmental conditions.”
The Orchestrator determines:

```text
What do I need to do next?
For example:
Research request
       ↓
Is there enough satellite data?
       ↓
 YES → Environmental Analysis
 NO  → Request/flag additional data
Then:
Environmental Analysis
       ↓
Are there suitable candidate zones?
       ↓
 YES → Recommendation Agent
 NO  → Return to researcher
Then:
Recommendation
       ↓
Is there enough evidence for impact prediction?
       ↓
 YES → Impact Prediction
 NO  → Mark "insufficient evidence"
THIS is what makes your project an agent.
It isn't simply:
Step 1 → Step 2 → Step 3 → Step 4.
```

It's:
“Based on what I found in Step 1, I decide what should happen next.”
That's exactly the sentence you want ready for the judges.
Your answer:
“It is an agent rather than a plain automation because it evaluates the result of each stage and chooses the appropriate next step based on predefined rules and available evidence.”

## 🛰️ 2. Satellite Data Agent

Its job:
Take the researcher's question and figure out:
What data do we need?
For example:
Researcher:
“Investigate vegetation changes in Al Wafra.”
Agent decides it needs:
KuwaitSat-1 imagery
Relevant dates
Geographic area
Available metadata
Potentially complementary environmental data
Then it calls a data retrieval tool.

## 🔧 What tool could it use?

This is where you satisfy:
“The agent uses at least one approved tool.”
For example:
Tool: KuwaitSat Data Retrieval
The agent is allowed to:
✅ Search approved KuwaitSat-1 datasets
✅ Retrieve metadata
✅ Retrieve authorized imagery
✅ Filter by date/location
It is NOT allowed to:
❌ Delete satellite data
❌ Modify original satellite data
❌ Publish data
❌ Share data with unauthorized users
❌ Launch a real satellite mission without human approval
That last one is particularly important.
You can literally show the judges your Agent Tool Permissions.

## 🌍 3. Environmental Analysis Agent

This agent asks:
“What does the data tell us?”
It can analyze your selected indicators:
Vegetation
Environmental/temperature data where available
Built-up area
Dust/environmental indicators
Other approved datasets
It produces:
Zone A
Priority: HIGH

```text
Vegetation: Low
Environmental stress: High
Built-up: High
Then it sends the result to the Orchestrator.
And here's your decision point:
Does this area meet the criteria for further investigation?
YES
→ Recommendation Agent
NO
→ Reject/record zone
```

Now you have a legitimate agentic decision.

## 🌱 4. Recommendation Agent

This agent asks:
“If this area is a candidate, what intervention should be investigated?”
Your first use case is greenery.
It could evaluate:
Plant characteristics
Heat tolerance
Salinity tolerance
Water requirements
Environmental suitability
Existing vegetation
Then:
Recommendation: Investigate Species X
But here's a really important improvement:
Don't have the AI automatically approve the recommendation.
Instead:

## 🟡 HUMAN CHECKPOINT

The researcher sees:
AI Recommendation
Species X
Reason: High heat tolerance + low water requirement
Evidence: [sources]
[Approve] [Reject] [Modify]
The workflow stops until the researcher approves.
That ticks the rubric's:
“There is one human checkpoint.”
And it makes your project much safer.

## 📈 5. Impact Prediction Agent

After approval:
“What could happen if this intervention is implemented?”
The agent uses the available models/coefficients.
It should produce:
Estimated outcome: 10–18% improvement
rather than:
“It will improve by exactly 14.7%.”
And it should include:
Evidence
Based on:
Dataset X
Study Y
Coefficient Z
If evidence isn't sufficient:
⚠️ Unable to make a reliable estimate.
This is actually a fantastic AI safety feature.

## 🗺️ 6. Visualization Automation

I wouldn't necessarily call this an agent.
It's better as an automation/tool.
The AI says:

```text
“Create a current vs proposed visualization.”
Then n8n calls your visualization service/function.
It produces:
CURRENT
vs.
PROPOSED
and sends the result back to the website.
That's a perfect example of:
Agent decides → automation executes.
```

## 🔄 7. Monitoring Agent

This one can become REALLY cool.
Instead of the researcher having to return every month, you could eventually have:

```text
Automated monitoring
New satellite data available
        ↓
Monitoring workflow triggered
        ↓
Compare with previous observation
        ↓
Change detected?
       / \
     YES  NO
      ↓    ↓
   Alert  Log
For example:
🚨 Change detected
```

Zone 14 vegetation increased outside the expected range.
The researcher receives the alert.
This is your second potential automation.

## 📄 8. Reporting Agent

The Reporting Agent takes the approved research outputs and turns them into a report.
This is important:
Don't let it blindly summarize everything the AI said.
Instead:

```text
Raw data
↓
Analysis
↓
Researcher-approved findings
↓
Report Agent
↓
Final report
This makes the report much more defensible.
It could generate:
Executive Summary
Research Objective
Data Used
Methodology
Findings
Recommendations
Impact Estimate
Visualizations
Sources
Limitations
```

Potentially Arabic + English.

## 🔥 NOW: HOW YOUR AUTOMATION ACTUALLY WORKS

This is the part I think you should focus on the MOST.
The judge sits down.
You don't open n8n.
You don't open Supabase.
You don't show them your backend.
You open:
KuwaitSat-1 Mission Hub
Researcher clicks:
🚀 START MISSION
And your workflow begins.

```text
What happens behind the scenes
FRONT END
START MISSION
      ↓
API / webhook
↓
n8n
Mission Orchestrator
      ↓
Satellite Data Tool
      ↓
Environmental Analysis
      ↓
DECISION
   ↙       ↘
YES         NO
 ↓           ↓
Continue     Stop
 ↓
Recommendation
 ↓
HUMAN APPROVAL
 ↓
Impact Prediction
 ↓
Visualization
 ↓
Report
↓
SUPABASE
Every important event gets recorded.
↓
FRONT END
The researcher sees:
🟢 Mission started
🟢 Data retrieved
🟢 Environmental analysis completed
🟡 Recommendation awaiting approval
🟢 Impact prediction completed
🟢 Report generated
```

## ⭐ THIS IS WHAT YOU NEED TO MAKE YOUR ROLE LOOK AMAZING

Don't just have:
Loading...
Instead create an actual Mission Activity panel.
Something like:
MISSION #001
Environmental Research — Al Wafra
Step
Status
🧠 Mission planning
✓ Complete
🛰️ Data retrieval
✓ Complete
🌍 Environmental analysis
✓ Complete
🌱 Recommendation
🟡 Awaiting approval
📈 Impact prediction
Waiting
🗺️ Visualization
Waiting
📄 Report
Waiting
Then the researcher clicks:
APPROVE RECOMMENDATION
And suddenly:
🌱 Recommendation approved
📈 Impact Prediction started...
That is very demo-friendly.

## 🧠 THE MOST IMPORTANT DIFFERENCE: AUTOMATION VS AGENT

Your team should know this distinction.
Plain automation:

```text
Do A → B → C → D every time.
Agent:
Do A → examine the result → decide whether B, C or something else should happen.
Your project should contain both.
That's actually ideal.
Agent
🧠 Decides:
“This area qualifies for further investigation.”
Automation
⚙️ Executes:
Retrieve the relevant data.
Agent
🧠 Decides:
“There is enough evidence to make a recommendation.”
Human
👩‍🔬 Approves.
Automation
```

⚙️ Generates visualization.
That's a proper agent + automation + human-in-the-loop system.

## 🔐 YOUR AGENT GUARDRAILS

The rubric specifically says you need a written numbered guardrail list.
Make one.
For example:
AI Agent Guardrails
1. Data Access
Agents may only access datasets authorized for the current researcher and mission.
2. Data Integrity
Agents cannot modify or delete original KuwaitSat-1 data.
3. Evidence Requirement
The agent cannot present an unsupported numerical claim as a measured result.
4. Prediction Limitation
If insufficient evidence exists, the agent must return “Insufficient evidence” rather than inventing a prediction.
5. Human Approval
Recommendations requiring researcher action must wait for explicit human approval.
6. Mission Control
The AI cannot independently submit or execute a real satellite tasking request.
7. Reporting
Reports can only use approved/verified findings.
That's VERY strong for your project.
