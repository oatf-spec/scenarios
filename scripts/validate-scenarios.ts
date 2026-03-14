import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const LIBRARY_DIR = path.resolve('library');

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

function validateScenario(filePath: string): string[] {
  const errors: string[] = [];
  const relPath = path.relative(process.cwd(), filePath);

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    errors.push(`${relPath}: cannot read file`);
    return errors;
  }

  let doc: any;
  try {
    doc = yaml.load(content);
  } catch (e: any) {
    errors.push(`${relPath}: invalid YAML — ${e.reason ?? e.message}`);
    return errors;
  }

  if (!doc || typeof doc !== 'object') {
    errors.push(`${relPath}: YAML did not parse to an object`);
    return errors;
  }

  if (!doc.oatf) {
    errors.push(`${relPath}: missing required field 'oatf'`);
  }

  if (!doc.attack) {
    errors.push(`${relPath}: missing required field 'attack'`);
    return errors;
  }

  const a = doc.attack;

  if (!a.id) errors.push(`${relPath}: missing attack.id`);
  if (!a.name) errors.push(`${relPath}: missing attack.name`);
  if (!a.description) errors.push(`${relPath}: missing attack.description`);

  if (!a.classification) {
    errors.push(`${relPath}: missing attack.classification`);
  } else if (!a.classification.mappings || !Array.isArray(a.classification.mappings) || a.classification.mappings.length === 0) {
    errors.push(`${relPath}: must have at least one framework mapping in classification.mappings`);
  }

  if (!a.indicators || !Array.isArray(a.indicators) || a.indicators.length === 0) {
    errors.push(`${relPath}: must have at least one indicator`);
  }

  if (!a.execution) {
    errors.push(`${relPath}: missing attack.execution`);
  } else {
    const exec = a.execution;
    if (exec.actors && Array.isArray(exec.actors)) {
      for (const actor of exec.actors) {
        if (!actor.mode) {
          errors.push(`${relPath}: actor "${actor.name ?? '(unnamed)'}" is missing mode`);
        }
      }
    } else if (!exec.mode) {
      errors.push(`${relPath}: missing execution.mode (required when not using actors)`);
    }
  }

  // Verify filename convention: <ID>_<slug>.yaml
  const basename = path.basename(filePath);
  if (a.id && !basename.startsWith(a.id)) {
    errors.push(`${relPath}: filename should start with '${a.id}'`);
  }

  return errors;
}

function main() {
  const files = walkYamlFiles(LIBRARY_DIR);

  if (files.length === 0) {
    console.log('No scenario files found in library/');
    process.exit(0);
  }

  let totalErrors = 0;

  for (const file of files) {
    const errors = validateScenario(file);
    if (errors.length > 0) {
      for (const err of errors) {
        console.error(`  ✗ ${err}`);
      }
      totalErrors += errors.length;
    } else {
      const relPath = path.relative(process.cwd(), file);
      console.log(`  ✓ ${relPath}`);
    }
  }

  console.log(`\n${files.length} scenario(s) checked, ${totalErrors} error(s)`);

  if (totalErrors > 0) {
    process.exit(1);
  }
}

main();
