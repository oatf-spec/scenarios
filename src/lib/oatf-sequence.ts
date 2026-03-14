import type { TimelineModel } from './oatf-model';

function mermaidSafe(s: string): string {
  return s.replace(/[\r\n]+/g, ' ').replace(/[#;:"{}]/g, ' ').trim();
}

function participantId(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

export function generateSequence(model: TimelineModel): string {
  try {
    if (!model.actors.length) return '';

    // Only generate for 2+ phases or multiple actors
    const totalPhases = model.actors.reduce((sum, a) => sum + a.phases.length, 0);
    const isMultiActor = model.actors.length > 1;
    if (totalPhases < 2 && !isMultiActor) return '';

    const lines: string[] = ['sequenceDiagram'];

    // Add participants
    const agentId = 'Agent';
    if (isMultiActor) {
      for (const actor of model.actors) {
        const pid = participantId(actor.name);
        lines.push(`  participant ${pid} as ${mermaidSafe(actor.name)} (${actor.mode})`);
      }
      lines.push(`  participant ${agentId} as Agent`);
    } else {
      const actor = model.actors[0];
      const pid = participantId(actor.name === 'default' ? 'Attacker' : actor.name);
      lines.push(
        `  participant ${pid} as ${actor.name === 'default' ? 'Attacker' : mermaidSafe(actor.name)} (${actor.mode})`,
      );
      lines.push(`  participant ${agentId} as Agent`);
    }

    lines.push('');

    // Render phases
    if (isMultiActor) {
      // Multi-actor: render each actor's phases
      for (const actor of model.actors) {
        const pid = participantId(actor.name);
        for (const phase of actor.phases) {
          lines.push(`  rect rgb(26, 29, 39)`);
          lines.push(`    note over ${pid},${agentId}: ${mermaidSafe(phase.name)}`);

          // Show state interaction
          if (phase.state_summary) {
            lines.push(`    ${pid}->>+${agentId}: ${mermaidSafe(phase.state_summary)}`);
            lines.push(`    ${agentId}-->>-${pid}: process`);
          }

          // Show trigger as a note
          if (phase.trigger) {
            lines.push(
              `    note right of ${agentId}: trigger: ${mermaidSafe(phase.trigger.display)}`,
            );
          }

          lines.push(`  end`);
          lines.push('');
        }
      }
    } else {
      // Single-actor multi-phase
      const actor = model.actors[0];
      const pid = participantId(actor.name === 'default' ? 'Attacker' : actor.name);

      for (const phase of actor.phases) {
        lines.push(`  rect rgb(26, 29, 39)`);
        lines.push(`    note over ${pid},${agentId}: ${mermaidSafe(phase.name)}`);

        if (phase.state_summary) {
          lines.push(`    ${pid}->>+${agentId}: ${mermaidSafe(phase.state_summary)}`);
          lines.push(`    ${agentId}-->>-${pid}: process`);
        }

        if (phase.trigger) {
          lines.push(
            `    note right of ${agentId}: trigger: ${mermaidSafe(phase.trigger.display)}`,
          );
        }

        lines.push(`  end`);
        lines.push('');
      }
    }

    return lines.join('\n');
  } catch {
    return '';
  }
}
