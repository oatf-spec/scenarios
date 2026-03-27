import type { TimelineModel, ActorModel, PhaseModel, InjectionTarget } from './oatf-model';

function mermaidSafe(s: string): string {
  return s.replace(/[\r\n]+/g, ' ').replace(/[#;:"{}]/g, ' ').trim();
}

function participantId(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

// D4: Protocol-specific default labels
function actorLabel(actor: ActorModel): string {
  if (actor.name === 'default') {
    switch (actor.protocol) {
      case 'mcp':
        return 'Malicious MCP Server';
      case 'a2a':
        return 'Malicious A2A Agent';
      case 'ag_ui':
        return 'AG-UI Frontend';
      default:
        return `Attacker (${actor.mode})`;
    }
  }
  return `${mermaidSafe(actor.name)} (${actor.mode})`;
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

// C1: Format tool names for arrow labels
function toolNamesLabel(phase: PhaseModel): string {
  if (phase.tool_names?.length) {
    return mermaidSafe(phase.tool_names.join(', '));
  }
  return '';
}

/** Generate synthetic protocol-level flow for a single phase.
 *  D1: Injection notes are placed on the specific protocol message. */
function renderProtocolFlow(
  lines: string[],
  pid: string,
  actor: ActorModel,
  phase: PhaseModel,
): void {
  const tools = toolNamesLabel(phase);
  const target = phase.injection_target;

  switch (actor.protocol) {
    case 'mcp': {
      const listLabel = tools || mermaidSafe(phase.state_summary) || 'tools';
      lines.push(`    ${pid}->>Agent: tools/list response (${listLabel})`);
      // D1: injection in description rides on tools/list
      if (target === 'description') {
        lines.push(injectionNote(target, pid)!);
      }
      lines.push(`    Agent->>+${pid}: tools/call`);
      // E1: match condition alt/else blocks
      if (phase.has_match_responses) {
        lines.push(`    alt matched request`);
        lines.push(`      ${pid}-->>Agent: matched response`);
        lines.push(`    else default`);
        lines.push(`      ${pid}-->>Agent: default response`);
        lines.push(`    end`);
        lines.push(`    deactivate ${pid}`);
      } else {
        lines.push(`    ${pid}-->>-Agent: tool result`);
      }
      // D1: injection in response rides on tool result
      if (target === 'response') {
        lines.push(injectionNote(target, pid)!);
      }
      break;
    }
    case 'a2a': {
      const cardLabel = tools || mermaidSafe(phase.state_summary) || 'agent';
      lines.push(`    ${pid}->>Agent: Agent Card (${cardLabel})`);
      // D1: injection in skill rides on Agent Card
      if (target === 'skill') {
        lines.push(injectionNote(target, pid)!);
      }
      lines.push(`    Agent->>+${pid}: tasks/send`);
      lines.push(`    ${pid}-->>-Agent: task result`);
      // D1: injection in task response/artifact rides on task result
      if (target === 'response') {
        lines.push(injectionNote(target, pid)!);
      }
      break;
    }
    case 'ag_ui': {
      const msgLabel = mermaidSafe(phase.state_summary) || 'messages';
      lines.push(`    ${pid}->>Agent: RunAgentInput (${msgLabel})`);
      // D1: injection in message rides on RunAgentInput
      if (target === 'message') {
        lines.push(injectionNote(target, pid)!);
      }
      // lifecycle events go to frontend (which renders to user)
      lines.push(`    Agent-->>${pid}: lifecycle events`);
      break;
    }
    default:
      if (phase.state_summary) {
        lines.push(`    ${pid}->>+Agent: ${mermaidSafe(phase.state_summary)}`);
        lines.push(`    Agent-->>-${pid}: process`);
      }
      // Fallback injection note for unknown protocols
      if (target) {
        const note = injectionNote(target, pid);
        if (note) lines.push(note);
      }
      break;
  }
}

function renderPhaseBlock(
  lines: string[],
  pid: string,
  actor: ActorModel,
  phase: PhaseModel,
): void {
  lines.push(`  rect rgb(26, 29, 39)`);
  lines.push(`    note over ${pid},Agent: ${mermaidSafe(phase.name)}`);

  // C2: on_enter notifications before protocol flow
  if (phase.on_enter_methods?.length) {
    for (const method of phase.on_enter_methods) {
      lines.push(`    ${pid}-->>Agent: ${mermaidSafe(method)}`);
    }
  }

  renderProtocolFlow(lines, pid, actor, phase);

  if (phase.trigger) {
    lines.push(
      `    note right of Agent: trigger: ${mermaidSafe(phase.trigger.display)}`,
    );
  }

  lines.push(`  end`);
  lines.push('');
}

// B1: Complete impact types
function renderImpact(lines: string[], impact: string[]): void {
  if (impact.includes('data_exfiltration')) {
    lines.push(`  Note over Agent: ⚠ data exfiltrated`);
  }
  if (impact.includes('behavior_manipulation') || impact.includes('unauthorized_actions')) {
    lines.push(`  Agent->>Agent: ⚠ behavior manipulated`);
  }
  if (impact.includes('privilege_escalation')) {
    lines.push(`  Agent->>Agent: ⚠ privilege escalated`);
  }
  if (impact.includes('service_disruption')) {
    lines.push(`  Note over Agent: ⚠ service disrupted`);
  }
  if (impact.includes('data_tampering')) {
    lines.push(`  Agent->>Agent: ⚠ data tampered`);
  }
  if (impact.includes('credential_theft')) {
    lines.push(`  Note over Agent: ⚠ credentials stolen`);
  }
  if (impact.includes('information_disclosure')) {
    lines.push(`  Note over Agent: ⚠ information disclosed`);
  }
}

/** Render the body (phases) for server actors (MCP/A2A), excluding the AG-UI actor. */
function renderServerActors(
  lines: string[],
  actors: ActorModel[],
  tags: string[] | undefined,
): void {
  if (actors.length === 0) return;

  const isMulti = actors.length > 1;

  if (!isMulti) {
    const actor = actors[0];
    const pid = actorPid(actor);
    if (actor.phases.length === 1) {
      const phase = actor.phases[0];
      if (phase.name !== 'default') {
        lines.push(`  note over ${pid},Agent: ${mermaidSafe(phase.name)}`);
      }
      if (phase.on_enter_methods?.length) {
        for (const method of phase.on_enter_methods) {
          lines.push(`  ${pid}-->>Agent: ${mermaidSafe(method)}`);
        }
      }
      renderProtocolFlow(lines, pid, actor, phase);
      lines.push('');
    } else {
      for (const phase of actor.phases) {
        renderPhaseBlock(lines, pid, actor, phase);
      }
    }
    return;
  }

  // Multi server actor strategies
  const allSameMode = actors.every((a) => a.mode === actors[0].mode);
  const noTriggers = actors.every((a) => a.phases.every((p) => !p.trigger));
  const useParallel = allSameMode && noTriggers;
  const isRecursiveLoop = tags?.includes('recursive-loop') ?? false;

  if (useParallel) {
    for (let ai = 0; ai < actors.length; ai++) {
      const actor = actors[ai];
      const pid = actorPid(actor);
      const label = actor.name === 'default' ? 'Attacker' : mermaidSafe(actor.name);

      lines.push(ai === 0 ? `  par ${label}` : `  and ${label}`);

      for (const phase of actor.phases) {
        if (phase.name !== 'default') {
          lines.push(`    note over ${pid},Agent: ${mermaidSafe(phase.name)}`);
        }
        if (phase.on_enter_methods?.length) {
          for (const method of phase.on_enter_methods) {
            lines.push(`    ${pid}-->>Agent: ${mermaidSafe(method)}`);
          }
        }
        renderProtocolFlow(lines, pid, actor, phase);
        if (phase.trigger) {
          lines.push(`    note right of Agent: trigger: ${mermaidSafe(phase.trigger.display)}`);
        }
      }
    }
    lines.push(`  end`);
    lines.push('');
  } else if (isRecursiveLoop) {
    lines.push(`  loop delegation cycle`);
    for (const actor of actors) {
      const pid = actorPid(actor);
      for (const phase of actor.phases) {
        renderPhaseBlock(lines, pid, actor, phase);
      }
    }
    lines.push(`  end`);
    lines.push('');
  } else {
    for (let ai = 0; ai < actors.length; ai++) {
      const actor = actors[ai];
      const pid = actorPid(actor);
      for (const phase of actor.phases) {
        renderPhaseBlock(lines, pid, actor, phase);
      }
      if (ai < actors.length - 1) {
        lines.push(`  Note over Agent: forwards context to next actor`);
        lines.push('');
      }
    }
  }
}

export function generateSequence(model: TimelineModel): string {
  try {
    if (!model.actors.length) return '';

    const lines: string[] = ['sequenceDiagram'];

    // Split actors: AG-UI client on the left, servers on the right
    const agUiActor = model.actors.find((a) => a.protocol === 'ag_ui') ?? null;
    const serverActors = model.actors.filter((a) => a.protocol !== 'ag_ui');
    const agUiPid = agUiActor ? actorPid(agUiActor) : '';

    // Participant order: AG-UI (left) → Agent (center) → servers (right)
    if (agUiActor) {
      lines.push(`  participant ${agUiPid} as ${actorLabel(agUiActor)}`);
    }
    lines.push(`  participant Agent as Agent`);
    for (const actor of serverActors) {
      lines.push(`  participant ${actorPid(actor)} as ${actorLabel(actor)}`);
    }
    lines.push('');

    // AG-UI: render the client→agent flow first
    if (agUiActor) {
      for (const phase of agUiActor.phases) {
        if (phase.name !== 'default') {
          lines.push(`  note over ${agUiPid},Agent: ${mermaidSafe(phase.name)}`);
        }
        if (phase.on_enter_methods?.length) {
          for (const method of phase.on_enter_methods) {
            lines.push(`  ${agUiPid}-->>Agent: ${mermaidSafe(method)}`);
          }
        }
        renderProtocolFlow(lines, agUiPid, agUiActor, phase);
      }
      lines.push('');
    }

    // Server actors
    renderServerActors(lines, serverActors, model.tags);

    // Impact arrows
    if (model.impact.length > 0) {
      renderImpact(lines, model.impact);
    }

    // Completion: agent responds back through AG-UI
    if (agUiActor) {
      lines.push(`  Agent-->>${agUiPid}: agent response`);
    }

    return lines.join('\n');
  } catch {
    return '';
  }
}
