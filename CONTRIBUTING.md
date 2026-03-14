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

## Pull request process

1. Fork the repository and create a branch (`add-oatf-042`)
2. Add your scenario YAML file to the correct `library/` subdirectory
3. Run `npm run validate-scenarios` and fix any errors
4. Open a pull request using the provided template
5. CI will automatically validate the scenario on PR creation
