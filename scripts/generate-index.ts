import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const LIBRARY_DIR = path.resolve('library');
const OUTPUT_DIR = path.resolve('public/library');

interface ScenarioIndex {
  id: string;
  name: string;
  description: string;
  severity_level: string;
  protocols: string[];
  interaction_models: string[];
  classification_category: string;
  has_indicators: boolean;
  phase_count: number;
  file: string;
}

function getProtocolFromMode(mode: string): string {
  if (mode.startsWith('mcp_')) return 'MCP';
  if (mode.startsWith('a2a_')) return 'A2A';
  if (mode.startsWith('ag_ui_')) return 'AG-UI';
  return mode.toUpperCase();
}

function getInteractionModel(mode: string): string {
  if (mode === 'mcp_server' || mode === 'mcp_client') return 'agent-to-tool';
  if (mode.startsWith('a2a_')) return 'agent-to-agent';
  if (mode.startsWith('ag_ui_')) return 'user-to-agent';
  return 'unknown';
}

function walkYamlFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkYamlFiles(fullPath));
    } else if (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')) {
      results.push(fullPath);
    }
  }
  return results;
}

function extractMetadata(doc: any, filePath: string): ScenarioIndex {
  const attack = doc.attack;
  const execution = attack.execution;

  const protocols = new Set<string>();
  const interactionModels = new Set<string>();
  let phaseCount = 0;

  if (execution.actors) {
    // Multi-actor form
    for (const actor of execution.actors) {
      protocols.add(getProtocolFromMode(actor.mode));
      interactionModels.add(getInteractionModel(actor.mode));
      phaseCount += actor.phases?.length ?? 1;
    }
  } else if (execution.phases) {
    // Multi-phase form
    protocols.add(getProtocolFromMode(execution.mode));
    interactionModels.add(getInteractionModel(execution.mode));
    phaseCount = execution.phases.length;
  } else {
    // Single-phase form
    protocols.add(getProtocolFromMode(execution.mode));
    interactionModels.add(getInteractionModel(execution.mode));
    phaseCount = 1;
  }

  const description = attack.description?.trim() ?? '';

  return {
    id: attack.id,
    name: attack.name,
    description: description.length > 200 ? description.slice(0, 200) + '...' : description,
    severity_level: attack.severity?.level ?? 'unknown',
    protocols: [...protocols],
    interaction_models: [...interactionModels],
    classification_category: attack.classification?.category ?? 'uncategorized',
    has_indicators: Array.isArray(attack.indicators) && attack.indicators.length > 0,
    phase_count: phaseCount,
    file: `${attack.id}.yaml`,
  };
}

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const yamlFiles = walkYamlFiles(LIBRARY_DIR);
  const index: ScenarioIndex[] = [];

  for (const filePath of yamlFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const doc = yaml.load(content) as any;

    if (!doc?.attack?.id) {
      console.warn(`Skipping ${filePath}: no attack.id found`);
      continue;
    }

    const meta = extractMetadata(doc, filePath);
    index.push(meta);

    // Copy YAML to public/library/<ID>.yaml
    const destPath = path.join(OUTPUT_DIR, `${doc.attack.id}.yaml`);
    fs.copyFileSync(filePath, destPath);
    console.log(`  Copied ${filePath} → ${destPath}`);
  }

  // Sort by ID
  index.sort((a, b) => a.id.localeCompare(b.id));

  const indexPath = path.join(OUTPUT_DIR, 'index.json');
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
  console.log(`\nGenerated ${indexPath} with ${index.length} scenarios`);
}

main();
