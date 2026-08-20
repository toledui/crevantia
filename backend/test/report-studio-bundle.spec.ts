import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const bundle = resolve(process.cwd(), '..', 'CREVANTIA_REPORT_STUDIO_BUNDLE_V1', 'CREVANTIA_REPORT_STUDIO_BUNDLE_V1');
const read = <T>(file: string) => JSON.parse(readFileSync(resolve(bundle, file), 'utf8')) as T;

describe('Report Studio Bundle V1', () => {
  it('contains the complete DPO-PPF document and both layout modes', () => {
    const template = read<{ pages: Array<{ layoutMode: string; pageSize: string }> }>('seed/report-template-dpo-ppf-v1.json');
    expect(template.pages).toHaveLength(63);
    expect(new Set(template.pages.map((page) => page.layoutMode))).toEqual(new Set(['FLOW_LAYOUT', 'ABSOLUTE_LAYOUT']));
    expect(template.pages.every((page) => page.pageSize === 'LETTER')).toBe(true);
  });

  it('declares every required renderer component', () => {
    const catalog = read<{ components: Array<{ type: string }> }>('seed/report-component-catalog-v1.json');
    expect(catalog.components).toHaveLength(15);
    expect(new Set(catalog.components.map((item) => item.type))).toEqual(new Set([
      'COVER_BLOCK', 'HEADING', 'RICH_TEXT', 'IMAGE', 'RADAR_CHART', 'MULTI_RADAR_CHART',
      'DECILE_SCALE_TABLE', 'QUADRANT_CHART', 'QUADRANT_RESULT_TABLE', 'POTENTIAL_ABILITY_MATRIX',
      'SUMMARY_MATRIX', 'TABLE_OF_CONTENTS', 'HEADER_FOOTER', 'PAGE_BREAK', 'STATIC_EXAMPLE_CHART',
    ]));
  });

  it('keeps mathematically unproven bindings configurable', () => {
    const bindings = read<{ bindingPresets: Array<{ status: string; reason?: string }> }>('seed/report-bindings-v1.json');
    const pending = bindings.bindingPresets.filter((item) => item.status.includes('CONFIGURABLE'));
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.every((item) => Boolean(item.reason))).toBe(true);
  });
});
