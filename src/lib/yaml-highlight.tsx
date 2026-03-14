import React from 'react';

/**
 * Tokenise a line of YAML into highlighted spans.
 * Lightweight — covers keys, strings, numbers, booleans, comments.
 */
function highlightLine(line: string, index: number): React.ReactNode {
  // Empty / whitespace-only
  if (!line.trim()) return <span key={index}>{line}{'\n'}</span>;

  const parts: React.ReactNode[] = [];
  let rest = line;

  // Leading whitespace
  const leadMatch = rest.match(/^(\s+)/);
  if (leadMatch) {
    parts.push(leadMatch[1]);
    rest = rest.slice(leadMatch[1].length);
  }

  // Full-line comment
  if (rest.startsWith('#')) {
    parts.push(<span key={`c${index}`} style={{ color: '#6b7280' }}>{rest}</span>);
    return <span key={index}>{parts}{'\n'}</span>;
  }

  // List item prefix "- "
  const listMatch = rest.match(/^(-\s+)/);
  if (listMatch) {
    parts.push(listMatch[1]);
    rest = rest.slice(listMatch[1].length);
  }

  // Key: value pattern
  const kvMatch = rest.match(/^([a-zA-Z_][a-zA-Z0-9_./-]*)(\s*:\s*)(.*)/);
  if (kvMatch) {
    const [, key, colon, value] = kvMatch;
    parts.push(<span key={`k${index}`} style={{ color: '#7dd3fc' }}>{key}</span>);
    parts.push(colon);
    if (value) {
      parts.push(highlightValue(value, index));
    }
  } else {
    // No key — treat as a value (continuation, list item value, etc.)
    parts.push(highlightValue(rest, index));
  }

  return <span key={index}>{parts}{'\n'}</span>;
}

function highlightValue(value: string, index: number): React.ReactNode {
  const trimmed = value.trim();

  // Inline comment at end
  const commentIdx = value.indexOf(' #');
  if (commentIdx > 0) {
    return (
      <>
        {highlightValue(value.slice(0, commentIdx), index)}
        <span style={{ color: '#6b7280' }}>{value.slice(commentIdx)}</span>
      </>
    );
  }

  // Quoted string
  if (/^".*"$/.test(trimmed) || /^'.*'$/.test(trimmed)) {
    return <span style={{ color: '#86efac' }}>{value}</span>;
  }

  // Block scalar indicators
  if (trimmed === '|' || trimmed === '>' || trimmed === '|-' || trimmed === '>-') {
    return <span style={{ color: '#e4e4e7' }}>{value}</span>;
  }

  // Number
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return <span style={{ color: '#fca5a5' }}>{value}</span>;
  }

  // Boolean / null
  if (/^(true|false|null|~)$/i.test(trimmed)) {
    return <span style={{ color: '#fca5a5' }}>{value}</span>;
  }

  // Unquoted string value
  if (trimmed.length > 0) {
    return <span style={{ color: '#86efac' }}>{value}</span>;
  }

  return value;
}

export function highlightYaml(yamlText: string): React.ReactNode[] {
  return yamlText.split('\n').map((line, i) => highlightLine(line, i));
}
