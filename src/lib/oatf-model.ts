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

export interface PhaseModel {
  name: string;
  description: string;
  mode: string;
  is_terminal: boolean;
  state_summary: string;
  state_details: string[];
  extractors: ExtractorSummary[];
  trigger: TriggerSummary | null;
  yaml_line_start: number;
  yaml_line_end: number;
}

export interface ActorModel {
  name: string;
  mode: string;
  protocol: string;
  phases: PhaseModel[];
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

function buildPhase(
  raw: any,
  mode: string,
  isTerminal: boolean,
  lineStart: number,
  lineEnd: number,
): PhaseModel {
  return {
    name: raw.name ?? 'default',
    description: raw.description ?? '',
    mode,
    is_terminal: isTerminal,
    state_summary: stateSummary(raw.state, mode),
    state_details: raw.state ? Object.keys(raw.state) : [],
    extractors: extractExtractors(raw),
    trigger: isTerminal ? null : extractTrigger(raw.trigger),
    yaml_line_start: lineStart,
    yaml_line_end: lineEnd,
  };
}

/**
 * Estimate YAML line ranges for phases by searching the raw YAML string.
 * Returns an array of [startLine, endLine] pairs (1-indexed).
 * endBoundary limits the last phase's end line (for multi-actor scoping).
 */
function estimatePhaseLines(
  yamlText: string,
  phaseNames: string[],
  endBoundary?: number,
): Array<[number, number]> {
  const lines = yamlText.split('\n');
  const totalLines = endBoundary ?? lines.length;
  const ranges: Array<[number, number]> = [];

  const phaseLineIndices: number[] = [];
  for (const name of phaseNames) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const idx = lines.findIndex(
      (line, i) =>
        !phaseLineIndices.includes(i) &&
        line.match(new RegExp(`^\\s+-\\s+name:\\s+${escaped}\\s*$`)),
    );
    phaseLineIndices.push(idx >= 0 ? idx : -1);
  }

  for (let i = 0; i < phaseLineIndices.length; i++) {
    const start = phaseLineIndices[i] >= 0 ? phaseLineIndices[i] + 1 : 0;
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

export function extractModel(doc: any, yamlText?: string): TimelineModel {
  const empty: TimelineModel = { actors: [], cross_references: [] };

  try {
    const attack = doc?.attack;
    if (!attack) return empty;

    const execution = attack.execution;
    if (!execution) return empty;

    // Multi-actor form
    if (execution.actors && Array.isArray(execution.actors)) {
      const actorNames = execution.actors.map((a: any) => a.name ?? 'default');
      const actors: ActorModel[] = execution.actors.map((actor: any, ai: number) => {
        const mode = actor.mode ?? 'unknown';
        const rawPhases = actor.phases ?? [];
        const phaseNames = rawPhases.map((p: any) => p.name ?? 'unnamed');

        // Scope phase line ranges to this actor's block
        let endBoundary: number | undefined;
        if (yamlText && ai + 1 < actorNames.length) {
          endBoundary = findActorBoundary(yamlText, actorNames[ai + 1], 0);
        }
        const lineRanges = yamlText
          ? estimatePhaseLines(yamlText, phaseNames, endBoundary)
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

      return { actors, cross_references: [] };
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

      return {
        actors: [
          {
            name: 'default',
            mode,
            protocol: protocolFromMode(mode),
            phases,
          },
        ],
        cross_references: [],
      };
    }

    // Single-phase form
    if (execution.mode && execution.state) {
      const mode = execution.mode;
      const phase = buildPhase(
        { name: 'default', description: '', state: execution.state },
        mode,
        true,
        0,
        yamlText ? yamlText.split('\n').length : 0,
      );

      return {
        actors: [
          {
            name: 'default',
            mode,
            protocol: protocolFromMode(mode),
            phases: [phase],
          },
        ],
        cross_references: [],
      };
    }

    return empty;
  } catch {
    return empty;
  }
}
