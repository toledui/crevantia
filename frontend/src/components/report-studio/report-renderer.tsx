import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { comparisonMetricValues, metricValues, resolveVariable, type JsonObject, type PreviewData, type ReportBlock, type ReportLayout, type ReportPage } from '@/lib/report-studio';
import styles from './report-studio.module.css';

interface Props {
  layout: ReportLayout;
  data: PreviewData;
  theme?: JsonObject;
  bindings?: JsonObject[];
  selectedPageId?: string;
  selectedBlockId?: string | null;
  onSelectBlock?: (id: string) => void;
  zoom?: number;
  printMode?: boolean;
  dropPreview?: { type:string; mode:'FLOW'|'ABSOLUTE'; index:number; x?:number; y?:number; width:number; height:number } | null;
}

export function ReportRenderer({ layout, data, theme = {}, bindings = [], selectedPageId, selectedBlockId, onSelectBlock, zoom = 1, printMode, dropPreview }: Props) {
  const pages = selectedPageId ? layout.pages.filter((page) => page.pageId === selectedPageId) : layout.pages;
  const colors = (theme.colors ?? {}) as JsonObject;
  const vars = { '--rs-indigo': String(colors.indigo ?? '#302B78'), '--rs-cyan': String(colors.cyan ?? '#00C2E8'), '--rs-honey': String(colors.honey ?? '#D6A94F') } as CSSProperties;
  return (
    <div className={`${styles.document}${printMode ? ` ${styles.printDocument}` : ''}`} style={vars} data-report-ready="true">
      {pages.map((page, pageIndex) => (
        <ReportPageView key={page.pageId} page={page} pageIndex={page.referencePage ? page.referencePage - 1 : pageIndex} total={layout.pages.length} data={data} bindings={bindings} selectedBlockId={selectedBlockId} onSelectBlock={onSelectBlock} zoom={printMode ? 1 : zoom} dropPreview={printMode?null:dropPreview} />
      ))}
    </div>
  );
}

function ReportPageView({ page, pageIndex, total, data, bindings, selectedBlockId, onSelectBlock, zoom, dropPreview }: { page: ReportPage; pageIndex: number; total: number; data: PreviewData; bindings: JsonObject[]; selectedBlockId?: string | null; onSelectBlock?: (id: string) => void; zoom: number; dropPreview?:Props['dropPreview'] }) {
  const size = page.pageSize === 'A4' ? styles.a4 : styles.letter;
  const dataPage = page.blocks.some((block) => DATA_VISUAL_TYPES.has(block.type));
  return (
    <article data-report-page className={`${styles.reportPage} ${size} ${page.layoutMode === 'ABSOLUTE_LAYOUT' ? styles.absolute : styles.flow}${dataPage ? ` ${styles.dataPage}` : ''}`} style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', marginBottom: `${(zoom - 1) * (page.pageSize === 'A4' ? 1123 : 1056) + 28}px` }}>
      {page.header?.enabled && <header className={styles.pageHeader}><span className={styles.logoMark}>CREVANTIA</span><span>{page.sectionName}</span></header>}
      <div className={styles.pageBody} data-report-page-body="true">
        {page.blocks.map((block, index) => {
          const id = block.id ?? `${block.type.toLowerCase()}-${index + 1}`;
          const insertion = dropPreview?.mode==='FLOW'&&dropPreview.index===index&&<DropPositionPreview preview={dropPreview}/>;
          if ((block.settings as JsonObject | undefined)?.hidden) return insertion ? <Fragment key={`drop-${id}`}>{insertion}</Fragment> : null;
          if (block.type === 'RICH_TEXT' && block.role === 'SOURCE_COPY' && (page.sectionCode === 'COVER' || page.blocks.some((item) => item.type === 'SUMMARY_MATRIX'))) return insertion ? <Fragment key={`drop-${id}`}>{insertion}</Fragment> : null;
          return <Fragment key={id}>{insertion}<Block block={block} blockIndex={index} page={page} data={data} bindings={bindings} selected={selectedBlockId === id} onClick={onSelectBlock ? () => onSelectBlock(id) : undefined} /></Fragment>;
        })}
        {dropPreview?.mode==='FLOW'&&dropPreview.index>=page.blocks.length&&<DropPositionPreview preview={dropPreview}/>}
        {dropPreview?.mode==='ABSOLUTE'&&<DropPositionPreview preview={dropPreview}/>}
      </div>
      {page.footer?.enabled && <footer className={styles.pageFooter}><span>Diagnóstico de Perfil Psicofinanciero</span><span>{page.footer.pageNumber ?? pageIndex} / {total - 1}</span></footer>}
    </article>
  );
}

function DropPositionPreview({preview}:{preview:NonNullable<Props['dropPreview']>}) {
  const absolute=preview.mode==='ABSOLUTE';
  return <div className={`${styles.dropPosition}${absolute?` ${styles.dropPositionAbsolute}`:''}`} style={{height:preview.height,width:absolute?preview.width:undefined,left:absolute?preview.x:undefined,top:absolute?preview.y:undefined}}><span>Soltar aquí</span><b>{preview.type.replaceAll('_',' ').toLowerCase()}</b></div>;
}

function Block({ block, blockIndex, page, data, bindings, selected, onClick }: { block: ReportBlock; blockIndex: number; page: ReportPage; data: PreviewData; bindings: JsonObject[]; selected?: boolean; onClick?: () => void }) {
  const absolute = page.layoutMode === 'ABSOLUTE_LAYOUT' && block.layout;
  const configuredStyle = (block.style ?? {}) as CSSProperties;
  const style: CSSProperties = { ...configuredStyle, ...(absolute ? { position: 'absolute', left: block.layout?.x ?? 52, top: block.layout?.y ?? 96, width: block.layout?.width ?? 690, minHeight: block.layout?.height ?? 80 } : {}) };
  const metrics = metricValues(block, data, bindings);
  const comparison = comparisonMetricValues(block, data, bindings);
  const needsComparison = block.type === 'MULTI_RADAR_CHART' || block.type === 'POTENTIAL_ABILITY_MATRIX';
  if (!onClick && ((METRIC_REQUIRED_TYPES.has(block.type) && metrics.length === 0) || (needsComparison && (!comparison.primary.length || !comparison.secondary.length)))) return null;
  const content = renderBlock(block, page, data, metrics, comparison);
  return <section className={`${styles.block} ${selected ? styles.selectedBlock : ''} ${styles[`block${block.type}`] ?? ''}`} style={style} data-block-type={block.type} data-block-index={blockIndex} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={onClick ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick(); } } : undefined}>{content}</section>;
}

const DATA_VISUAL_TYPES = new Set(['RADAR_CHART','MULTI_RADAR_CHART','DECILE_SCALE_TABLE','QUADRANT_CHART','QUADRANT_RESULT_TABLE','POTENTIAL_ABILITY_MATRIX','SUMMARY_MATRIX']);
const METRIC_REQUIRED_TYPES = new Set(['RADAR_CHART','DECILE_SCALE_TABLE','QUADRANT_CHART','QUADRANT_RESULT_TABLE','SUMMARY_MATRIX']);

function renderBlock(block: ReportBlock, page: ReportPage, data: PreviewData, metrics: Array<{ label: string; value: number }>, comparison: { primary: Array<{ label: string; value: number }>; secondary: Array<{ label: string; value: number }> }): ReactNode {
  const content = (block.content ?? {}) as JsonObject;
  const title = String(content.title ?? page.sectionName);
  switch (block.type) {
    case 'COVER_BLOCK': return <CoverBlock content={content} blockStyle={(block.style??{}) as JsonObject} data={data}/>;
    case 'HEADING': return <h2>{resolveVariable(String(content.text ?? page.sectionName),data)}</h2>;
    case 'RICH_TEXT': return <RichCopy block={block} page={page} data={data} />;
    case 'RADAR_CHART': return <ChartFrame title={title}>{metrics.length >= 3 ? <Radar metrics={metrics}/> : block.bindingPreset ? <OptionalDataEmpty/> : <Radar metrics={fallbackMetrics(5)}/>}</ChartFrame>;
    case 'MULTI_RADAR_CHART': return <ChartFrame title={String(content.title ?? 'Habilidad y potencial')}>{comparison.primary.length >= 3 && comparison.secondary.length >= 3 ? <Radar metrics={comparison.primary} comparisonMetrics={comparison.secondary}/> : block.bindingPreset ? <OptionalDataEmpty/> : <Radar metrics={fallbackMetrics(5)} comparisonMetrics={fallbackMetrics(5).map((item)=>({...item,value:Math.max(1,item.value-2)}))}/>}</ChartFrame>;
    case 'DECILE_SCALE_TABLE': return <div>{Boolean(content.title)&&<h3>{String(content.title)}</h3>}{metrics.length ? <DecileTable metrics={metrics} labels={String(content.scaleLabels??'POR DESARROLLAR|MEDIO|ALTO|GRAN POTENCIAL').split('|')}/> : block.bindingPreset ? <OptionalDataEmpty/> : <DecileTable metrics={fallbackMetrics(4)} labels={String(content.scaleLabels??'POR DESARROLLAR|MEDIO|ALTO|GRAN POTENCIAL').split('|')}/>}</div>;
    case 'QUADRANT_CHART': return <ChartFrame title={title}>{metrics.length >= 2 ? <Quadrant metrics={metrics} labels={String(content.labels??'Despreocupación|Realización|Frustración|Mezquindad').split('|')} axisLabel={String(content.axisLabel??'Situación financiera')}/> : block.bindingPreset ? <OptionalDataEmpty/> : <Quadrant metrics={fallbackMetrics(2)} labels={String(content.labels??'Despreocupación|Realización|Frustración|Mezquindad').split('|')} axisLabel={String(content.axisLabel??'Situación financiera')}/>}</ChartFrame>;
    case 'QUADRANT_RESULT_TABLE': return <QuadrantResult content={content} metrics={metrics} data={data}/>;
    case 'POTENTIAL_ABILITY_MATRIX': return <div>{Boolean(content.title)&&<h3>{String(content.title)}</h3>}<PotentialMatrix labels={String(content.labels??'Habilidad baja|Habilidad alta|Potencial alto|Potencial no explotado|Fortaleza manifiesta|Potencial bajo|Capacidad por desarrollar|Habilidad aprendida').split('|')}/></div>;
    case 'SUMMARY_MATRIX': return <div><h2 className={styles.summaryTitle}>{resolveVariable(String(content.title??page.sectionName),data)}</h2>{metrics.length ? <SummaryMatrix metrics={metrics}/> : block.bindingPreset ? <OptionalDataEmpty/> : <SummaryMatrix metrics={fallbackMetrics(8)}/>}</div>;
    case 'TABLE_OF_CONTENTS': return <div><h2>{String(content.title??'Contenido')}</h2><p>{String(content.description??'Índice generado automáticamente desde las secciones de la plantilla.')}</p></div>;
    case 'HEADER_FOOTER': return <div className={styles.headerFooterPreview}><b>{resolveVariable(String(content.headerText??'CREVANTIA'),data)}</b><span>{resolveVariable(String(content.footerText??'{{assessment.name}}'),data)}</span></div>;
    case 'IMAGE': return content.src ? <figure className={styles.reportImage}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={String(content.src)} alt={String(content.alt ?? '')} style={{objectFit:String(content.fit??'contain') as CSSProperties['objectFit'],objectPosition:String(content.position??'center'),maxHeight:`${Number(content.maxHeight??520)}px`}}/>
      {Boolean(content.title)&&<figcaption>{String(content.title)}</figcaption>}
    </figure> : <div className={styles.placeholder}>Selecciona el bloque para agregar una imagen</div>;
    case 'PAGE_BREAK': return <div className={styles.pageBreak}>Salto de página</div>;
    case 'STATIC_EXAMPLE_CHART': return <ChartFrame title={String(content.title??'Ejemplo editorial')}><Radar metrics={fallbackMetrics(4)} /></ChartFrame>;
    default: return <div className={styles.placeholder}>{block.type}</div>;
  }
}

function CoverBlock({content,blockStyle,data}:{content:JsonObject;blockStyle:JsonObject;data:PreviewData}) {
  const css={
    backgroundColor:String(blockStyle.backgroundColor??'#080b12'), color:String(blockStyle.color??'#ffffff'), textAlign:String(blockStyle.textAlign??'left'),
    '--cover-accent':String(blockStyle.accentColor??'#00c2e8'), '--cover-badge':String(blockStyle.badgeColor??'#d6a94f'),
    '--cover-title-size':`${Number(blockStyle.titleFontSize??56)}px`, '--cover-padding-x':`${Number(blockStyle.horizontalPadding??72)}px`, '--cover-subject-bottom':`${Number(blockStyle.subjectBottom??145)}px`,
  } as CSSProperties;
  return <div className={styles.cover} style={css}><span className={styles.coverKicker}>{resolveVariable(String(content.kicker??'DIAGNÓSTICO DE'),data)}</span><h1>{resolveVariable(String(content.title??'Perfil\nPsicofinanciero'),data)}</h1><b>{resolveVariable(String(content.badge??'DPO-PPF©'),data)}</b><div className={styles.coverPerson}>{resolveVariable(String(content.subject??'{{person.fullName}}'),data)}<small>{resolveVariable(String(content.date??'{{assessment.completedAt|monthYear}}'),data)}</small></div><p className={styles.coverLegal}>{resolveVariable(String(content.legal??'Todos los derechos reservados. Este documento está protegido por derechos de autor.'),data)}</p></div>;
}

function RichCopy({ block, page, data }: { block: ReportBlock; page: ReportPage; data: PreviewData }) {
  const content = block.content as { text?: string; richText?: RichNode } | undefined;
  if (content?.richText?.type === 'doc') return <div className={styles.richCopy}>{renderRichNodes(content.richText.content, data)}</div>;
  const text = resolveVariable(content?.text ?? page.sourceText ?? '', data).replace(/^\s*\d+\s*/m, '').trim();
  const lines = text.split(/\n\s*\n/).filter(Boolean);
  return <div className={styles.richCopy}>{lines.map((line, index) => index === 0 && line.length < 90 ? <h2 key={index}>{line}</h2> : <p key={index}>{line.replace(/\n/g, ' ')}</p>)}</div>;
}

interface RichNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type?: string; attrs?: Record<string, unknown> }>;
  content?: RichNode[];
}

function renderRichNodes(nodes: RichNode[] | undefined, data: PreviewData): ReactNode[] {
  return (nodes ?? []).map((node, index) => renderRichNode(node, `${node.type ?? 'node'}-${index}`, data));
}

function renderRichNode(node: RichNode, key: string, data: PreviewData): ReactNode {
  if (node.type === 'text') {
    let result: ReactNode = resolveVariable(node.text ?? '', data);
    for (const mark of node.marks ?? []) {
      if (mark.type === 'bold') result = <strong>{result}</strong>;
      else if (mark.type === 'italic') result = <em>{result}</em>;
      else if (mark.type === 'underline') result = <u>{result}</u>;
      else if (mark.type === 'strike') result = <s>{result}</s>;
      else if (mark.type === 'code') result = <code>{result}</code>;
      else if (mark.type === 'link') {
        const href = safeHref(String(mark.attrs?.href ?? ''));
        if (href) result = <a href={href}>{result}</a>;
      }
    }
    return <Fragment key={key}>{result}</Fragment>;
  }
  const children = renderRichNodes(node.content, data);
  const style = richBlockStyle(node.attrs);
  if (node.type === 'paragraph') return <p key={key} style={style}>{children}</p>;
  if (node.type === 'heading') {
    const level = Number(node.attrs?.level ?? 2);
    if (level === 1) return <h1 key={key} style={style}>{children}</h1>;
    if (level === 3) return <h3 key={key} style={style}>{children}</h3>;
    return <h2 key={key} style={style}>{children}</h2>;
  }
  if (node.type === 'bulletList') return <ul key={key}>{children}</ul>;
  if (node.type === 'orderedList') return <ol key={key} start={Number(node.attrs?.start ?? 1)}>{children}</ol>;
  if (node.type === 'listItem') return <li key={key}>{children}</li>;
  if (node.type === 'blockquote') return <blockquote key={key}>{children}</blockquote>;
  if (node.type === 'hardBreak') return <br key={key}/>;
  if (node.type === 'horizontalRule') return <hr key={key}/>;
  return <Fragment key={key}>{children}</Fragment>;
}

function richBlockStyle(attrs?: Record<string, unknown>): CSSProperties {
  const textAlign = ['left', 'center', 'right', 'justify'].includes(String(attrs?.textAlign)) ? String(attrs?.textAlign) as CSSProperties['textAlign'] : undefined;
  return { textAlign, textIndent: attrs?.firstLineIndent ? '1.5em' : undefined };
}

function safeHref(value: string) { return /^(https?:|mailto:)/i.test(value) ? value : ''; }

function ChartFrame({ title, children }: { title: string; children: ReactNode }) { return <div className={styles.chartFrame}><h3>{title}</h3>{children}</div>; }
function OptionalDataEmpty() { return <div className={styles.optionalDataEmpty}>Este bloque no tiene resultados vinculados y se omitirá en el reporte final.</div>; }

function QuadrantResult({content,metrics,data}:{content:JsonObject;metrics:Array<{label:string;value:number}>;data:PreviewData}) {
  const x=metrics[0]?.value??0,y=metrics[1]?.value??0;
  const calculated=x>5?(y>5?'Realización':'Mezquindad'):(y>5?'Despreocupación':'Frustración');
  return <div className={styles.resultCallout}><b>{resolveVariable(String(content.eyebrow??'Tu cuadrante actual'),data)}</b><span>{resolveVariable(String(content.result??calculated),data)}</span><p>{resolveVariable(String(content.description??`Resultado calculado con satisfacción ${y}/10 y situación financiera ${x}/10.`),data)}</p></div>;
}

function Radar({ metrics, comparisonMetrics }: { metrics: Array<{ label: string; value: number }>; comparisonMetrics?: Array<{ label:string;value:number }> }) {
  const items = metrics.length >= 3 ? metrics : fallbackMetrics(5); const cx = 180; const cy = 150; const radius = 105; const points = (values:Array<{label:string;value:number}>) => values.map((item, index) => { const angle = -Math.PI / 2 + index * (Math.PI * 2 / values.length); const r = radius * Math.min(10, Math.max(1, item.value)) / 10; return `${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`; }).join(' ');
  const grid = [2,4,6,8,10].map((ring) => items.map((_item,index) => { const angle=-Math.PI/2+index*(Math.PI*2/items.length); return `${cx+Math.cos(angle)*radius*ring/10},${cy+Math.sin(angle)*radius*ring/10}`; }).join(' '));
  return <svg viewBox="0 0 360 330" role="img" aria-label="Gráfica radial">{grid.map((p,i)=><polygon key={i} points={p} fill="none" stroke="#d8dde4"/>)}{items.map((_item,index)=>{const a=-Math.PI/2+index*(Math.PI*2/items.length);return <line key={index} x1={cx} y1={cy} x2={cx+Math.cos(a)*radius} y2={cy+Math.sin(a)*radius} stroke="#d8dde4"/>})}{comparisonMetrics&&<polygon points={points(comparisonMetrics)} fill="rgba(214,169,79,.2)" stroke="var(--rs-honey)" strokeWidth="2"/>}<polygon points={points(items)} fill="rgba(0,194,232,.2)" stroke="var(--rs-indigo)" strokeWidth="2.5"/>{items.map((item,index)=>{const a=-Math.PI/2+index*(Math.PI*2/items.length);return <text key={item.label} x={cx+Math.cos(a)*(radius+28)} y={cy+Math.sin(a)*(radius+20)} textAnchor="middle" fontSize="9" fill="#172033">{item.label.replace(/^(Habilidad|Potencial)\s+/i,'').slice(0,22)}</text>})}</svg>;
}

function DecileTable({ metrics,labels }: { metrics: Array<{ label: string; value: number }>;labels:string[] }) { return <div className={styles.decileTable}><div className={styles.scaleHeader}>{Array.from({length:4},(_,index)=><span key={index}>{labels[index]??`Rango ${index+1}`}</span>)}</div>{metrics.map((metric)=><div className={styles.scaleRow} key={metric.label}><b>{metric.label}</b><div>{Array.from({length:10},(_,index)=><i className={index+1===metric.value?styles.activeDot:''} key={index}>{index+1===metric.value?'●':'○'}</i>)}</div></div>)}</div>; }
function Quadrant({ metrics,labels,axisLabel }: { metrics: Array<{ label: string; value: number }>;labels:string[];axisLabel:string }) { const x=metrics[0]?.value??7,y=metrics[1]?.value??8; return <svg className={styles.quadrant} viewBox="0 0 420 330"><rect x="50" y="25" width="320" height="250" fill="#f4f2ec"/><line x1="210" y1="25" x2="210" y2="275" stroke="#302b78"/><line x1="50" y1="150" x2="370" y2="150" stroke="#302b78"/><text x="125" y="55">{labels[0]??'Cuadrante 1'}</text><text x="265" y="55">{labels[1]??'Cuadrante 2'}</text><text x="125" y="250">{labels[2]??'Cuadrante 3'}</text><text x="270" y="250">{labels[3]??'Cuadrante 4'}</text><circle cx={50+x*32} cy={275-y*25} r="9" fill="#00c2e8" stroke="#302b78" strokeWidth="3"/><text x="175" y="315">{axisLabel} →</text></svg>; }
function PotentialMatrix({labels}:{labels:string[]}) { return <div className={styles.matrix}><span></span><b>{labels[0]??'Habilidad baja'}</b><b>{labels[1]??'Habilidad alta'}</b><b>{labels[2]??'Potencial alto'}</b><span>{labels[3]??'Potencial no explotado'}</span><span>{labels[4]??'Fortaleza manifiesta'}</span><b>{labels[5]??'Potencial bajo'}</b><span>{labels[6]??'Capacidad por desarrollar'}</span><span>{labels[7]??'Habilidad aprendida'}</span></div>; }
function SummaryMatrix({ metrics }: { metrics: Array<{ label: string; value: number }> }) { return <div className={styles.summaryMatrix}>{metrics.map(item=><div key={item.label}><span>{item.label}</span><b>{item.value}/10</b><i style={{width:`${item.value*10}%`}}/></div>)}</div>; }
function fallbackMetrics(count: number) { return Array.from({length:count},(_,index)=>({label:['Visión estratégica','Competencia financiera','Autodominio','Ingreso','Inversión','Tenacidad','Ahorro','Deuda'][index]??`Métrica ${index+1}`,value:4+(index*2)%7})); }
