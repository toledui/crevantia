export type JsonObject = Record<string, unknown>;

export interface ReportBlock {
  id?: string;
  type: string;
  preset?: string;
  bindingPreset?: string;
  content?: JsonObject;
  contentSource?: string;
  role?: string;
  flow?: boolean;
  keepTogether?: boolean;
  layout?: { x?: number; y?: number; width?: number; height?: number };
  style?: JsonObject;
  settings?: JsonObject;
  [key: string]: unknown;
}

export interface ReportPage {
  pageId: string;
  referencePage?: number;
  sectionCode: string;
  sectionName: string;
  layoutMode: 'FLOW_LAYOUT' | 'ABSOLUTE_LAYOUT';
  pageSize: 'LETTER' | 'A4';
  header?: { enabled?: boolean };
  footer?: { enabled?: boolean; pageNumber?: number | null };
  blocks: ReportBlock[];
  sourceText?: string;
  copyStatus?: string;
}

export interface ReportLayout {
  schemaVersion: string;
  document: JsonObject;
  pages: ReportPage[];
  catalog?: { components?: Array<{ type: string; category?: string; label?: string }> };
  presets?: JsonObject;
}

export interface PreviewData {
  isSample?: boolean;
  person: { fullName: string; firstName?: string };
  assessment: { name: string; completedAt: string };
  report: { generatedAt: string };
  values: Record<string, { rawScore?: number; displayScore?: number | null; decile?: number | null }>;
}

export interface ReportVersionResponse {
  id: string;
  version: string;
  status: string;
  layoutJson: ReportLayout;
  bindingConfigJson: { bindingPresets?: JsonObject[] };
  pendingBindings: number;
  template: { id: string; code: string; name: string; testLinks?: Array<{ testId: string; assessmentId?: string | null; language: string; audience: string; isDefault: boolean; isActive: boolean; test: { id: string; code: string; name: string }; assessment: { id: string; code: string; name: string } | null }> };
  theme: { configJson: JsonObject } | null;
  previewData: PreviewData;
  publication: { canPublish: boolean; pendingBindings: number };
}

export const REPORT_COMPONENTS = [
  ['Contenido', 'HEADING'], ['Contenido', 'RICH_TEXT'], ['Contenido', 'IMAGE'], ['Contenido', 'PAGE_BREAK'],
  ['Resultados', 'RADAR_CHART'], ['Resultados', 'MULTI_RADAR_CHART'], ['Resultados', 'DECILE_SCALE_TABLE'],
  ['Resultados', 'QUADRANT_CHART'], ['Resultados', 'QUADRANT_RESULT_TABLE'], ['Resultados', 'POTENTIAL_ABILITY_MATRIX'], ['Resultados', 'SUMMARY_MATRIX'],
  ['Especiales', 'COVER_BLOCK'], ['Especiales', 'TABLE_OF_CONTENTS'], ['Especiales', 'HEADER_FOOTER'], ['Especiales', 'STATIC_EXAMPLE_CHART'],
] as const;

export function blockId(block: ReportBlock, index: number) {
  return block.id ?? `${block.type.toLowerCase()}-${index + 1}`;
}

export function resolveVariable(value: string, data: PreviewData) {
  return value.replace(/{{\s*([^}|]+)(?:\|([^}]+))?\s*}}/g, (_match, path: string, filter?: string) => {
    const resolved = path.trim().split('.').reduce<unknown>((current, key) => current && typeof current === 'object' ? (current as JsonObject)[key] : undefined, data);
    if (filter?.trim() === 'monthYear' && resolved) return new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(new Date(String(resolved)));
    return resolved == null ? '—' : String(resolved);
  });
}

export function metricValues(block: ReportBlock, data: PreviewData, bindings: JsonObject[]) {
  const preset = bindings.find((item) => item.code === block.bindingPreset);
  return presetMetrics(preset, data, bindings, new Set());
}

export function comparisonMetricValues(block: ReportBlock, data: PreviewData, bindings: JsonObject[]) {
  const preset = bindings.find((item) => item.code === block.bindingPreset);
  if (!preset) return { primary: [], secondary: [] };
  const abilityCode = String(preset.abilityPreset ?? '');
  const potentialCode = String(preset.potentialPreset ?? '');
  return {
    primary: presetMetrics(bindings.find((item) => item.code === abilityCode), data, bindings, new Set()),
    secondary: presetMetrics(bindings.find((item) => item.code === potentialCode), data, bindings, new Set()),
  };
}

function presetMetrics(preset: JsonObject | undefined, data: PreviewData, bindings: JsonObject[], visited: Set<string>): Array<{ label: string; value: number }> {
  if (!preset) return [];
  const presetCode = String(preset.code ?? '');
  if (visited.has(presetCode)) return [];
  visited.add(presetCode);
  const configured = (preset?.configuredMappings ?? {}) as Record<string, { sourceType: string; sourceCode: string }>;
  const metrics = Array.isArray(preset?.metrics) ? preset.metrics as JsonObject[] : [];
  const fromConfigured = Object.entries(configured).map(([label, metric]) => ({ label, ...metric }));
  const displayLabels = Array.isArray(preset.displayLabels) ? preset.displayLabels as string[] : [];
  const groupMetrics = Array.isArray(preset.groups) ? (preset.groups as JsonObject[]).flatMap((group) => {
    const ready = Array.isArray(group.metrics) ? group.metrics as JsonObject[] : [];
    const labels = Array.isArray(group.labels) ? group.labels as string[] : [];
    return ready.length ? ready : labels.map((label) => ({ label, sourceType: '', sourceCode: '' }));
  }) : [];
  const source = metrics.length ? metrics : fromConfigured.length ? fromConfigured : groupMetrics.length ? groupMetrics : displayLabels.map((label) => ({ label, sourceType: '', sourceCode: '' }));
  const own = source.map((metric, index) => {
    const type = String(metric.sourceType ?? 'COMPOSITE');
    const code = String(metric.sourceCode ?? '');
    if (!code) return null;
    const plainCode = code.replace(new RegExp(`^${type}:`), '');
    const found = data.values[`${type}.${code}`] ?? data.values[`${type}.${type}:${plainCode}`] ?? data.values[`COMPOSITE.${code}`] ?? data.values[`LIKERT_DIMENSION.${code}`];
    const value = found?.decile ?? found?.displayScore ?? found?.rawScore;
    if (value == null && !data.isSample) return null;
    return { label: String(metric.label ?? Object.keys(configured)[index] ?? code), value: Number(value ?? 4 + (index * 2) % 7) };
  }).filter((metric): metric is { label: string; value: number } => metric !== null);
  const included = Array.isArray(preset.includes) ? (preset.includes as string[]).flatMap((includedCode) => presetMetrics(bindings.find((item) => item.code === includedCode), data, bindings, visited)) : [];
  return [...own, ...included];
}
