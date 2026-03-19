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
function renderImpact(lines: string[], impact: string[], hasUser: boolean, agUiPid?: string): void {
  // For AG-UI: exfiltration flows through frontend to user
  // For non-AG-UI: no User participant, impacts are notes on Agent
  const exfilTarget = agUiPid
    ? `${agUiPid}--xUser`
    : hasUser
      ? 'Agent--xUser'
      : undefined;

  if (impact.includes('data_exfiltration')) {
    if (exfilTarget) {
      lines.push(`  ${exfilTarget}: ⚠ data exfiltrated`);
    } else {
      lines.push(`  Note over Agent: ⚠ data exfiltrated`);
    }
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
    if (exfilTarget) {
      lines.push(`  ${exfilTarget}: ⚠ credentials stolen`);
    } else {
      lines.push(`  Note over Agent: ⚠ credentials stolen`);
    }
  }
  if (impact.includes('information_disclosure')) {
    if (exfilTarget) {
      lines.push(`  ${exfilTarget}: ⚠ information disclosed`);
    } else {
      lines.push(`  Note over Agent: ⚠ information disclosed`);
    }
  }
}

export function generateSequence(model: TimelineModel): string {
  try {
    if (!model.actors.length) return '';

    const lines: string[] = ['sequenceDiagram'];
    const isMultiActor = model.actors.length > 1;

    // Only include User participant for AG-UI scenarios (where user is defined in the OATF file)
    const isAgUi = model.actors.length === 1 && model.actors[0].protocol === 'ag_ui';
    const agUiPid = isAgUi ? actorPid(model.actors[0]) : '';

    if (isAgUi) {
      // AG-UI: User → Frontend → Agent (frontend mediates)
      lines.push(`  actor User as User`);
      lines.push(`  participant ${agUiPid} as ${actorLabel(model.actors[0])}`);
      lines.push(`  participant Agent as Agent`);
    } else {
      // MCP/A2A: Agent → Server(s)
      lines.push(`  participant Agent as Agent`);
      for (const actor of model.actors) {
        lines.push(
          `  participant ${actorPid(actor)} as ${actorLabel(actor)}`,
        );
      }
    }
    lines.push('');

    // AG-UI: user request to frontend (defined in OATF file)
    if (isAgUi) {
      const intentLabel = model.user_intent ? mermaidSafe(model.user_intent) : 'request';
      lines.push(`  User->>${agUiPid}: ${intentLabel}`);
      lines.push('');
    }

    if (isMultiActor) {
      // Detect parallel actors (same mode, no triggers)
      const allSameMode = model.actors.every(
        (a) => a.mode === model.actors[0].mode,
      );
      const noTriggers = model.actors.every((a) =>
        a.phases.every((p) => !p.trigger),
      );
      const useParallel = allSameMode && noTriggers;

      // D3: Detect recursive loop scenarios
      const isRecursiveLoop = model.tags?.includes('recursive-loop') ?? false;

      if (useParallel) {
        // C4: Render par blocks with phase names and injection notes
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
            // C4: Add phase name note inside par block
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
        // D3: Wrap in loop block for recursive scenarios
        lines.push(`  loop delegation cycle`);
        for (const actor of model.actors) {
          const pid = actorPid(actor);
          for (const phase of actor.phases) {
            renderPhaseBlock(lines, pid, actor, phase);
          }
        }
        lines.push(`  end`);
        lines.push('');
      } else {
        // Sequential multi-actor
        for (let ai = 0; ai < model.actors.length; ai++) {
          const actor = model.actors[ai];
          const pid = actorPid(actor);
          for (const phase of actor.phases) {
            renderPhaseBlock(lines, pid, actor, phase);
          }
          // C3: Cross-actor data flow note between sequential actors
          if (ai < model.actors.length - 1) {
            lines.push(`  Note over Agent: forwards context to next actor`);
            lines.push('');
          }
        }
      }
    } else {
      // Single actor
      const actor = model.actors[0];
      const pid = actorPid(actor);
      const totalPhases = actor.phases.length;

      if (totalPhases === 1) {
        // C1: Single-phase — add phase name note before protocol flow
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
        // Multi-phase: use rect blocks
        for (const phase of actor.phases) {
          renderPhaseBlock(lines, pid, actor, phase);
        }
      }
    }

    // Impact arrows
    if (model.impact.length > 0) {
      renderImpact(lines, model.impact, isAgUi, isAgUi ? agUiPid : undefined);
    }

    // Completion: only for AG-UI where user is a defined participant
    if (isAgUi) {
      lines.push(`  Agent-->>${agUiPid}: agent response`);
      lines.push(`  ${agUiPid}-->>User: rendered output`);
    }

    // Conditional legend when impact arrows present
    if (model.impact.length > 0 && isAgUi) {
      lines.push(`  Note right of User: Solid = request | Dashed = response | x = exfiltration`);
    }

    return lines.join('\n');
  } catch {
    return '';
  }
}
