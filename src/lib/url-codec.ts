import LZString from 'lz-string';

export function compressYaml(yamlText: string): string {
  return LZString.compressToEncodedURIComponent(yamlText);
}

export function decompressYaml(compressed: string): string | null {
  return LZString.decompressFromEncodedURIComponent(compressed);
}
