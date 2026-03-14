import yaml from 'js-yaml';

export interface ValidationError {
  code: string;
  message: string;
  line?: number;
}

export function validate(yamlText: string): ValidationError[] {
  const errors: ValidationError[] = [];

  // V-001 Valid YAML
  let doc: any;
  try {
    doc = yaml.load(yamlText);
  } catch (e: any) {
    const line = e.mark?.line ? e.mark.line + 1 : undefined;
    errors.push({ code: 'V-001', message: `Invalid YAML: ${e.reason ?? e.message}`, line });
    return errors;
  }

  if (!doc || typeof doc !== 'object') {
    errors.push({ code: 'V-001', message: 'YAML did not parse to an object' });
    return errors;
  }

  // V-002 oatf field present
  if (!doc.oatf) {
    errors.push({ code: 'V-002', message: 'Missing required field: oatf', line: 1 });
  }

  // V-003 attack object present
  if (!doc.attack) {
    errors.push({ code: 'V-003', message: 'Missing required field: attack' });
    return errors;
  }

  const attack = doc.attack;

  // V-004 execution present
  if (!attack.execution) {
    errors.push({ code: 'V-004', message: 'Missing required field: attack.execution' });
    return errors;
  }

  const exec = attack.execution;
  const lines = yamlText.split('\n');

  function findLine(pattern: string | RegExp): number | undefined {
    const idx = lines.findIndex((l) =>
      typeof pattern === 'string' ? l.includes(pattern) : pattern.test(l),
    );
    return idx >= 0 ? idx + 1 : undefined;
  }

  // Collect all phases across all actors
  type PhaseInfo = { name: string; actor?: string; index: number; hasTrigger: boolean };
  const allPhases: PhaseInfo[] = [];

  if (exec.actors && Array.isArray(exec.actors)) {
    // Multi-actor
    const actorNames = new Set<string>();
    for (const actor of exec.actors) {
      // V-031 actor names unique
      if (actor.name && actorNames.has(actor.name)) {
        errors.push({
          code: 'V-031',
          message: `Duplicate actor name: ${actor.name}`,
          line: findLine(`name: ${actor.name}`),
        });
      }
      if (actor.name) actorNames.add(actor.name);

      // V-028 phase.mode required when execution.mode absent
      if (!exec.mode && actor.phases) {
        for (const phase of actor.phases) {
          if (!actor.mode && !phase.mode) {
            errors.push({
              code: 'V-028',
              message: `Phase "${phase.name}" has no mode and execution.mode is absent`,
              line: findLine(`name: ${phase.name}`),
            });
          }
        }
      }

      if (actor.phases) {
        actor.phases.forEach((p: any, i: number) => {
          allPhases.push({ name: p.name, actor: actor.name, index: i, hasTrigger: !!p.trigger });
        });
      }
    }
  } else if (exec.phases && Array.isArray(exec.phases)) {
    // Multi-phase
    // V-028 phase.mode required when execution.mode absent
    if (!exec.mode) {
      for (const phase of exec.phases) {
        if (!phase.mode) {
          errors.push({
            code: 'V-028',
            message: `Phase "${phase.name}" has no mode and execution.mode is absent`,
            line: findLine(`name: ${phase.name}`),
          });
        }
      }
    }
    exec.phases.forEach((p: any, i: number) => {
      allPhases.push({ name: p.name, index: i, hasTrigger: !!p.trigger });
    });
  }

  // V-008 terminal phase is last (phases without trigger that aren't last)
  if (allPhases.length > 1) {
    // Group by actor
    const byActor = new Map<string, PhaseInfo[]>();
    for (const p of allPhases) {
      const key = p.actor ?? '__default__';
      if (!byActor.has(key)) byActor.set(key, []);
      byActor.get(key)!.push(p);
    }
    for (const [, phases] of byActor) {
      for (let i = 0; i < phases.length - 1; i++) {
        if (!phases[i].hasTrigger) {
          errors.push({
            code: 'V-008',
            message: `Phase "${phases[i].name}" is terminal but not last in its actor`,
            line: findLine(`name: ${phases[i].name}`),
          });
        }
      }
    }
  }

  // V-010 indicator IDs unique
  if (attack.indicators && Array.isArray(attack.indicators)) {
    const indIds = new Set<string>();
    for (const ind of attack.indicators) {
      if (ind.id && indIds.has(ind.id)) {
        errors.push({
          code: 'V-010',
          message: `Duplicate indicator ID: ${ind.id}`,
          line: findLine(`id: ${ind.id}`),
        });
      }
      if (ind.id) indIds.add(ind.id);
    }
  }

  // V-011 phase names unique within actor
  if (allPhases.length > 0) {
    const byActor = new Map<string, Set<string>>();
    for (const p of allPhases) {
      const key = p.actor ?? '__default__';
      if (!byActor.has(key)) byActor.set(key, new Set());
      const names = byActor.get(key)!;
      if (p.name && names.has(p.name)) {
        errors.push({
          code: 'V-011',
          message: `Duplicate phase name within actor: ${p.name}`,
          line: findLine(`name: ${p.name}`),
        });
      }
      if (p.name) names.add(p.name);
    }
  }

  // V-035 synthesize.prompt non-empty
  if (attack.synthesize?.prompt !== undefined && !attack.synthesize.prompt) {
    errors.push({
      code: 'V-035',
      message: 'synthesize.prompt must be non-empty',
      line: findLine('prompt:'),
    });
  }

  return errors;
}
