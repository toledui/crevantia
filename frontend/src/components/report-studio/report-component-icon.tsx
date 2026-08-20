import { BadgeInfo, BarChart3, ChartLine, ChartScatter, Grid2X2, Heading1, ImageIcon, LayoutGrid, ListTree, Minus, PanelTop, Radar, Table2, Text } from 'lucide-react';

const icons = {
  HEADING: Heading1,
  RICH_TEXT: Text,
  IMAGE: ImageIcon,
  PAGE_BREAK: Minus,
  RADAR_CHART: Radar,
  MULTI_RADAR_CHART: ChartLine,
  DECILE_SCALE_TABLE: Table2,
  QUADRANT_CHART: ChartScatter,
  QUADRANT_RESULT_TABLE: BadgeInfo,
  POTENTIAL_ABILITY_MATRIX: Grid2X2,
  SUMMARY_MATRIX: LayoutGrid,
  COVER_BLOCK: PanelTop,
  TABLE_OF_CONTENTS: ListTree,
  HEADER_FOOTER: PanelTop,
  STATIC_EXAMPLE_CHART: BarChart3,
} as const;

export const componentLabels: Record<string, string> = {
  HEADING: 'Título', RICH_TEXT: 'Texto enriquecido', IMAGE: 'Imagen', PAGE_BREAK: 'Salto de página',
  RADAR_CHART: 'Gráfica radar', MULTI_RADAR_CHART: 'Radar comparativo', DECILE_SCALE_TABLE: 'Escala por deciles',
  QUADRANT_CHART: 'Gráfica de cuadrantes', QUADRANT_RESULT_TABLE: 'Resultado de cuadrante', POTENTIAL_ABILITY_MATRIX: 'Matriz potencial–habilidad', SUMMARY_MATRIX: 'Matriz resumen',
  COVER_BLOCK: 'Portada', TABLE_OF_CONTENTS: 'Índice', HEADER_FOOTER: 'Encabezado y pie', STATIC_EXAMPLE_CHART: 'Gráfica de ejemplo',
};

export function ReportComponentIcon({ type }: { type: string }) {
  const Icon = icons[type as keyof typeof icons] ?? LayoutGrid;
  return <Icon aria-hidden="true" />;
}
