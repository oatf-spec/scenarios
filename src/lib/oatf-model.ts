export interface ExtractorSummary {
  name: string;
  source: string;
  type: string;
}

export interface TriggerSummary {
  event: string;
  count?: number;
  has_match?: boolean;
  after?: string;
  display: string;
}

export type InjectionTarget = 'description' | 'response' | 'skill' | 'message' | null;

export interface PhaseModel {
  name: string;
  description: string;
  mode: string;
  is_terminal: boolean;
  state_summary: string;
  state_details: string[];
  extractors: ExtractorSummary[];
  trigger: TriggerSummary | null;
  injection_target: InjectionTarget;
  yaml_line_start: number;
  yaml_line_end: number;
  on_enter_methods?: string[];
  has_match_responses?: boolean;
  tool_names?: string[];
}

export interface ActorModel {
  name: string;
  mode: string;
  protocol: string;
  phases: PhaseModel[];
  is_adversarial?: boolean;
}

export interface CrossReference {
  from_actor: string;
  from_extractor: string;
  to_actor: string;
  to_phase: string;
}

export interface TimelineModel {
  actors: ActorModel[];
  cross_references: CrossReference[];
  impact: string[];
  tags?: string[];
  user_intent?: string;
}

function protocolFromMode(mode: string): string {
  if (mode.startsWith('mcp_')) return 'mcp';
  if (mode.startsWith('a2a_')) return 'a2a';
  if (mode.startsWith('ag_ui_')) return 'ag_ui';
  return mode;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

// Case-insensitive patterns for common injection markers
const INJECTION_RE_CI = /\bIMPORTANT\b|override|<!--|ignore previous|must now|do not mention/i;
// SYSTEM must be uppercase to avoid false positives on benign text like
// "ticketing system", "system settings", "e-file system"
const INJECTION_RE_CS = /\bSYSTEM\b/;

function hasInjectionMarker(text: string): boolean {
  return INJECTION_RE_CI.test(text) || INJECTION_RE_CS.test(text);
}

function detectInjection(state: any, mode: string): InjectionTarget {
  if (!state) return null;

  // MCP: check tool descriptions, then responses
  if (mode.startsWith('mcp_') && Array.isArray(state.tools)) {
    for (const tool of state.tools) {
      if (tool.description && hasInjectionMarker(tool.description)) return 'description';
    }
    for (const tool of state.tools) {
      const responses = tool.responses;
      if (Array.isArray(responses)) {
        for (const r of responses) {
          const text = JSON.stringify(r);
          if (hasInjectionMarker(text)) return 'response';
        }
      }
    }
  }

  // A2A: check agent card skill descriptions, then task messages/artifacts
  if (mode.startsWith('a2a_')) {
    if (state.agent_card) {
      const card = state.agent_card;
      if (card.skills && Array.isArray(card.skills)) {
        for (const skill of card.skills) {
          if (skill.description && hasInjectionMarker(skill.description)) return 'skill';
        }
      }
      if (card.description && hasInjectionMarker(card.description)) return 'skill';
    }
    // Check task messages for injection in delegated results
    if (state.task?.message) {
      const msgText = JSON.stringify(state.task.message);
      if (hasInjectionMarker(msgText)) return 'response';
    }
    // Check task artifacts for embedded injection
    if (state.task?.artifacts) {
      const artText = JSON.stringify(state.task.artifacts);
      if (hasInjectionMarker(artText)) return 'response';
    }
  }

  // AG-UI: check messages for fabricated system roles
  if (mode.startsWith('ag_ui_') && state.run_agent_input?.messages) {
    for (const msg of state.run_agent_input.messages) {
      if (msg.content && hasInjectionMarker(msg.content)) return 'message';
    }
  }

  // Fallback: check entire state as JSON
  const json = JSON.stringify(state);
  if (hasInjectionMarker(json)) return 'response';

  return null;
}

function stateSummary(state: any, mode: string): string {
  if (!state) return '';

  const parts: string[] = [];

  // MCP server: list tool names
  if (mode.startsWith('mcp_') && state.tools) {
    const toolNames = Array.isArray(state.tools)
      ? state.tools.map((t: any) => t.name).filter(Boolean)
      : [];
    if (toolNames.length > 0) {
      parts.push(`tools: ${toolNames.join(', ')}`);
    }
    // Resources
    if (state.resources) {
      const resNames = Array.isArray(state.resources)
        ? state.resources.map((r: any) => r.uri || r.name).filter(Boolean)
        : [];
      if (resNames.length > 0) {
        parts.push(`resources: ${resNames.join(', ')}`);
      }
    }
  }

  // A2A server: agent card name
  if (mode.startsWith('a2a_') && state.agent_card) {
    const name = typeof state.agent_card === 'string'
      ? state.agent_card
      : state.agent_card?.name;
    if (name) parts.push(`agent_card: ${name}`);
  }

  // AG-UI client: message count and roles
  if (mode.startsWith('ag_ui_') && state.run_agent_input?.messages) {
    const msgs = state.run_agent_input.messages;
    const roles = msgs.map((m: any) => m.role).filter(Boolean);
    parts.push(`${msgs.length} messages (${roles.join(', ')})`);
  }

  // Fallback: list top-level keys
  if (parts.length === 0) {
    const keys = Object.keys(state);
    if (keys.length > 0) parts.push(keys.join(', '));
  }

  return truncate(parts.join(' | '), 60);
}

function extractExtractors(phase: any): ExtractorSummary[] {
  if (!phase.extractors) return [];
  if (!Array.isArray(phase.extractors)) return [];
  return phase.extractors.map((e: any) => ({
    name: e.name ?? '',
    source: e.source ?? '',
    type: e.type ?? 'string',
  }));
}

function extractTrigger(trigger: any): TriggerSummary | null {
  if (!trigger) return null;

  const parts: string[] = [];
  if (trigger.event) parts.push(trigger.event);
  if (trigger.count) parts.push(`x${trigger.count}`);
  if (trigger.after) parts.push(`after ${trigger.after}`);
  if (trigger.match) parts.push('match');

  return {
    event: trigger.event ?? '',
    count: trigger.count,
    has_match: !!trigger.match,
    after: trigger.after,
    display: parts.join(' ') || 'trigger',
  };
}

function extractToolNames(state: any, mode: string): string[] {
  if (!state) return [];
  if (mode.startsWith('mcp_') && Array.isArray(state.tools)) {
    return state.tools.map((t: any) => t.name).filter(Boolean);
  }
  if (mode.startsWith('a2a_') && state.agent_card?.skills) {
    return state.agent_card.skills.map((s: any) => s.name).filter(Boolean);
  }
  return [];
}

function hasMatchResponses(state: any, mode: string): boolean {
  if (!mode.startsWith('mcp_') || !state?.tools) return false;
  for (const tool of state.tools) {
    if (Array.isArray(tool.responses)) {
      for (const r of tool.responses) {
        if (r.match) return true;
      }
    }
  }
  return false;
}

function buildPhase(
  raw: any,
  mode: string,
  isTerminal: boolean,
  lineStart: number,
  lineEnd: number,
): PhaseModel {
  const onEnterMethods = raw.on_enter?.map((a: any) => a.send?.method).filter(Boolean) ?? [];
  const toolNames = extractToolNames(raw.state, mode);

  return {
    name: raw.name ?? 'default',
    description: raw.description ?? '',
    mode,
    is_terminal: isTerminal,
    state_summary: stateSummary(raw.state, mode),
    state_details: raw.state ? Object.keys(raw.state) : [],
    extractors: extractExtractors(raw),
    trigger: isTerminal ? null : extractTrigger(raw.trigger),
    injection_target: detectInjection(raw.state, mode),
    yaml_line_start: lineStart,
    yaml_line_end: lineEnd,
    on_enter_methods: onEnterMethods.length > 0 ? onEnterMethods : undefined,
    has_match_responses: hasMatchResponses(raw.state, mode) || undefined,
    tool_names: toolNames.length > 0 ? toolNames : undefined,
  };
}

/**
 * Estimate YAML line ranges for phases by searching the raw YAML string.
 * Returns an array of [startLine, endLine] pairs (1-indexed).
 * searchAfter: 0-indexed line to start searching from (for multi-actor scoping).
 * endBoundary: 0-indexed line limit for the last phase's end.
 */
function estimatePhaseLines(
  yamlText: string,
  phaseNames: string[],
  searchAfter: number = 0,
  endBoundary?: number,
): Array<[number, number]> {
  const lines = yamlText.split('\n');
  const totalLines = endBoundary ?? lines.length;
  const ranges: Array<[number, number]> = [];

  const phaseLineIndices: number[] = [];
  for (const name of phaseNames) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`^\\s+-\\s+name:\\s+${escaped}\\s*$`);
    // Search only within the scoped range, skipping already-found indices
    let idx = -1;
    for (let i = searchAfter; i < lines.length; i++) {
      if (!phaseLineIndices.includes(i) && re.test(lines[i])) {
        idx = i;
        break;
      }
    }
    phaseLineIndices.push(idx);
  }

  for (let i = 0; i < phaseLineIndices.length; i++) {
    const start = phaseLineIndices[i] >= 0 ? phaseLineIndices[i] + 1 : 1;
    const end =
      i + 1 < phaseLineIndices.length && phaseLineIndices[i + 1] >= 0
        ? phaseLineIndices[i + 1] + 1
        : totalLines;
    ranges.push([start, end]);
  }

  return ranges;
}

/** Find the 0-indexed line where a YAML key pattern appears. */
function findActorBoundary(yamlText: string, actorName: string, after: number): number {
  const lines = yamlText.split('\n');
  const escaped = actorName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (let i = after; i < lines.length; i++) {
    if (lines[i].match(new RegExp(`^\\s+-\\s+name:\\s+${escaped}\\s*$`))) {
      return i;
    }
  }
  return lines.length;
}

function extractUserIntent(execution: any): string | undefined {
  // AG-UI: first user message content
  if (execution.mode?.startsWith('ag_ui_') && execution.state?.run_agent_input?.messages) {
    const userMsg = execution.state.run_agent_input.messages.find((m: any) => m.role === 'user');
    if (userMsg?.content) return truncate(String(userMsg.content).trim(), 40);
  }
  // Multi-actor: check first actor
  if (execution.actors?.[0]) {
    const actor = execution.actors[0];
    if (actor.mode?.startsWith('ag_ui_')) {
      const state = actor.phases?.[0]?.state;
      const userMsg = state?.run_agent_input?.messages?.find((m: any) => m.role === 'user');
      if (userMsg?.content) return truncate(String(userMsg.content).trim(), 40);
    }
  }
  // Fallback: first tool name from single-phase/multi-phase
  const state = execution.state ?? execution.phases?.[0]?.state;
  if (state?.tools?.[0]?.name) {
    return `use ${state.tools[0].name}`;
  }
  return undefined;
}

export function extractModel(doc: any, yamlText?: string): TimelineModel {
  const empty: TimelineModel = { actors: [], cross_references: [], impact: [] };

  try {
    const attack = doc?.attack;
    if (!attack) return empty;

    const execution = attack.execution;
    if (!execution) return empty;

    const userIntent = extractUserIntent(execution);

    // Multi-actor form
    if (execution.actors && Array.isArray(execution.actors)) {
      const actorNames = execution.actors.map((a: any) => a.name ?? 'default');
      const actors: ActorModel[] = execution.actors.map((actor: any, ai: number) => {
        const mode = actor.mode ?? 'unknown';
        const rawPhases = actor.phases ?? [];
        const phaseNames = rawPhases.map((p: any) => p.name ?? 'unnamed');

        // Scope phase line search to this actor's block
        let searchAfter = 0;
        let endBoundary: number | undefined;
        if (yamlText) {
          // Start searching from this actor's name line
          searchAfter = findActorBoundary(yamlText, actor.name ?? 'default', 0);
          // End at the next actor's name line
          if (ai + 1 < actorNames.length) {
            endBoundary = findActorBoundary(yamlText, actorNames[ai + 1], searchAfter + 1);
          }
        }
        const lineRanges = yamlText
          ? estimatePhaseLines(yamlText, phaseNames, searchAfter, endBoundary)
          : phaseNames.map(() => [0, 0] as [number, number]);

        const phases = rawPhases.map((p: any, i: number) => {
          const isTerminal = i === rawPhases.length - 1 && !p.trigger;
          return buildPhase(p, mode, isTerminal, lineRanges[i][0], lineRanges[i][1]);
        });

        return {
          name: actor.name ?? 'default',
          mode,
          protocol: protocolFromMode(mode),
          phases,
        };
      });

      // Mark actors with injection as adversarial
      for (const actor of actors) {
        actor.is_adversarial = actor.phases.some((p) => p.injection_target !== null);
      }

      const impact = Array.isArray(attack.impact) ? attack.impact : [];
      const tags = attack.classification?.tags ?? [];
      return { actors, cross_references: [], impact, tags: tags.length ? tags : undefined, user_intent: userIntent };
    }

    // Multi-phase form
    if (execution.phases && Array.isArray(execution.phases)) {
      const mode = execution.mode ?? 'unknown';
      const rawPhases = execution.phases;
      const phaseNames = rawPhases.map((p: any) => p.name ?? 'unnamed');
      const lineRanges = yamlText
        ? estimatePhaseLines(yamlText, phaseNames)
        : phaseNames.map(() => [0, 0] as [number, number]);

      const phases = rawPhases.map((p: any, i: number) => {
        const isTerminal = i === rawPhases.length - 1 && !p.trigger;
        return buildPhase(p, mode, isTerminal, lineRanges[i][0], lineRanges[i][1]);
      });

      const hasInjection = phases.some((p: PhaseModel) => p.injection_target !== null);
      const impact = Array.isArray(attack.impact) ? attack.impact : [];
      const tags = attack.classification?.tags ?? [];
      return {
        actors: [
          {
            name: 'default',
            mode,
            protocol: protocolFromMode(mode),
            phases,
            is_adversarial: hasInjection || undefined,
          },
        ],
        cross_references: [],
        impact,
        tags: tags.length ? tags : undefined,
        user_intent: userIntent,
      };
    }

    // Single-phase form
    if (execution.mode && execution.state) {
      const mode = execution.mode;
      // Find the execution: block start line (1-indexed)
      let execStart = 1;
      if (yamlText) {
        const lines = yamlText.split('\n');
        const idx = lines.findIndex((l) => /^\s+execution:/.test(l));
        if (idx >= 0) execStart = idx + 1;
      }
      const phase = buildPhase(
        { name: 'default', description: '', state: execution.state },
        mode,
        true,
        execStart,
        yamlText ? yamlText.split('\n').length : execStart,
      );

      const impact = Array.isArray(attack.impact) ? attack.impact : [];
      const tags = attack.classification?.tags ?? [];
      return {
        actors: [
          {
            name: 'default',
            mode,
            protocol: protocolFromMode(mode),
            phases: [phase],
            is_adversarial: phase.injection_target !== null || undefined,
          },
        ],
        cross_references: [],
        impact,
        tags: tags.length ? tags : undefined,
        user_intent: userIntent,
      };
    }

    return empty;
  } catch {
    return empty;
  }
}
