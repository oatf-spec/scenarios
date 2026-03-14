# REQ-SCN-001: OATF Scenarios

| Metadata | Value |
|----------|-------|
| **ID** | `REQ-SCN-001` |
| **Title** | OATF Scenarios |
| **Type** | Hybrid Static/SPA Website |
| **Status** | Draft |
| **Priority** | **High** |
| **Tags** | `#scenarios` `#registry` `#editor` `#visualization` `#monaco` `#interactive` |

## 1. Context & Decision Rationale

OATF Scenarios is a single site that combines a browsable threat registry with an interactive scenario editor and visualiser. Every scenario - whether from the curated registry or pasted by a user - is rendered by the same client-side code path.

**Why one site instead of separate registry and builder?**
- The detail page and the editor render the same information from different entry points. Separating them duplicates rendering code, infrastructure, and design work for no user benefit.
- One repo, one deploy, one domain, one set of dependencies.

**Why client-side rendering for everything instead of build-time generation?**
- One rendering path. Registry scenarios and custom scenarios use the same JS code.
- Eliminates oatf-cli as a build dependency. No Rust toolchain in CI.
- Faster iteration: change the rendering code, every scenario updates.

**Why Astro with prerendering for registry scenarios?**
- Prerendered HTML per registry route gives instant first paint, SEO indexability, and Open Graph link previews.
- Astro runs the same JS at build time and outputs full HTML. The SPA hydrates on top.
- Custom scenarios cannot be prerendered since content is unknown at build time.

**Why two visualization components (timeline + sequence diagram) instead of one?**

OATF documents contain two kinds of information that pull in opposite directions visually. Attack structure (phases, actors, triggers, extractors) is graph-shaped and wants a structural overview. Attack content (tool definitions, agent cards, message payloads, response dispatch rules) is document-shaped and can be 20-40 lines of YAML per phase.

No single visualization handles both well. ATT&CK Flow operates at the technique level (one-line node labels). CI/CD pipeline visualisers show execution structure but not protocol content. Wireshark flow graphs show message detail but not phase structure. The solution is two purpose-built components: a compact phase timeline for structural overview and a Mermaid sequence diagram for protocol-level narrative.

**Why a custom React timeline component instead of React Flow or Mermaid for the editor preview?**
- React Flow and ELK.js are designed for interactive node-graph editing. For a read-only structural preview that updates as you type, they are overkill.
- Mermaid lacks swimlane support, cannot embed rich content inside nodes, and offers no interactivity.
- A custom component shows exactly the information density OATF needs: phase name, mode, one-line state summary, trigger condition, extractor names.
- React Flow becomes relevant in Phase 3 for drag-and-drop visual construction.

**Why native JS instead of WASM?**
- Bundle size: ~25KB gzipped vs ~1-2MB. No Rust toolchain for contributors. No cold start delay.
- Diagram generation only reads YAML structure and emits strings.

**Why Monaco?**
- Native YAML syntax highlighting. JSON Schema validation via $schema field. VS Code familiarity.

**Why lz-string for shareable URLs?**
- Purpose-built for URI-safe string compression. 60-70% compression on typical OATF YAML. No server required.

## 2. Dependencies

| Dependency | Relationship | Notes |
|------------|--------------|-------|
| oatf-spec/spec | References | Links back to oatf.io for spec sections and terminology |
| OATF JSON Schema (v0.1.json) | Consumes | Monaco uses it for autocompletion and inline validation |
| js-yaml | Consumes | Client-side YAML parsing |
| mermaid | Consumes | Sequence diagram rendering on detail page only (not in editor preview) |
| monaco-editor | Consumes | Code editor with YAML language service |
| lz-string | Consumes | URI fragment compression for shareable URLs |

## 3. Intent

The site must:
1. Present a filterable, browsable index of curated OATF scenario documents
2. Render any scenario as a full detail page with metadata, framework mappings, phase timeline, sequence diagram, and indicators
3. Provide a split editor view with live phase timeline preview that updates as the user types
4. Accept scenarios via clean URL (registry), URI fragment (custom), paste, file upload, or blank template
5. Generate shareable URLs for custom scenarios that render full detail pages
6. Prerender registry scenario pages at build time for SEO and link previews
7. Deploy to scenarios.oatf.io via GitHub Pages

## 4. Scope

### 4.1 In Scope (Phase 1)

**Registry browse view (landing page):**
- Filterable scenario card grid: protocol, severity, classification category, interaction model
- Filter state persisted in URL query params
- Data source: lightweight index generated at build time from scenario YAML files

**Detail/edit page (per scenario):**
- Two tabs: Detail and Editor
- Detail tab: full scenario visualization (see section 6.3)
- Editor tab: split-pane with Monaco on left and live phase timeline on right (see section 6.4)
- Registry scenarios arrive on Detail tab by default
- Custom scenarios arrive on Editor tab by default

**Visualization - Phase Timeline (custom React component):**
- Compact structural map of the attack: one card per phase, stacked vertically per actor
- Each phase card shows: phase name, mode badge, one-line state summary, extractor names, trigger condition as bottom divider
- Terminal phases: no trigger divider, "terminal" label
- Single-actor: one vertical lane. Multi-actor: parallel vertical lanes with readiness barrier
- Protocol coloring on actor lane headers
- Clicking a phase card scrolls the Monaco editor to that phase YAML (editor tab only)
- Cursor movement in editor highlights the corresponding phase card
- Used in both editor preview (interactive) and detail page (read-only)

**Visualization - Sequence Diagram (Mermaid):**
- Protocol-level message flow between attacker/actors and agent
- Phase boundaries as labelled rect blocks
- Generated by oatf-sequence.ts, rendered by Mermaid library
- Detail page only (not in editor preview - too slow for per-keystroke updates)
- Only rendered for scenarios with 2+ phases or multiple actors. Single-phase scenarios show the timeline only - a sequence diagram for "attacker presents tools, agent calls one" adds no value beyond the phase card.

**Editor features:**
- Monaco YAML editor with JSON Schema validation, autocompletion, hover docs
- Document templates: single-phase MCP, multi-phase MCP, cross-protocol, blank
- GUI scaffolding: insert buttons for phases, actors, extractors, indicators, common patterns
- Paste and file upload support

**Sharing:**
- Registry scenarios: clean URLs (/OATF-001/)
- Custom scenarios: #yaml=<lz-compressed> fragment URLs
- Share and Download buttons

**Validation panel:**
- JS subset of OATF V-codes (structural checks without CEL or binding-specific logic)
- Clickable line references that scroll editor to offending location

**Community contributions:**
- Scenario YAML files in repo, contributions via PR
- CONTRIBUTING.md with authoring instructions and PR template
- CI validates all scenarios against JSON Schema

### 4.2 In Scope (Phase 2 - Enrichment)

- Coverage matrix: protocols vs MITRE ATLAS/ATT&CK techniques heatmap
- Reverse index: start from a MITRE technique or OWASP item, see all OATF scenarios
- STIX 2.1 export: download scenario as STIX Attack Pattern object
- Markdown export: download threat-model-ready summary
- Cross-actor extractor connectors in timeline: dotted lines between actor lanes showing {{actor.extractor}} references

### 4.3 In Scope (Phase 3 - Visual Authoring)

- React Flow integration for the editor tab's timeline panel (replaces the Phase 1 custom component in the editor only; the detail page keeps the lightweight read-only component)
- Drag-and-drop phase reordering within an actor lane
- Quick-add patterns: common multi-phase attack templates inserted as phase groups
- Visual actor timeline: click "+" between phase cards to add a phase, click "+" on lane header to add an actor
- Guided mode: step-by-step wizard that builds YAML from questions
- Auto-complete for common field values: surface names, event types, classification categories, framework technique IDs

### 4.4 Out of Scope

- oatf-cli as a build dependency
- WASM or live model testing (deferred indefinitely; insufficient value for complexity)
- Server-side rendering or API endpoints
- User accounts, authentication, or commenting
- Scenario submission from the site (contributors use GitHub PRs)
- Mobile-optimised editing experience
- Offline support / service worker
- Full node-graph editor where users draw edges between phases (OATF phases are strictly sequential; a graph editor adds visual complexity for linear structure)

## 5. Constraints

### 5.1 Technology Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Framework | Astro with React islands | Static prerendering for registry routes; React for interactive islands |
| Editor | Monaco Editor (@monaco-editor/react) | YAML + JSON Schema validation built-in |
| YAML parsing | js-yaml | Lightweight, sufficient for structural parsing |
| Phase timeline | Custom React component + CSS | No library needed for vertical card layout with lane grouping |
| Sequence diagram | mermaid (client-side) | Good at multi-participant message flow; detail page only |
| Model extraction | oatf-model.ts (custom) | Extracts timeline data model from parsed YAML; also used by generate-index.ts |
| Sequence generation | oatf-sequence.ts (custom) | Produces Mermaid source from parsed YAML |
| URL compression | lz-string | URI-safe compression for shareable fragment URLs |
| Hosting | GitHub Pages via oatf-spec/scenarios repo | Consistent with oatf.io deployment model |
| Domain | scenarios.oatf.io | CNAME record pointing to GitHub Pages |
| Node-graph editor (Phase 3) | React Flow (@xyflow/react) | Interactive drag-and-drop in editor tab only; detail page keeps lightweight custom component |

### 5.2 Repository Structure

oatf-spec/scenarios/
  library/                          # Canonical OATF YAML files
    mcp/
    a2a/
    ag-ui/
    cross-protocol/
  src/
    pages/
      index.astro                   # Registry browse view
      [id].astro                    # Prerendered detail page per registry scenario
      new.astro                     # Editor with template selector
      view.astro                    # Custom scenario detail (client-side only)
      edit.astro                    # Custom scenario editor (client-side only)
      coverage.astro                # Coverage matrix (Phase 2)
    components/
      ScenarioGrid/
      DetailView/
        Header.tsx
        Description.tsx
        FrameworkMappings.tsx
        IndicatorsSection.tsx
        YamlBlock.tsx
      Timeline/
        TimelineView.tsx            # Container: reads model, renders lanes + cards
        ActorLane.tsx
        PhaseCard.tsx
        ExtractorBadge.tsx
        TriggerDivider.tsx
        ReadinessBarrier.tsx
      SequenceDiagram/
        SequencePanel.tsx           # Generates Mermaid source, renders SVG
      EditorView/
        EditorPane.tsx
        Toolbar.tsx
        TemplateMenu.tsx
        InsertMenu.tsx
      ValidationPanel.tsx
      ShareBar.tsx
    lib/
      oatf-model.ts                # YAML -> timeline data model (also used by generate-index.ts)
      oatf-sequence.ts             # YAML -> Mermaid sequence diagram source
      url-codec.ts
      yaml-parser.ts
      scenario-loader.ts
      validation.ts
    schemas/
      v0.1.json
    templates/
      single-phase-mcp.yaml
      multi-phase-mcp.yaml
      cross-protocol.yaml
      blank.yaml
    styles/
      global.css
  public/
    CNAME
    library/                     # YAML files copied here at build time
  scripts/
    generate-index.ts              # Walks library/, reuses oatf-model.ts, writes index.json
  astro.config.mjs
  package.json
  CONTRIBUTING.md
  .github/
    workflows/
      deploy.yml
    PULL_REQUEST_TEMPLATE.md

### 5.3 Scenario File Conventions

- Filename: <ID>_<slug>.yaml (e.g., OATF-001_tool-description-injection.yaml)
- Subdirectories by primary protocol; cross-protocol in cross-protocol/
- Every scenario must have attack.id, attack.name, attack.description, attack.classification, and at least one indicator
- CI validates all scenarios against the OATF JSON Schema

### 5.4 Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Index page load (prerendered) | < 1s | Static HTML + small JSON for filters |
| Detail page load (registry) | < 1.5s | HTML shell instant; JS renders timeline + sequence diagram |
| Detail page load (custom) | < 2s | Fragment decode + YAML parse + render |
| Timeline update (editing) | < 100ms after debounce | YAML parse + model extraction + React render (no Mermaid) |
| Sequence diagram render | < 500ms | Mermaid render on detail page; not on every keystroke |
| Monaco lazy load | < 1s | Loaded when Editor tab activated |

### 5.5 Bundle Size Budget

| Chunk | Target (gzipped) | Loading |
|-------|-------------------|---------|
| Index page (shell + filter logic) | < 150KB | Immediate |
| Timeline component + model extractor | < 30KB | On route navigation |
| Mermaid + sequence generator | < 220KB | Lazy, detail page only |
| Editor (Monaco + toolbar) | < 400KB | Lazy, on Editor tab activation |
| React Flow (Phase 3) | < 150KB | Lazy, replaces custom timeline |

## 6. Site Architecture

### 6.1 URL Scheme

| URL | Content | Rendering |
|-----|---------|-----------|
| scenarios.oatf.io/ | Registry index | Prerendered |
| scenarios.oatf.io/OATF-001/ | Detail tab for registry scenario | Prerendered shell, hydrated |
| scenarios.oatf.io/OATF-001/?tab=editor | Editor tab for registry scenario | Hydrated |
| scenarios.oatf.io/new | Editor with template selector | Client-only |
| scenarios.oatf.io/view#yaml=<lz> | Detail tab for custom YAML | Client-only |
| scenarios.oatf.io/edit#yaml=<lz> | Editor tab for custom YAML | Client-only |
| scenarios.oatf.io/coverage/ | Coverage matrix (Phase 2) | Prerendered |

### 6.2 Page Inventory

**Index page (/)**
- Nav bar: OATF logo + "Scenarios", links to Coverage, About, oatf.io, GitHub
- Filter bar: protocol chips, severity dropdown, classification dropdown, interaction model chips
- Scenario card grid (3-column desktop, 1-column mobile)
- Each card: ID (monospace), severity badge, title (serif), one-line description, protocol tags, interaction model label
- Result count
- Filter state in URL query params

**Detail/edit page**
- Same nav bar as index
- Two tabs: Detail, Editor
- Shared state: both tabs read from and write to the same parsed YAML and extracted timeline model

### 6.3 Detail Tab Sections

**Header**
- Scenario ID in monospace, name as page title (Source Serif 4, 28px)
- Metadata row: severity badge, protocol tags, interaction model, status badge
- Share and Download buttons
- Permalink anchors on each section

**Description**
- Section label "Description" (uppercase, 11px, letter-spaced)
- Prose from attack.description

**Framework Mappings**
- Table: Framework, Technique ID (monospace, linked), Name, Relationship
- Links to upstream sources (MITRE ATLAS, ATT&CK, OWASP)

**Attack Structure (Phase Timeline)**
- Section label "Attack Structure"
- TimelineView component rendered read-only
- Full-width; actors as parallel lanes or single lane
- Phase cards with: name, mode badge, state summary, extractor names, trigger condition
- Permalink anchors per phase (#phase-<n>)

**Message Flow (Sequence Diagram)**
- Section label "Message Flow"
- Only rendered for scenarios with 2+ phases or multiple actors
- Mermaid sequence diagram rendered as inline SVG
- Participants labelled with actor names and mode
- Phase boundaries as labelled rect blocks
- Protocol coloring on participant borders
- Lazy-loads the Mermaid library

**Indicators**
- Section label "Indicators"
- Expandable rows: ID, protocol tag, surface label, description, chevron
- Only shown when attack.indicators is present

**YAML**
- Collapsible syntax-highlighted code block
- Download and Open in Editor buttons

### 6.4 Editor Tab Layout

+------------------------------------------------------------------+
| Toolbar                                                          |
| [New v] [Insert v] [Templates v]              [Share] [Download] |
+-------------------------------+----------------------------------+
| Monaco Editor                 | Phase Timeline (live preview)    |
|                               |                                  |
| (YAML, schema-validated,      | [actor lane with phase cards     |
|  dark theme)                  |  updating in real time as user   |
|                               |  types in the editor]            |
|                               |                                  |
+-------------------------------+----------------------------------+
| Validation Panel (collapsible)                                   |
| V-008: Terminal phase must be last in phase list     [line 47]   |
+------------------------------------------------------------------+

Split-pane: Monaco left, live phase timeline right. Timeline updates on every debounced keystroke (< 100ms, no Mermaid). Default split: 60/40. Resizable via drag handle. On tablet, panes stack vertically.

The timeline preview does not include the Mermaid sequence diagram. The Detail tab shows the full sequence diagram.

**Bidirectional navigation:**
- Clicking a phase card scrolls the editor to that phase YAML and highlights the line range
- Cursor movement in editor highlights the corresponding phase card
- Implemented by tracking YAML line ranges per phase during parsing

### 6.5 Data Flow

**Registry scenario:**
Route /OATF-001/ -> prerendered HTML shell -> JS hydration -> fetch YAML -> js-yaml.load() -> oatf-model.extract() -> TimelineView renders -> (if 2+ phases or multi-actor: lazy oatf-sequence.generate() -> Mermaid.render()) -> detail view complete

**Custom scenario:**
Route /view#yaml=<lz> -> LZString decompress -> same pipeline as above

**Live editing:**
Keystroke -> debounce 150ms -> js-yaml.load() -> (parse error? hold last valid state) -> oatf-model.extract() -> timeline preview re-renders (< 100ms) -> shared state updated (Detail tab re-renders on switch)

### 6.6 Shareable URL Generation

Editor content -> LZString.compressToEncodedURIComponent() -> URL -> copy to clipboard

URL length handling: warn at 8,000 characters (Slack, Teams, and enterprise proxies truncate or reject URLs above this). Suggest download instead at 15,000 characters. Most single-scenario documents compress to 2,000-3,000 characters and will share without issue.

Share always generates a fragment URL from the current editor content, even when editing a registry scenario. If someone opens /OATF-001/, switches to Editor, modifies the YAML, and clicks Share, the generated URL is /view#yaml=<compressed-modified-yaml> — not a link back to /OATF-001/. The original registry URL is unaffected.

## 7. Content Specification

### 7.1 Registry Index

Generated at build time by scripts/generate-index.ts. Imports oatf-model.ts to parse each YAML file and extract metadata: id, name, description, severity_level, protocols, interaction_models, classification_category, has_indicators, phase_count, file path. One source of parsing logic ensures the index metadata stays consistent with what the detail page renders.

### 7.2 oatf-model.ts - Timeline Model Extractor

Extracts a structured model from parsed YAML for the timeline component. Pure data transformation.

The extractor handles all three OATF execution forms transparently. The single-phase shorthand form (execution.mode + execution.state without phases) is normalised into a TimelineModel with one actor named "default" and one terminal phase. The multi-phase form produces one actor with multiple phases. The multi-actor form produces multiple actors directly. Consuming components always receive the same TimelineModel shape regardless of which form the YAML uses.

**TimelineModel:**
- actors[]: each with name, mode, protocol, phases[]
- cross_references[]: from_actor, from_extractor, to_actor, to_phase (Phase 2 - not extracted in Phase 1)

**PhaseModel:**
- name, description, mode, is_terminal
- state_summary: one-line compact summary (~60 chars)
- state_details: key names for expandable view
- extractors[]: name, source, type
- trigger: event, count, has_match, after, display (human-readable)
- yaml_line_start, yaml_line_end (for bidirectional editor navigation)

**State summary rules:**
- MCP server: list tool names ("tools: safe_calculator, admin_panel")
- MCP server with resources: "tools: calc | resources: /secret"
- A2A server: agent card name ("agent_card: ReconBot")
- AG-UI client: message count and first role ("3 messages (system, user, assistant)")
- Truncate with ellipsis if too long

### 7.3 oatf-sequence.ts - Mermaid Sequence Generator

Generates Mermaid sequence diagram source from parsed YAML. Detail page only. Only generates output for scenarios with 2+ phases or multiple actors.

- Participants named as "actor_name (mode)" or "Attacker (mode)" for single-actor
- Phase boundaries as rect blocks with phase name labels
- Arrows for state being presented
- Trigger conditions as notes between phase blocks
- Protocol coloring via Mermaid participant styling
- Returns empty string for unparseable input
- Output must match oatf-cli mermaid when the CLI exists (shared test fixtures)

### 7.4 Document Templates

Four templates with placeholder values and inline YAML comments: single-phase MCP, multi-phase MCP, cross-protocol, blank.

### 7.5 GUI Scaffolding

**Templates menu** (replaces editor content):
New Single-Phase MCP, New Multi-Phase MCP, New Cross-Protocol, Blank Document

**Insert menu** (inserts at cursor):
Add Phase, Add Terminal Phase, Add MCP Server Actor, Add A2A Server Actor, Add AG-UI Client Actor, Add Extractor, Add Pattern Indicator, Add Expression Indicator, Add Rug-Pull Phase

Insert operations use Monaco executeEdits API with correct indentation.

### 7.6 Validation Rules (JS Subset)

V-001 Valid YAML, V-002 oatf field present, V-003 attack object present, V-004 execution present, V-008 terminal phase is last, V-010 indicator IDs unique, V-011 phase names unique within actor, V-028 phase.mode required when execution.mode absent, V-031 actor names unique, V-035 synthesize.prompt non-empty.

## 8. User Interactions

| Interaction | Behavior |
|-------------|----------|
| Filter scenarios on index | Cards filter in place; URL query params update |
| Click scenario card | Navigate to /OATF-XXX/, Detail tab |
| Switch to Editor tab | Lazy-load Monaco; show split-pane with YAML + timeline preview |
| Edit YAML in Editor | Debounced: re-extract timeline model, re-render preview, update validation |
| Click phase card in timeline (editor) | Scroll editor to that phase YAML, highlight line range |
| Move cursor in editor | Highlight corresponding phase card in timeline |
| Switch to Detail tab | Re-renders from shared state including sequence diagram |
| Click Share | Generate #yaml=<lz> URL, copy to clipboard, show toast |
| Click Download | Browser downloads .yaml file |
| Click template button | Confirm if unsaved; replace editor content |
| Click insert button | Insert YAML snippet at cursor with correct indentation |
| Click validation error | Scroll editor to offending line |
| Click framework technique link | Open upstream source in new tab |
| Click phase permalink (detail) | Scroll to phase in timeline |
| Arrive via /OATF-001/ | Prerendered shell; hydrate; fetch YAML; render Detail tab |
| Arrive via /view#yaml=<lz> | Decompress; render Detail tab |
| Arrive via /edit#yaml=<lz> | Decompress; render Editor tab with timeline |
| Arrive via /new | Show template selector overlay |

## 9. Visual Design

### 9.1 Design Principles

- Dark theme, high density, restrained colour. Security tool aesthetic.
- Match oatf.io palette: #0f1117 background, #1a1d27 surfaces, #b02a2a accent (sparingly)
- Typography: Source Serif 4 for headings, Source Sans 3/Inter for UI, JetBrains Mono for code
- Protocol colours: MCP #3b82f6, A2A #22c55e, AG-UI #a855f7
- Severity palette: critical red, high orange, medium yellow, low blue, informational grey
- Single border radius (6px). 8px spacing grid.

### 9.2 Reference Design

The HTML mockup oatf_registry_interface.html defines the visual language for index and detail pages. The phase timeline component and editor split-pane layout need their own Figma mockup before implementation.

### 9.3 Timeline Component Design

Phase cards: #1a1d27 background, #2a2d37 border. Active card: brighter border or protocol color at low opacity. Phase name in body font 13px. State summary in monospace 12px secondary colour. Trigger divider: 1px dashed #2a2d37 with condition text. Terminal phases: no divider, subtle "terminal" label in #6b7280.

Actor lane headers: actor name monospace, mode as protocol-colored badge. Lane borders: 1px solid protocol color at 20% opacity.

Cross-actor connectors (Phase 2): 1px dashed #6b7280 with extractor variable name label.

### 9.4 Responsive Behaviour

| Breakpoint | Layout |
|------------|--------|
| Desktop (> 1024px) | 3-column card grid; editor split-pane (60/40); side-by-side actor lanes |
| Tablet (768-1024px) | 2-column grid; editor panes stacked; actor lanes stacked |
| Mobile (< 768px) | 1-column grid; filters collapsed; detail view only. Editor tab shows "Open on desktop to edit" message with Download and Copy URL buttons. Monaco is not loaded on mobile. |

## 10. Build & Deploy

### 10.1 Build Pipeline

scripts/generate-index.ts -> copy library/ to public/library/ -> Astro build -> GitHub Pages deploy

No Rust toolchain. No oatf-cli.

### 10.2 GitHub Actions

Deploy on push to main: checkout, setup-node, npm ci, generate-index.ts, npm run build, deploy to GitHub Pages with CNAME scenarios.oatf.io.

PR validation on library/** changes: checkout, setup-node, npm ci, npm run validate-scenarios.

## 11. Testing

| Test Type | What | How |
|-----------|------|-----|
| Schema validation | All registry scenarios validate | npm run validate-scenarios in CI |
| Index generation | Valid JSON with correct metadata | Unit tests |
| Timeline model extraction | Correct model for all execution forms | Unit tests with fixture YAML |
| State summary generation | Compact, accurate per protocol mode | Unit tests per mode |
| Sequence diagram generation | Valid Mermaid for all execution forms | Unit tests with fixture YAML |
| Bidirectional navigation | Phase line ranges map correctly | Unit tests |
| Template validity | All templates validate | Unit tests |
| Insert operations | Valid YAML at various cursor positions | Unit tests |
| URL codec round-trip | Compress/decompress preserves exactly | Unit tests |
| Validation rules | V-code checks catch invalid documents | Unit tests with invalid fixtures |
| Link validation | External links resolve | lychee in CI |
| Build smoke test | Site builds without errors | npm run build in CI |
| Accessibility | WCAG 2.1 AA | axe-core in CI |

## 12. Examples

### 12.1 Registry Browse with Filters
scenarios.oatf.io/?protocol=mcp&severity=high&category=prompt_injection

### 12.2 Registry Scenario Detail
scenarios.oatf.io/OATF-001/

### 12.3 Registry Scenario in Editor
scenarios.oatf.io/OATF-001/?tab=editor

### 12.4 Custom Scenario Shared as Detail Page
scenarios.oatf.io/view#yaml=NoIgDghgzgPg9gJwC4FMBOBLAdnAtjYAGhABskBjNYAc...

### 12.5 Phase Permalink
scenarios.oatf.io/OATF-002/#phase-payload_delivery

## 13. Open Questions

| # | Question | Options | Decision |
|---|----------|---------|----------|
| 1 | Astro static routes or dynamic SPA with prefetch? | Static / Dynamic | Static |
| 2 | URL length thresholds? | Various | Warn at 8,000; suggest download at 15,000 |
| 3 | Minimum scenario count for launch? | 10 / 15 / 20 | 10 |
| 4 | shadcn/ui or plain Tailwind? | shadcn / Plain | shadcn/ui |
| 5 | Dark theme only or light/dark toggle? | Dark only / Toggle | Dark only for Phase 1 |
| 6 | Timeline state: expanded names or just counts? | Names / Counts | Names with truncation |
| 7 | Cross-actor connectors: animate on hover or static? | Animate / Static | Static for Phase 2 |
