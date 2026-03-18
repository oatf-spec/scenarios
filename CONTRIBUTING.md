# Contributing Scenarios

## Adding a new scenario

1. **Create the YAML file** in the appropriate subdirectory of `library/`:
   - `library/mcp/` — MCP-only attacks
   - `library/a2a/` — A2A-only attacks
   - `library/ag-ui/` — AG-UI-only attacks
   - `library/cross-protocol/` — attacks spanning multiple protocols

2. **Name the file** using the convention `<ID>_<slug>.yaml`:
   ```
   OATF-042_resource-uri-traversal.yaml
   ```

3. **Include all required fields:**
   - [ ] `oatf: "0.1"`
   - [ ] `attack.id` — unique OATF-NNN identifier
   - [ ] `attack.name` — human-readable title
   - [ ] `attack.description` — detailed prose description
   - [ ] `attack.severity.level` — one of: critical, high, medium, low, informational
   - [ ] `attack.classification.category` — attack category
   - [ ] `attack.classification.mappings` — at least one framework mapping
   - [ ] `attack.execution` — mode/state, phases, or actors
   - [ ] `attack.indicators` — at least one indicator

   See the [OATF specification](https://oatf.io) for the full document structure.

## Testing locally

```bash
npm install
npm run dev
```

Open `http://localhost:4321/` and navigate to your scenario. Verify that:
- The detail page renders correctly (header, description, timeline, indicators)
- The sequence diagram renders for multi-phase or multi-actor scenarios
- The editor tab loads and shows a valid timeline preview

## Validating

```bash
npm run validate-scenarios
```

This checks all files in `library/` for required fields and structural validity.

## Severity level rubric

The `severity.level` field classifies the worst-case impact if the attack succeeds. Use the criteria below to select the appropriate level.

| Level | Criteria | Examples |
|-------|----------|----------|
| critical | Complete agent compromise enabling arbitrary actions: remote code execution, mass data exfiltration, supply chain compromise affecting downstream users, full authentication/authorization bypass, self-propagating (worm-like) payloads | RCE via malicious MCP package; worm propagating across agent chains; supply chain attack affecting thousands of deployments |
| high | Significant targeted impact: credential theft, targeted data exfiltration, privilege escalation, behavior manipulation with financial or operational consequences, persistent compromise of a single agent | SSH key theft via injected tool description; agent goal overridden to exfiltrate financial data; OAuth token hijack |
| medium | Limited or conditional impact: information disclosure without direct exploitation path, partial behavior manipulation, availability degradation, attacks requiring significant preconditions or user interaction | System prompt extraction; XSS via rendered agent output; terminal UI concealment; denial-of-wallet with bounded cost |
| low | Minimal direct impact: reconnaissance, metadata exposure, attacks with narrow scope and bounded consequence | Agent Card enumeration revealing endpoint metadata; version fingerprinting |
| informational | Design observations that do not independently enable exploitation; awareness-level architectural concerns | Protocol lacks a feature that could improve security posture |

When the impact spans multiple levels (e.g., an attack that enables both information disclosure and credential theft depending on configuration), assign the **highest plausible** level and note the variability in the description.

## Confidence scoring rubric

The `severity.confidence` field is an integer from 0 to 100 representing how confident the author is in the assigned severity level, following the STIX confidence scale. It is **not** a standalone measure of threat likelihood -- it reflects how well-supported the specific severity assessment is.

When omitted, confidence defaults to 50 (neutral). A high-severity attack with confidence 30 means the author believes it could be high severity but has limited evidence. A high-severity attack with confidence 90 means the assessment is well-supported.

The score is the sum of five weighted factors:

### Factor 1: Impact evidence (0-25)

How directly has the claimed impact been demonstrated at the assigned severity level?

| Points | Criterion |
|--------|-----------|
| 25 | Impact at this severity confirmed by CVE, incident report, or peer-reviewed publication |
| 20 | Impact demonstrated at this severity in conference presentation or detailed PoC |
| 15 | Impact shown in technical writeup with working proof-of-concept |
| 10 | Impact inferred from vendor analysis or well-characterized analogous attack class |
| 5 | Impact is theoretical extrapolation |

### Factor 2: Reproducibility (0-25)

Can the attack reliably produce impact at the claimed severity?

| Points | Criterion |
|--------|-----------|
| 25 | Impact at this severity independently confirmed by 2+ groups |
| 15 | Documented PoC with publicly available code |
| 10 | Claimed reproduction without public artefacts |
| 5 | No reproduction |

### Factor 3: Real-world observation (0-20)

Has impact at the assigned severity been observed outside the lab?

| Points | Criterion |
|--------|-----------|
| 20 | Confirmed exploitation in the wild producing the claimed impact |
| 12 | Red team or controlled engagement observation |
| 5 | Lab-only demonstration |
| 0 | No observation |

> **Important caveat:** The 0 floor on this factor means a scenario can score up to 80/100 with zero real-world exploitation. This is intentional -- novel protocol-level attacks that haven't been weaponised yet can still carry high confidence if the impact evidence and reproducibility are strong. A high confidence score should not be interpreted as implying confirmed malicious use in the wild.

### Factor 4: Quantitative support (0-15)

Are there measured outcomes supporting the severity level?

| Points | Criterion |
|--------|-----------|
| 15 | Published success rates or measured impact data (e.g., "injection succeeds in 73% of tested models") |
| 5 | Qualitative assessment only (e.g., "works reliably in testing") |
| 0 | No supporting data |

### Factor 5: Temporal applicability (0-15)

Does the severity assessment apply to current systems?

| Points | Criterion |
|--------|-----------|
| 15 | Affects current software versions; no mitigations deployed |
| 8 | Affects recent but patched versions, or partial mitigations exist |
| 3 | Historical only |

### Worked example

**OATF-001: Tool Description Prompt Injection** (severity: critical, confidence: 85)

| Factor | Score | Rationale |
|--------|-------|-----------|
| Impact evidence | 20 | Multiple conference presentations demonstrating full agent compromise via injected descriptions |
| Reproducibility | 25 | Independently reproduced by multiple research groups with public PoCs |
| Real-world observation | 12 | Demonstrated in red team engagements against production MCP deployments |
| Quantitative support | 15 | Published success rates across multiple LLM providers |
| Temporal applicability | 15 | Affects all current MCP implementations without input validation |
| **Total** | **87** | Rounded to **85** for the scenario |

When submitting a PR, include a brief justification for both your severity level and confidence score in the PR description.

## Pull request process

1. Fork the repository and create a branch (`add-oatf-042`)
2. Add your scenario YAML file to the correct `library/` subdirectory
3. Run `npm run validate-scenarios` and fix any errors
4. Open a pull request using the provided template
5. CI will automatically validate the scenario on PR creation
