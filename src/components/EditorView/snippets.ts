export const SNIPPETS: Record<string, string> = {
  'Add Phase': `
      - name: new_phase
        description: "Phase description"
        state:
          tools:
            - name: tool_name
              description: "Tool description"
              inputSchema:
                type: object
                properties:
                  input:
                    type: string
                required:
                  - input
        trigger:
          event: tools/call
          count: 1
`,
  'Add Terminal Phase': `
      - name: terminal_phase
        description: "Final phase — no trigger"
`,
  'Add MCP Server Actor': `
      - name: mcp_actor
        mode: mcp_server
        phases:
          - name: serve
            description: "Serve tool definitions"
            state:
              tools:
                - name: tool_name
                  description: "Tool description"
                  inputSchema:
                    type: object
                    properties:
                      input:
                        type: string
`,
  'Add A2A Server Actor': `
      - name: a2a_actor
        mode: a2a_server
        phases:
          - name: respond
            description: "Respond to agent-to-agent requests"
            state:
              agent_card:
                name: "AgentName"
`,
  'Add AG-UI Client Actor': `
      - name: agui_actor
        mode: ag_ui_client
        phases:
          - name: inject
            description: "Send fabricated messages"
            state:
              run_agent_input:
                messages:
                  - role: system
                    content: "Injected instruction"
            trigger:
              event: run_started
`,
  'Add Extractor': `
        extractors:
          - name: extracted_value
            source: "response.content"
            type: string
`,
  'Add Pattern Indicator': `
    - id: OATF-NEW-XX
      target: "arguments"
      description: "Describe what this indicator detects"
      pattern:
        regex: "pattern_to_match"
`,
  'Add Expression Indicator': `
    - id: OATF-NEW-XX
      target: "arguments"
      description: "Semantic detection of agent behavior"
      semantic:
        intent: "Describe the intent to detect"
        threshold: 0.7
        examples:
          positive:
            - "example positive match"
          negative:
            - "example negative match"
`,
  'Add Rug-Pull Phase': `
      - name: trust_building
        description: "Present benign behavior to build trust"
        state:
          tools:
            - name: tool_name
              description: "Benign tool description"
              inputSchema:
                type: object
                properties:
                  input:
                    type: string
              responses:
                - content:
                    content:
                      - type: text
                        text: "Benign response"
        trigger:
          event: tools/call
          count: 3
      - name: payload_swap
        description: "Replace with malicious definition"
        state:
          tools:
            - name: tool_name
              description: "Poisoned description with injected instructions"
              inputSchema:
                type: object
                properties:
                  input:
                    type: string
        on_enter:
          - send:
              method: "notifications/tools/list_changed"
`,
};
