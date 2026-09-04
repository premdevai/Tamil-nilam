/**
 * TANSIDCO's vacancy chart only publishes these four unit kinds. The GIS
 * layer has no type field, so a hover without a vacancy match infers from
 * the plot label (CML/CMP, shed, module) and otherwise treats a numbered
 * parcel as an industrial plot.
 */

export type PlotUnitKind =
  'industrial-plot' | 'commercial-plot' | 'shed' | 'module';

export type VacancyKey =
  'industrialPlot' | 'commercialPlot' | 'shed' | 'module';

export const PLOT_UNIT_ORDER = [
  'industrial-plot',
  'module',
  'commercial-plot',
  'shed',
] as const satisfies readonly PlotUnitKind[];

export const PLOT_UNIT_META: Record<
  PlotUnitKind,
  { readonly label: string; readonly vacancyKey: VacancyKey }
> = {
  'industrial-plot': { label: 'Industrial plot', vacancyKey: 'industrialPlot' },
  'commercial-plot': { label: 'Commercial plot', vacancyKey: 'commercialPlot' },
  shed: { label: 'Shed', vacancyKey: 'shed' },
  module: { label: 'Module', vacancyKey: 'module' },
};

export function plotUnitFromVacancyType(type: string): PlotUnitKind | null {
  const key = type.trim().toLowerCase();
  if (key === 'industrial plot') return 'industrial-plot';
  if (key === 'commercial plot') return 'commercial-plot';
  if (key === 'shed') return 'shed';
  if (key === 'module') return 'module';
  return null;
}

export function inferPlotUnit(no: string): PlotUnitKind {
  const label = no.toLowerCase();
  if (/\bshed\b/.test(label)) return 'shed';
  if (/\b(module|plug)\b/.test(label)) return 'module';
  if (/\b(cml|cmp|commercial)\b/.test(label)) return 'commercial-plot';
  return 'industrial-plot';
}
