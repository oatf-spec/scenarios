import type { TimelineModel, ActorModel, PhaseModel, InjectionTarget } from './oatf-model';

function mermaidSafe(s: string): string {
  return s.replace(/[\r\n]+/g, ' ').replace(/[#;:"{}]/g, ' ').trim();
}

function participantId(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

function actorLabel(actor: ActorModel): string {
  const name = actor.name === 'default' ? 'Attacker' : mermaidSafe(actor.name);
  return `${name} (${actor.mode})`;
}

function actorPid(actor: ActorModel): string {
  return participantId(actor.name === 'default' ? 'Attacker' : actor.name);
}

function protocolLabel(protocol: string): string {
  switch (protocol) {
    case 'mcp':
      return 'MCP Server';
    case 'a2a':
      return 'A2A Server';
    case 'ag_ui':
      return 'AG-UI Client';
    default:
      return protocol;
  }
}

function injectionNote(target: InjectionTarget, pid: string): string | null {
  if (!target) return null;
  const labels: Record<string, string> = {
    description: 'injection in tool description',
    response: 'injection in response payload',
    skill: 'injection in skill description',
    message: 'fabricated system message',
  };
  return `    Note over ${pid},Agent: ⚠ ${labels[target]}`;
}

/** Generate synthetic protocol-level flow for a single phase */
function renderProtocolFlow(
  lines: string[],
  pid: string,
  actor: ActorModel,
  phase: PhaseModel,
): void {
  const summary = phase.state_summary;

  switch (actor.protocol) {
    case 'mcp':
      lines.push(`    ${pid}->>Agent: tools/list response (${mermaidSafe(summary) || 'tools'})`);
      lines.push(`    Agent->>+${pid}: tools/call`);
      lines.push(`    ${pid}-->>-Agent: tool result`);
      break;
    case 'a2a':
      lines.push(`    ${pid}->>Agent: Agent Card (${mermaidSafe(summary) || 'agent'})`);
      lines.push(`    Agent->>+${pid}: tasks/send`);
      lines.push(`    ${pid}-->>-Agent: task result`);
      break;
    case 'ag_ui':
      lines.push(
        `    ${pid}->>Agent: RunAgentInput (${mermaidSafe(summary) || 'messages'})`,
      );
      lines.push(`    Agent-->>Client: lifecycle events`);
      break;
    default:
      if (summary) {
        lines.push(`    ${pid}->>+Agent: ${mermaidSafe(summary)}`);
        lines.push(`    Agent-->>-${pid}: process`);
      }
      break;
  }

  // Injection note
  const note = injectionNote(phase.injection_target, pid);
  if (note) lines.push(note);
}

function renderPhaseBlock(
  lines: string[],
  pid: string,
  actor: ActorModel,
  phase: PhaseModel,
): void {
  lines.push(`  rect rgb(26, 29, 39)`);
  lines.push(`    note over ${pid},Agent: ${mermaidSafe(phase.name)}`);

  renderProtocolFlow(lines, pid, actor, phase);

  if (phase.trigger) {
    lines.push(
      `    note right of Agent: trigger: ${mermaidSafe(phase.trigger.display)}`,
    );
  }

  lines.push(`  end`);
  lines.push('');
}

function renderImpact(lines: string[], impact: string[]): void {
  if (impact.includes('data_exfiltration')) {
    lines.push(`  Agent--xUser: ⚠ data exfiltrated`);
  }
  if (impact.includes('behavior_manipulation') || impact.includes('unauthorized_actions')) {
    lines.push(`  Agent->>Agent: ⚠ behavior manipulated`);
  }
}

export function generateSequence(model: TimelineModel): string {
  try {
    if (!model.actors.length) return '';

    const lines: string[] = ['sequenceDiagram'];
    const isMultiActor = model.actors.length > 1;

    // Participants: User → Agent → protocol actors (in YAML order)
    lines.push(`  participant User as User`);
    lines.push(`  participant Agent as Agent`);

    for (const actor of model.actors) {
      lines.push(
        `  participant ${actorPid(actor)} as ${actorLabel(actor)}`,
      );
    }
    lines.push('');

    // Improvement 3: User initiation
    lines.push(`  User->>Agent: request`);
    lines.push('');

    if (isMultiActor) {
      // Improvement 5: detect parallel actors (same mode, no triggers)
      const allSameMode = model.actors.every(
        (a) => a.mode === model.actors[0].mode,
      );
      const noTriggers = model.actors.every((a) =>
        a.phases.every((p) => !p.trigger),
      );
      const useParallel = allSameMode && noTriggers;

      if (useParallel) {
        // Render as par block
        for (let ai = 0; ai < model.actors.length; ai++) {
          const actor = model.actors[ai];
          const pid = actorPid(actor);
          const label = actor.name === 'default' ? 'Attacker' : mermaidSafe(actor.name);

          if (ai === 0) {
            lines.push(`  par ${label}`);
          } else {
            lines.push(`  and ${label}`);
          }

          for (const phase of actor.phases) {
            renderProtocolFlow(lines, pid, actor, phase);
          }
        }
        lines.push(`  end`);
        lines.push('');
      } else {
        // Sequential multi-actor
        for (const actor of model.actors) {
          const pid = actorPid(actor);
          for (const phase of actor.phases) {
            renderPhaseBlock(lines, pid, actor, phase);
          }
        }
      }
    } else {
      // Single actor
      const actor = model.actors[0];
      const pid = actorPid(actor);
      const totalPhases = actor.phases.length;

      if (totalPhases === 1) {
        // Improvement 1: single-phase — synthesize protocol flow without rect wrapper
        const phase = actor.phases[0];
        renderProtocolFlow(lines, pid, actor, phase);
        lines.push('');
      } else {
        // Multi-phase: use rect blocks
        for (const phase of actor.phases) {
          renderPhaseBlock(lines, pid, actor, phase);
        }
      }
    }

    // Improvement 6: impact arrows
    if (model.impact.length > 0) {
      renderImpact(lines, model.impact);
    }

    return lines.join('\n');
  } catch {
    return '';
  }
}
