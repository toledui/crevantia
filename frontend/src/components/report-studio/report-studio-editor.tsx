'use client';

import { DndContext, DragEndEvent, DragMoveEvent, DragOverlay, DragStartEvent, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, horizontalListSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { JSONContent } from '@tiptap/core';
import { ArrowLeft, ChevronDown, Copy, Eye, FileDown, Grid3X3, History, Link2, PanelTop, Plus, Redo2, RotateCcw, Save, Search, Settings2, Trash2, Undo2, X, ZoomIn, ZoomOut } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { apiDownload, apiFetch, apiUpload } from '@/lib/api';
import { blockId, REPORT_COMPONENTS, type JsonObject, type ReportBlock, type ReportHeaderFooterConfig, type ReportLayout, type ReportPage, type ReportVersionResponse } from '@/lib/report-studio';
import { ReportRenderer } from './report-renderer';
import { RichTextEditor } from './rich-text-editor';
import { componentLabels, ReportComponentIcon } from './report-component-icon';
import styles from './report-studio.module.css';

interface BindingOption { group: string; sourceType: string; sourceCode: string; label: string }
interface CatalogItem { id: string; code: string; name: string }
interface StudioCatalog { tests: CatalogItem[]; assessments: CatalogItem[]; themes: CatalogItem[] }
interface RevisionItem { id:string; version:string; status:string; pendingBindings:number; configurationHash:string; createdAt:string; publishedAt?:string|null }
interface DropPreview { type:string; mode:'FLOW'|'ABSOLUTE'; index:number; x?:number; y?:number; width:number; height:number }
const DYNAMIC_FIELDS = [
  ['{{person.fullName}}', 'Nombre completo'], ['{{person.firstName}}', 'Nombre'], ['{{assessment.name}}', 'Nombre de la evaluación'],
  ['{{assessment.completedAt|monthYear}}', 'Mes de aplicación'], ['{{report.generatedAt|monthYear}}', 'Mes de generación'],
] as const;
const HEADER_FOOTER_FIELDS = [...DYNAMIC_FIELDS, ['{{page.sectionName}}','Nombre de la sección'], ['{{page.number}}','Número de página'], ['{{page.total}}','Total de páginas']] as const;
const DEFAULT_HEADER_FOOTER:ReportHeaderFooterConfig = { headerEnabled:true, headerKind:'TEXT', headerLeft:'CREVANTIA', headerImageSrc:'', headerImageAlt:'Logo del reporte', headerRight:'{{page.sectionName}}', footerEnabled:true, footerLeft:'Diagnóstico de Perfil Psicofinanciero', footerRight:'{{page.number}} / {{page.total}}', showOnCover:false };

export function ReportStudioEditor({ versionId }: { versionId: string }) {
  const router = useRouter();
  const [version, setVersion] = useState<ReportVersionResponse | null>(null);
  const [layout, setLayout] = useState<ReportLayout | null>(null);
  const [bindings, setBindings] = useState<JsonObject[]>([]);
  const [options, setOptions] = useState<BindingOption[]>([]);
  const [catalog, setCatalog] = useState<StudioCatalog>({ tests: [], assessments: [], themes: [] });
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkSaving, setLinkSaving] = useState(false);
  const [linkForm, setLinkForm] = useState({ testId: '', assessmentId: '', language: 'es-MX', audience: 'INDIVIDUAL' });
  const [selectedPageId, setSelectedPageId] = useState('');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(.72);
  const [savedState, setSavedState] = useState<'saved'|'saving'|'dirty'>('saved');
  const [preview, setPreview] = useState(false);
  const [activeTab, setActiveTab] = useState<'CONTENT'|'DATA'|'STYLE'|'LAYOUT'|'VISIBILITY'>('CONTENT');
  const [history, setHistory] = useState<ReportLayout[]>([]);
  const [future, setFuture] = useState<ReportLayout[]>([]);
  const [revisionsOpen,setRevisionsOpen]=useState(false);
  const [chromeOpen,setChromeOpen]=useState(false);
  const [revisions,setRevisions]=useState<RevisionItem[]>([]);
  const [revisionSearch,setRevisionSearch]=useState('');
  const [activeLibraryType,setActiveLibraryType]=useState<string|null>(null);
  const [dropPreview,setDropPreview]=useState<DropPreview|null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    Promise.all([
      apiFetch<ReportVersionResponse>(`/admin/report-studio/versions/${versionId}`),
      apiFetch<BindingOption[]>('/admin/report-studio/binding-options'),
      apiFetch<StudioCatalog>('/admin/report-studio/catalog'),
    ]).then(([response, bindingOptions, studioCatalog]) => {
      setVersion(response); setLayout(response.layoutJson); setBindings(response.bindingConfigJson.bindingPresets ?? []); setSelectedPageId(response.layoutJson.pages[0]?.pageId ?? ''); setOptions(bindingOptions);
      setCatalog(studioCatalog); const link=response.template.testLinks?.[0]; setLinkForm({testId:link?.testId??studioCatalog.tests[0]?.id??'',assessmentId:link?.assessmentId??'',language:link?.language??'es-MX',audience:link?.audience??'INDIVIDUAL'});
    });
  }, [versionId]);

  const save = useCallback(async () => {
    if (!layout || !version || savedState !== 'dirty') return;
    setSavedState('saving');
    const result = await apiFetch<ReportVersionResponse>(`/admin/report-studio/versions/${version.id}/save-revision`, { method: 'POST', body: JSON.stringify({ layoutJson: layout, bindingConfigJson: { schemaVersion: '1.0.0', bindingPresets: bindings } }) });
    setVersion(result);setLayout(result.layoutJson);setBindings(result.bindingConfigJson.bindingPresets??[]);setHistory([]);setFuture([]);setSavedState('saved');router.replace(`/admin/report-studio/${result.id}`);
  }, [bindings, layout, router, savedState, version]);

  const changeLayout = useCallback((updater: (current: ReportLayout) => ReportLayout) => {
    setLayout((current) => { if (!current) return current; setHistory((items) => [...items.slice(-49), structuredClone(current)]); setFuture([]); const next = updater(structuredClone(current)); setSavedState('dirty'); return next; });
  }, []);

  const undo = useCallback(() => { if (!history.length || !layout) return; const previous=history.at(-1)!; setHistory(history.slice(0,-1)); setFuture([structuredClone(layout),...future]); setLayout(previous); setSavedState('dirty'); }, [future,history,layout]);
  const redo = useCallback(() => { if (!future.length || !layout) return; const next=future[0]!; setFuture(future.slice(1)); setHistory([...history,structuredClone(layout)]); setLayout(next); setSavedState('dirty'); }, [future,history,layout]);

  const selectedPage = layout?.pages.find((page) => page.pageId === selectedPageId);
  const selectedBlockIndex = selectedPage?.blocks.findIndex((block,index)=>blockId(block,index)===selectedBlockId) ?? -1;
  const selectedBlock = selectedBlockIndex >= 0 ? selectedPage?.blocks[selectedBlockIndex] : undefined;
  const headerFooter = { ...DEFAULT_HEADER_FOOTER, ...((layout?.document?.headerFooter ?? {}) as Partial<ReportHeaderFooterConfig>) };

  const addBlock = useCallback((type: string, target?: DropPreview|null) => {
    if (type === 'HEADER_FOOTER') { setChromeOpen(true); return; }
    if (!selectedPageId) return; const id=`${type.toLowerCase()}-${crypto.randomUUID()}`;
    changeLayout((current) => { const page=current.pages.find(item=>item.pageId===selectedPageId);if(!page)return current;const block=newBlock(id,type,page.layoutMode==='FLOW_LAYOUT');if(page.layoutMode==='ABSOLUTE_LAYOUT'&&target?.mode==='ABSOLUTE')block.layout={x:target.x??52,y:target.y??96,width:target.width,height:target.height};if(page.layoutMode==='FLOW_LAYOUT'&&target?.mode==='FLOW')page.blocks.splice(Math.min(target.index,page.blocks.length),0,block);else page.blocks.push(block);return current; }); setSelectedBlockId(id); setActiveTab(type.includes('CHART')||type.includes('TABLE')||type.includes('MATRIX')?'DATA':'CONTENT');
  }, [changeLayout,selectedPageId]);

  const updateHeaderFooter = useCallback((patch:Partial<ReportHeaderFooterConfig>) => {
    changeLayout((current) => {
      const configured = (current.document?.headerFooter ?? {}) as Partial<ReportHeaderFooterConfig>;
      current.document = { ...current.document, headerFooter: { ...DEFAULT_HEADER_FOOTER, ...configured, ...patch } };
      return current;
    });
  },[changeLayout]);

  const updateBlock = (patch: Partial<ReportBlock>) => changeLayout((current)=>{const page=current.pages.find(item=>item.pageId===selectedPageId); if(page&&selectedBlockIndex>=0) page.blocks[selectedBlockIndex]={...page.blocks[selectedBlockIndex]!,...patch}; return current;});
  const deleteBlock = useCallback(()=>{if(selectedBlockIndex<0)return;changeLayout(current=>{const page=current.pages.find(item=>item.pageId===selectedPageId);page?.blocks.splice(selectedBlockIndex,1);return current;});setSelectedBlockId(null);},[changeLayout,selectedBlockIndex,selectedPageId]);
  const duplicateBlock = useCallback(()=>{if(!selectedBlock)return;const copy=structuredClone(selectedBlock);copy.id=`${copy.type.toLowerCase()}-${crypto.randomUUID()}`;changeLayout(current=>{current.pages.find(item=>item.pageId===selectedPageId)?.blocks.splice(selectedBlockIndex+1,0,copy);return current;});setSelectedBlockId(copy.id);},[changeLayout,selectedBlock,selectedBlockIndex,selectedPageId]);
  const deletePage = useCallback(() => {
    if (!layout || layout.pages.length <= 1 || !selectedPageId) return;
    const pageIndex = layout.pages.findIndex((page) => page.pageId === selectedPageId);
    if (pageIndex < 0) return;
    const page = layout.pages[pageIndex]!;
    if (!window.confirm(`¿Eliminar la página ${pageIndex + 1} (${page.sectionName})? Esta acción se puede deshacer.`)) return;
    const nextPageId = layout.pages[pageIndex + 1]?.pageId ?? layout.pages[pageIndex - 1]?.pageId ?? '';
    changeLayout((current) => {
      current.pages = current.pages.filter((item) => item.pageId !== selectedPageId);
      return current;
    });
    setSelectedPageId(nextPageId);
    setSelectedBlockId(null);
  }, [changeLayout, layout, selectedPageId]);

  const discardChanges = useCallback(() => {
    if (!version || savedState !== 'dirty') return;
    if (!window.confirm('¿Descartar todos los cambios sin publicar? El reporte volverá a la última versión publicada.')) return;
    const publishedLayout = structuredClone(version.layoutJson);
    setLayout(publishedLayout);
    setBindings(structuredClone(version.bindingConfigJson.bindingPresets ?? []));
    setHistory([]);
    setFuture([]);
    setSelectedPageId((current) => publishedLayout.pages.some((page) => page.pageId === current) ? current : (publishedLayout.pages[0]?.pageId ?? ''));
    setSelectedBlockId(null);
    setDropPreview(null);
    setSavedState('saved');
  }, [savedState, version]);

  useEffect(()=>{const handler=(event:KeyboardEvent)=>{const mod=event.ctrlKey||event.metaKey;if(mod&&event.key.toLowerCase()==='s'){event.preventDefault();void save();}else if(mod&&event.key.toLowerCase()==='z'){event.preventDefault();if(event.shiftKey)redo();else undo();}else if(mod&&event.key.toLowerCase()==='d'&&selectedBlock){event.preventDefault();duplicateBlock();}else if(event.key==='Delete'&&selectedBlock){deleteBlock();}};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);},[deleteBlock,duplicateBlock,redo,save,selectedBlock,undo]);

  function dragStart(event:DragStartEvent){const active=String(event.active.id);if(active.startsWith('library:'))setActiveLibraryType(active.replace('library:',''));}
  function dragMove(event:DragMoveEvent){
    const active=String(event.active.id);if(!active.startsWith('library:')||!selectedPage)return;
    const translated=event.active.rect.current.translated;if(!translated)return;
    const body=document.querySelector<HTMLElement>('[data-report-page-body="true"]');if(!body)return;
    const bodyRect=body.getBoundingClientRect();const size=dropPreviewSize(active.replace('library:',''));
    if(selectedPage.layoutMode==='ABSOLUTE_LAYOUT'){
      const x=Math.max(0,Math.min((translated.left-bodyRect.left)/zoom,(bodyRect.width/zoom)-size.width));
      const y=Math.max(0,Math.min((translated.top-bodyRect.top)/zoom,(bodyRect.height/zoom)-size.height));
      setDropPreview({type:active.replace('library:',''),mode:'ABSOLUTE',index:selectedPage.blocks.length,x:Math.round(x),y:Math.round(y),width:size.width,height:size.height});return;
    }
    const centerY=translated.top+translated.height/2;
    const blocks=Array.from(body.querySelectorAll<HTMLElement>(':scope > [data-block-type]'));
    const target=blocks.find((block)=>centerY<block.getBoundingClientRect().top+block.getBoundingClientRect().height/2);
    const index=target ? Number(target.dataset.blockIndex) : selectedPage.blocks.length;
    setDropPreview({type:active.replace('library:',''),mode:'FLOW',index:Number.isFinite(index)?index:selectedPage.blocks.length,width:size.width,height:size.height});
  }
  function clearDrag(){setActiveLibraryType(null);setDropPreview(null);}
  function dragEnd(event: DragEndEvent) {
    const active=String(event.active.id),over=event.over?String(event.over.id):'';
    if(active.startsWith('library:')&&over==='page-canvas'){addBlock(active.replace('library:',''),dropPreview);clearDrag();return;}
    if(active.startsWith('page:')&&over.startsWith('page:')&&active!==over){const a=active.replace('page:',''),b=over.replace('page:','');changeLayout(current=>{const old=current.pages.findIndex(p=>p.pageId===a),next=current.pages.findIndex(p=>p.pageId===b);current.pages=arrayMove(current.pages,old,next);return current;});}
    clearDrag();
  }

  async function generatePdf() { if(!version)return;const result=await apiFetch<{id:string;downloadUrl:string}>(`/admin/report-studio/versions/${version.id}/pdf`,{method:'POST',body:JSON.stringify({pageSize:selectedPage?.pageSize??'LETTER'})});const file=await apiDownload(result.downloadUrl);const url=URL.createObjectURL(file.blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=file.filename;anchor.click();URL.revokeObjectURL(url); }
  async function saveLink() { if(!linkForm.testId||!version)return;setLinkSaving(true);try{await apiFetch(`/admin/report-studio/templates/${version.template.id}/link`,{method:'PATCH',body:JSON.stringify({...linkForm,assessmentId:linkForm.assessmentId||undefined,isDefault:true,isActive:true})});const response=await apiFetch<ReportVersionResponse>(`/admin/report-studio/versions/${version.id}`);setVersion(response);setLinkOpen(false);}finally{setLinkSaving(false);} }
  async function openRevisions(){if(!version)return;setRevisionSearch('');setRevisions(await apiFetch<RevisionItem[]>(`/admin/report-studio/templates/${version.template.id}/revisions`));setRevisionsOpen(true);}
  async function restoreRevision(item:RevisionItem){if(!window.confirm(`¿Restaurar la versión ${item.version}? Se publicará como una revisión nueva y no se modificará el original.`))return;setSavedState('saving');const result=await apiFetch<ReportVersionResponse>(`/admin/report-studio/versions/${item.id}/restore`,{method:'POST'});setVersion(result);setLayout(result.layoutJson);setBindings(result.bindingConfigJson.bindingPresets??[]);setSelectedPageId(result.layoutJson.pages[0]?.pageId??'');setSelectedBlockId(null);setHistory([]);setFuture([]);setSavedState('saved');setRevisionsOpen(false);router.replace(`/admin/report-studio/${result.id}`);}

  if(!version||!layout)return <div className={styles.loading}>Preparando Report Studio…</div>;
  if(preview)return <div className={styles.previewOverlay}><button type="button" onClick={()=>setPreview(false)}>Cerrar vista previa</button><ReportRenderer layout={layout} data={version.previewData} theme={version.theme?.configJson} bindings={bindings}/></div>;

  return <DndContext sensors={sensors} onDragStart={dragStart} onDragMove={dragMove} onDragCancel={clearDrag} onDragEnd={dragEnd}>
    <div className={styles.studio}>
      <header className={styles.toolbar}>
        <div className={styles.titleArea}><Link href="/admin/report-studio" aria-label="Volver"><ArrowLeft/></Link><div><small>REPORT STUDIO</small><strong>{version.template.name}</strong></div><span>{version.version} · {version.status}</span></div>
        <div className={styles.historyTools}><button type="button" onClick={undo} disabled={!history.length}><Undo2/> Deshacer</button><button type="button" onClick={redo} disabled={!future.length}><Redo2/> Rehacer</button></div>
        <div className={styles.toolbarActions}><span className={styles.saveState}>{savedState==='saving'?'Creando revisión…':savedState==='dirty'?'Cambios sin publicar':'Versión publicada'}</span><button type="button" onClick={()=>void openRevisions()}><History/> Versiones</button><button type="button" onClick={()=>setChromeOpen(true)}><PanelTop/> Encabezado y pie</button><button type="button" onClick={()=>setLinkOpen(true)}><Settings2/> Vinculación</button><button type="button" onClick={()=>setPreview(true)}><Eye/> Vista previa</button><button type="button" onClick={()=>void generatePdf()}><FileDown/> PDF</button>{savedState==='dirty'&&<button type="button" className={styles.discardChanges} onClick={discardChanges}><RotateCcw/> Descartar cambios</button>}<button className={styles.publish} type="button" disabled={savedState!=='dirty'} title={savedState==='saved'?'No hay cambios pendientes':undefined} onClick={()=>void save()}><Save/> Guardar y publicar</button></div>
      </header>
      <aside className={styles.library}><div className={styles.panelHeading}><span>Componentes</span><button><Search/></button></div>{['Contenido','Resultados','Especiales'].map(group=><section key={group}><h3>{group}<ChevronDown/></h3>{REPORT_COMPONENTS.filter(([category])=>category===group).map(([,type])=><LibraryItem key={type} type={type} onAdd={()=>addBlock(type)}/>)}</section>)}</aside>
      <main className={styles.workspace}><div className={styles.canvasTools}><button><Grid3X3/> Guías</button><div><button onClick={()=>setZoom(Math.max(.4,zoom-.1))}><ZoomOut/></button><span>{Math.round(zoom*100)}%</span><button onClick={()=>setZoom(Math.min(1.2,zoom+.1))}><ZoomIn/></button></div></div><CanvasDrop><ReportRenderer layout={layout} data={version.previewData} theme={version.theme?.configJson} bindings={bindings} selectedPageId={selectedPageId} selectedBlockId={selectedBlockId} onSelectBlock={setSelectedBlockId} zoom={zoom} dropPreview={dropPreview}/></CanvasDrop></main>
      <aside className={styles.inspector}><div className={styles.panelHeading}><span>Propiedades</span>{selectedBlock&&<em>{selectedBlock.type}</em>}</div>{selectedBlock?<><nav>{(['CONTENT','DATA','STYLE','LAYOUT','VISIBILITY'] as const).map(tab=><button className={activeTab===tab?styles.activeTab:''} key={tab} onClick={()=>setActiveTab(tab)}>{tab}</button>)}</nav><Inspector tab={activeTab} block={selectedBlock} inheritedText={selectedPage?.sourceText} options={options} bindings={bindings} versionId={version.id} onChange={updateBlock}/><div className={styles.blockActions}><button onClick={duplicateBlock}><Copy/>Duplicar</button><button className={styles.danger} onClick={deleteBlock}>Eliminar</button></div></>:<div className={styles.emptyInspector}>Selecciona un bloque para editar su contenido, datos y apariencia.</div>}{activeTab==='DATA'&&selectedBlock?.bindingPreset&&<PendingBindings presetCode={selectedBlock.bindingPreset} bindings={bindings} options={options} onChange={(next)=>{setBindings(next);setSavedState('dirty');}}/>}</aside>
      <footer className={styles.pagesStrip}><span>PÁGINAS · {layout.pages.length}</span><SortableContext items={layout.pages.map(page=>`page:${page.pageId}`)} strategy={horizontalListSortingStrategy}>{layout.pages.map((page,index)=><PageThumb key={page.pageId} page={page} index={index} active={page.pageId===selectedPageId} onClick={()=>{setSelectedPageId(page.pageId);setSelectedBlockId(null);}}/>)}</SortableContext><button className={styles.addPage} type="button" aria-label="Agregar página" title="Agregar página" onClick={()=>changeLayout(current=>{const page:ReportPage={pageId:`page-${crypto.randomUUID()}`,sectionCode:'CUSTOM',sectionName:'Nueva página',layoutMode:'FLOW_LAYOUT',pageSize:selectedPage?.pageSize??'LETTER',blocks:[]};current.pages.push(page);setSelectedPageId(page.pageId);setSelectedBlockId(null);return current;})}><Plus/></button><button className={styles.deletePage} type="button" aria-label="Eliminar página seleccionada" title={layout.pages.length<=1?'El reporte debe conservar al menos una página':'Eliminar página seleccionada'} disabled={layout.pages.length<=1} onClick={deletePage}><Trash2/></button></footer>
      {linkOpen&&<div className={styles.linkBackdrop}><section className={styles.linkDialog}><header><div><span>VINCULACIÓN DEL REPORTE</span><h2>{version.template.name}</h2><p>Esta relación determina qué plantilla publicada se utiliza para cada resultado.</p></div><button onClick={()=>setLinkOpen(false)} aria-label="Cerrar"><X/></button></header><div className={styles.linkFields}><label>Prueba<select value={linkForm.testId} onChange={e=>setLinkForm({...linkForm,testId:e.target.value})}>{catalog.tests.map(item=><option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}</select></label><label>Evaluación<select value={linkForm.assessmentId} onChange={e=>setLinkForm({...linkForm,assessmentId:e.target.value})}><option value="">Cualquier evaluación compatible</option>{catalog.assessments.map(item=><option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}</select></label><label>Idioma<input value={linkForm.language} onChange={e=>setLinkForm({...linkForm,language:e.target.value})}/></label><label>Audiencia<select value={linkForm.audience} onChange={e=>setLinkForm({...linkForm,audience:e.target.value})}><option value="INDIVIDUAL">Individual</option><option value="BUSINESS">Empresarial</option><option value="SUMMARY">Resumen</option></select></label></div><div className={styles.linkNotice}><Link2/>La versión publicada será seleccionada automáticamente y se validará contra la prueba antes de generar el PDF.</div><footer><button onClick={()=>setLinkOpen(false)}>Cancelar</button><button className={styles.linkSave} disabled={linkSaving||!linkForm.testId} onClick={()=>void saveLink()}>{linkSaving?'Guardando…':'Guardar vinculación'}</button></footer></section></div>}
      {chromeOpen&&<div className={styles.linkBackdrop}><section className={styles.linkDialog}><header><div><span>CONFIGURACIÓN DEL DOCUMENTO</span><h2>Encabezado y pie del PDF</h2><p>Estos valores se aplican al canvas, la vista previa y el archivo descargado.</p></div><button onClick={()=>setChromeOpen(false)} aria-label="Cerrar"><X/></button></header><div className={`${styles.linkFields} ${styles.chromeFields}`}><label className={styles.switchRow}><input type="checkbox" checked={headerFooter.headerEnabled} onChange={event=>updateHeaderFooter({headerEnabled:event.target.checked})}/><span>Mostrar encabezado</span></label><label className={styles.switchRow}><input type="checkbox" checked={headerFooter.footerEnabled} onChange={event=>updateHeaderFooter({footerEnabled:event.target.checked})}/><span>Mostrar pie de página</span></label><div className={styles.headerPrimaryFields}><label>Contenido principal del encabezado<select value={headerFooter.headerKind} onChange={event=>updateHeaderFooter({headerKind:event.target.value as 'TEXT'|'IMAGE'})}><option value="TEXT">Título o texto</option><option value="IMAGE">Imagen o logo</option></select></label>{headerFooter.headerKind==='TEXT'?<TextContentField label="Título del encabezado" value={headerFooter.headerLeft} dynamic variables={HEADER_FOOTER_FIELDS} onChange={value=>updateHeaderFooter({headerLeft:value})}/>:<HeaderLogoInput versionId={version.id} src={headerFooter.headerImageSrc} alt={headerFooter.headerImageAlt} onChange={(src,alt)=>updateHeaderFooter({headerImageSrc:src,headerImageAlt:alt})}/>}</div><TextContentField label="Encabezado derecho" value={headerFooter.headerRight} dynamic variables={HEADER_FOOTER_FIELDS} onChange={value=>updateHeaderFooter({headerRight:value})}/><TextContentField label="Pie izquierdo" value={headerFooter.footerLeft} dynamic variables={HEADER_FOOTER_FIELDS} onChange={value=>updateHeaderFooter({footerLeft:value})}/><TextContentField label="Pie derecho y numeración" value={headerFooter.footerRight} dynamic variables={HEADER_FOOTER_FIELDS} onChange={value=>updateHeaderFooter({footerRight:value})}/><label className={styles.switchRow}><input type="checkbox" checked={headerFooter.showOnCover} onChange={event=>updateHeaderFooter({showOnCover:event.target.checked})}/><span>Mostrar también en la portada</span></label></div><div className={styles.linkNotice}><PanelTop/>El logo se ajusta automáticamente a un máximo de 112 × 22 px para conservar la altura editorial del encabezado.</div><footer><button onClick={()=>updateHeaderFooter(DEFAULT_HEADER_FOOTER)}>Restablecer</button><button className={styles.linkSave} onClick={()=>setChromeOpen(false)}>Listo</button></footer></section></div>}
      {revisionsOpen&&<div className={styles.linkBackdrop}><section className={styles.revisionsDialog}><header><div><span>HISTORIAL INMUTABLE</span><h2>Versiones del reporte</h2><p>Restaurar crea una revisión publicada nueva; nunca modifica la versión elegida.</p></div><button onClick={()=>setRevisionsOpen(false)} aria-label="Cerrar"><X/></button></header><label className={styles.revisionSearch}><Search/><input value={revisionSearch} placeholder="Buscar versión…" onChange={event=>setRevisionSearch(event.target.value)}/></label><div className={styles.revisionList}>{revisions.filter(item=>item.version.includes(revisionSearch.trim())).map(item=><article key={item.id} className={item.id===version.id?styles.currentRevision:''}><div><b>Versión {item.version}</b><span>{new Date(item.publishedAt??item.createdAt).toLocaleString('es-MX')} · {item.status}</span><small>{item.pendingBindings} datos opcionales · {item.configurationHash.slice(0,10)}</small></div>{item.id===version.id?<em>Actual</em>:<button type="button" onClick={()=>void restoreRevision(item)}><RotateCcw/> Restaurar</button>}</article>)}</div></section></div>}
    </div>
    <DragOverlay dropAnimation={null}>{activeLibraryType&&<div className={styles.dragGhost}><span><ReportComponentIcon type={activeLibraryType}/></span>{componentLabels[activeLibraryType]??activeLibraryType}</div>}</DragOverlay>
  </DndContext>;
}

function LibraryItem({type,onAdd}:{type:string;onAdd:()=>void}){const{attributes,listeners,setNodeRef,transform}=useDraggable({id:`library:${type}`});return <button ref={setNodeRef} style={{transform:CSS.Translate.toString(transform)}} {...listeners}{...attributes} onDoubleClick={onAdd} title="Arrastra al canvas o haz doble clic para agregar"><span><ReportComponentIcon type={type}/></span>{componentLabels[type]??type.replaceAll('_',' ').toLowerCase()}</button>}
function CanvasDrop({children}:{children:React.ReactNode}){const{setNodeRef,isOver}=useDroppable({id:'page-canvas'});return <div ref={setNodeRef} className={`${styles.canvas}${isOver?` ${styles.canvasOver}`:''}`}>{children}</div>}
function PageThumb({page,index,active,onClick}:{page:ReportPage;index:number;active:boolean;onClick:()=>void}){const{attributes,listeners,setNodeRef,transform,transition}=useSortable({id:`page:${page.pageId}`});return <button ref={setNodeRef} style={{transform:CSS.Transform.toString(transform),transition}} {...attributes}{...listeners} className={active?styles.activeThumb:''} onClick={onClick}><span>{String(index+1).padStart(2,'0')}</span><i><b>{page.sectionCode.slice(0,3)}</b></i></button>}

function Inspector({tab,block,inheritedText,options,bindings,versionId,onChange}:{tab:string;block:ReportBlock;inheritedText?:string;options:BindingOption[];bindings:JsonObject[];versionId:string;onChange:(patch:Partial<ReportBlock>)=>void}){
  const content=(block.content??{}) as JsonObject;
  const blockStyle=(block.style??{}) as JsonObject;
  const settings=(block.settings??{}) as JsonObject;
  if(tab==='CONTENT')return <div className={styles.inspectorForm}>
    <div className={styles.selectedComponent}><span><ReportComponentIcon type={block.type}/></span><div><b>{componentLabels[block.type]??block.type}</b><small>Bloque seleccionado</small></div></div>
    <ContentInspector block={block} content={content} inheritedText={inheritedText} versionId={versionId} onChange={(next)=>onChange({content:next})}/>
    <label>Preset visual<input value={block.preset??''} placeholder="Predeterminado" onChange={e=>onChange({preset:e.target.value})}/></label>
    <p>Los cambios se muestran inmediatamente en el canvas y se publican al guardar una revisión.</p>
  </div>;
  if(tab==='DATA')return <div className={styles.inspectorForm}><label>Conjunto de datos<select value={block.bindingPreset??''} onChange={e=>onChange({bindingPreset:e.target.value})}><option value="">Datos de ejemplo</option>{bindings.map(item=><option key={String(item.code)} value={String(item.code)}>{String(item.code)} · {String(item.status)}</option>)}</select></label><div className={styles.variableReference}><b>Campos dinámicos</b>{DYNAMIC_FIELDS.map(([value,label])=><code key={value}>{label}<span>{value}</span></code>)}</div><div className={styles.dataHint}><b>{options.length} métricas disponibles</b><span>Los bindings se configuran por nombre y código técnico para evitar fórmulas implícitas.</span></div></div>;
  if(tab==='STYLE')return <div className={styles.inspectorForm}><div className={styles.colorGrid}><label>Texto<input type="color" value={String(blockStyle.color??(block.type==='COVER_BLOCK'?'#ffffff':'#302b78'))} onChange={e=>onChange({style:{...blockStyle,color:e.target.value}})}/></label><label>Fondo<input type="color" value={String(blockStyle.backgroundColor??(block.type==='COVER_BLOCK'?'#080b12':'#ffffff'))} onChange={e=>onChange({style:{...blockStyle,backgroundColor:e.target.value}})}/></label></div>{block.type==='COVER_BLOCK'&&<><div className={styles.colorGrid}><label>Acento<input type="color" value={String(blockStyle.accentColor??'#00c2e8')} onChange={e=>onChange({style:{...blockStyle,accentColor:e.target.value}})}/></label><label>Distintivo<input type="color" value={String(blockStyle.badgeColor??'#d6a94f')} onChange={e=>onChange({style:{...blockStyle,badgeColor:e.target.value}})}/></label></div><label>Tamaño del título<input type="number" min="28" max="88" value={Number(blockStyle.titleFontSize??56)} onChange={e=>onChange({style:{...blockStyle,titleFontSize:Number(e.target.value)}})}/></label><label>Margen horizontal<input type="number" min="24" max="180" value={Number(blockStyle.horizontalPadding??72)} onChange={e=>onChange({style:{...blockStyle,horizontalPadding:Number(e.target.value)}})}/></label><label>Posición del participante<input type="number" min="70" max="360" value={Number(blockStyle.subjectBottom??145)} onChange={e=>onChange({style:{...blockStyle,subjectBottom:Number(e.target.value)}})}/></label></>}<label>Alineación<select value={String(blockStyle.textAlign??'left')} onChange={e=>onChange({style:{...blockStyle,textAlign:e.target.value}})}><option value="left">Izquierda</option><option value="center">Centro</option><option value="right">Derecha</option></select></label>{block.type!=='COVER_BLOCK'&&<label>Tamaño de texto<input type="number" min="8" max="72" value={Number(blockStyle.fontSize??14)} onChange={e=>onChange({style:{...blockStyle,fontSize:Number(e.target.value)}})}/></label>}<button type="button" className={styles.resetStyle} onClick={()=>onChange({style:{}})}>Restablecer estilo</button></div>;
  if(tab==='LAYOUT')return <div className={styles.inspectorForm}><div className={styles.formGrid}>{['x','y','width','height'].map(key=><label key={key}>{key.toUpperCase()}<input type="number" value={Number(block.layout?.[key as keyof typeof block.layout]??0)} onChange={e=>onChange({layout:{...block.layout,[key]:Number(e.target.value)}})}/></label>)}</div><label><input type="checkbox" checked={Boolean(block.keepTogether)} onChange={e=>onChange({keepTogether:e.target.checked})}/> Mantener unido al imprimir</label></div>;
  return <div className={styles.inspectorForm}><label className={styles.switchRow}><input type="checkbox" checked={!Boolean(settings.hidden)} onChange={e=>onChange({settings:{...settings,hidden:!e.target.checked}})}/><span>Mostrar este bloque</span></label><label>Regla de visibilidad<select value={String(settings.visibility??'ALWAYS')} onChange={e=>onChange({settings:{...settings,visibility:e.target.value}})}><option value="ALWAYS">Siempre</option><option value="HAS_DATA">Solo cuando tenga datos</option></select></label><p>La visibilidad se guarda como configuración declarativa segura.</p></div>;
}

function ContentInspector({block,content,inheritedText,versionId,onChange}:{block:ReportBlock;content:JsonObject;inheritedText?:string;versionId:string;onChange:(content:JsonObject)=>void}) {
  const set=(key:string,value:unknown)=>onChange({...content,[key]:value});
  const field=(key:string,label:string,fallback='',multiline=false,dynamic=false)=><TextContentField key={key} label={label} value={String(content[key]??fallback)} multiline={multiline} dynamic={dynamic} onChange={value=>set(key,value)}/>;
  if(block.type==='RICH_TEXT')return <><label>Contenido</label><RichTextEditor doc={content.richText as JSONContent|undefined} fallbackText={String(content.text??inheritedText??block.sourceText??'')} variables={DYNAMIC_FIELDS} onChange={({doc,text})=>onChange({...content,richText:doc,text})}/></>;
  if(block.type==='HEADING')return field('text','Título',String(block.sourceText??''),false,true);
  if(block.type==='COVER_BLOCK')return <div className={styles.coverFields}>{field('kicker','Antetítulo','DIAGNÓSTICO DE',false,true)}{field('title','Título principal','Perfil\nPsicofinanciero',true,true)}{field('badge','Distintivo','DPO-PPF©',false,true)}{field('subject','Participante','{{person.fullName}}',false,true)}{field('date','Fecha','{{assessment.completedAt|monthYear}}',false,true)}{field('legal','Texto legal','Todos los derechos reservados. Este documento está protegido por derechos de autor.',true,true)}</div>;
  if(block.type==='IMAGE')return <ImageContentInspector content={content} versionId={versionId} onChange={onChange}/>;
  if(block.type==='QUADRANT_RESULT_TABLE')return <>{field('eyebrow','Etiqueta','Tu cuadrante actual')}{field('result','Resultado','Realización',false,true)}{field('description','Descripción','Equilibrio entre satisfacción y situación financiera.',true,true)}</>;
  if(block.type==='TABLE_OF_CONTENTS')return <>{field('title','Título','Contenido')}{field('description','Descripción','Índice generado automáticamente desde las secciones de la plantilla.',true)}</>;
  if(block.type==='QUADRANT_CHART')return <>{field('title','Título','Cuadrantes')}{field('labels','Etiquetas (separadas por |)','Despreocupación|Realización|Frustración|Mezquindad')}{field('axisLabel','Etiqueta del eje','Situación financiera')}</>;
  if(block.type==='POTENTIAL_ABILITY_MATRIX')return <>{field('title','Título','Potencial y habilidad')}{field('labels','Etiquetas (separadas por |)','Habilidad baja|Habilidad alta|Potencial alto|Potencial no explotado|Fortaleza manifiesta|Potencial bajo|Capacidad por desarrollar|Habilidad aprendida',true)}</>;
  if(block.type==='DECILE_SCALE_TABLE')return <>{field('title','Título','Resultados por decil')}{field('scaleLabels','Rangos (separados por |)','POR DESARROLLAR|MEDIO|ALTO|GRAN POTENCIAL')}</>;
  if(block.type==='SUMMARY_MATRIX')return field('title','Título',String(block.sourceText??'Resumen de resultados'),false,true);
  if(block.type==='HEADER_FOOTER')return <>{field('headerText','Texto de encabezado','CREVANTIA',false,true)}{field('footerText','Texto de pie','{{assessment.name}}',false,true)}</>;
  return field('title','Título del bloque',componentLabels[block.type]??block.type,false,true);
}

interface UploadedReportAsset { id:string; name:string; mimeType:string; byteSize:number; url:string }

function HeaderLogoInput({versionId,src,alt,onChange}:{versionId:string;src:string;alt:string;onChange:(src:string,alt:string)=>void}) {
  const [uploading,setUploading]=useState(false);
  const [error,setError]=useState('');
  async function upload(file:File|undefined) {
    if(!file)return;
    if(file.size>5*1024*1024){setError('El logo supera el límite de 5 MB.');return;}
    setUploading(true);setError('');
    try{
      const formData=new FormData();formData.append('file',file);
      const asset=await apiUpload<UploadedReportAsset>(`/admin/report-studio/versions/${versionId}/assets`,formData);
      onChange(asset.url,alt||asset.name);
    }catch(reason){setError(reason instanceof Error?reason.message:'No fue posible adjuntar el logo.');}
    finally{setUploading(false);}
  }
  return <div className={`${styles.contentField} ${styles.headerLogoInput}`}>
    {src&&<div className={styles.headerLogoPreview}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt}/><span>Vista previa a tamaño del encabezado</span>
    </div>}
    <div className={styles.imageActions}><label className={styles.uploadButton}>{uploading?'Subiendo…':src?'Reemplazar logo':'Adjuntar logo'}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={event=>{void upload(event.target.files?.[0]);event.target.value='';}}/></label>{src&&<button type="button" onClick={()=>onChange('',alt)}>Quitar</button>}</div>
    <small>PNG, JPG o WebP · máximo 5 MB.</small>
    {error&&<p className={styles.uploadError}>{error}</p>}
    <label>URL del logo<input value={src} placeholder="https://…" onChange={event=>onChange(event.target.value,alt)}/></label>
    <label>Texto alternativo<input value={alt} onChange={event=>onChange(src,event.target.value)}/></label>
  </div>;
}

function ImageContentInspector({content,versionId,onChange}:{content:JsonObject;versionId:string;onChange:(content:JsonObject)=>void}) {
  const [uploading,setUploading]=useState(false);
  const [error,setError]=useState('');
  const src=String(content.src??'');
  const set=(key:string,value:unknown)=>onChange({...content,[key]:value});
  async function upload(file:File|undefined) {
    if(!file)return;
    if(file.size>5*1024*1024){setError('La imagen supera el límite de 5 MB.');return;}
    setUploading(true);setError('');
    try{
      const formData=new FormData();formData.append('file',file);
      const asset=await apiUpload<UploadedReportAsset>(`/admin/report-studio/versions/${versionId}/assets`,formData);
      onChange({...content,assetId:asset.id,assetName:asset.name,src:asset.url,alt:String(content.alt??asset.name)});
    }catch(reason){setError(reason instanceof Error?reason.message:'No fue posible adjuntar la imagen.');}
    finally{setUploading(false);}
  }
  return <div className={styles.imageInspector}>
    {src?<div className={styles.imagePreview}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Vista previa del archivo seleccionado"/>
      <span>{String(content.assetName??'Imagen del reporte')}</span>
    </div>:<div className={styles.imageEmpty}>Aún no hay una imagen seleccionada.</div>}
    <div className={styles.imageActions}><label className={styles.uploadButton}>{uploading?'Subiendo…':src?'Reemplazar archivo':'Adjuntar imagen'}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={event=>{const file=event.target.files?.[0];void upload(file);event.target.value='';}}/></label>{src&&<button type="button" onClick={()=>onChange({...content,assetId:undefined,assetName:undefined,src:''})}>Quitar</button>}</div>
    <small>PNG, JPG o WebP. Tamaño máximo: 5 MB.</small>
    {error&&<p className={styles.uploadError}>{error}</p>}
    <div className={styles.imageDivider}><span>o usa una URL externa</span></div>
    <label>URL de la imagen<input value={src} placeholder="https://…" onChange={event=>onChange({...content,assetId:undefined,assetName:undefined,src:event.target.value})}/></label>
    <label>Pie de imagen<input value={String(content.title??'')} onChange={event=>set('title',event.target.value)}/></label>
    <label>Texto alternativo<input value={String(content.alt??'Imagen del reporte')} onChange={event=>set('alt',event.target.value)}/></label>
    <label>Ajuste<select value={String(content.fit??'contain')} onChange={event=>set('fit',event.target.value)}><option value="contain">Mostrar completa</option><option value="cover">Cubrir el espacio</option><option value="fill">Estirar</option></select></label>
    <label>Posición<select value={String(content.position??'center')} onChange={event=>set('position',event.target.value)}><option value="center">Centro</option><option value="top">Arriba</option><option value="bottom">Abajo</option><option value="left">Izquierda</option><option value="right">Derecha</option></select></label>
    <label>Altura máxima (px)<input type="number" min="80" max="900" value={Number(content.maxHeight??520)} onChange={event=>set('maxHeight',Number(event.target.value))}/></label>
  </div>;
}

function TextContentField({label,value,onChange,multiline,dynamic,variables=DYNAMIC_FIELDS}:{label:string;value:string;onChange:(value:string)=>void;multiline?:boolean;dynamic?:boolean;variables?:ReadonlyArray<readonly [string,string]>}) {
  return <div className={styles.contentField}><label>{label}{multiline?<textarea rows={4} value={value} onChange={event=>onChange(event.target.value)}/>:<input value={value} onChange={event=>onChange(event.target.value)}/>}</label>{dynamic&&<VariablePicker variables={variables} onInsert={token=>onChange(`${value}${value?' ':''}${token}`)}/>}</div>;
}

function VariablePicker({onInsert,variables=DYNAMIC_FIELDS}:{onInsert:(value:string)=>void;variables?:ReadonlyArray<readonly [string,string]>}) {
  return <select className={styles.variablePicker} value="" onChange={event=>{if(event.target.value)onInsert(event.target.value);}}><option value="">+ Insertar variable…</option>{variables.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>;
}

function dropPreviewSize(type:string) {
  if(type==='RADAR_CHART'||type==='MULTI_RADAR_CHART'||type==='QUADRANT_CHART')return {width:520,height:300};
  if(type==='DECILE_SCALE_TABLE'||type==='SUMMARY_MATRIX'||type==='POTENTIAL_ABILITY_MATRIX')return {width:600,height:210};
  if(type==='IMAGE'||type==='STATIC_EXAMPLE_CHART')return {width:480,height:220};
  if(type==='RICH_TEXT')return {width:620,height:130};
  if(type==='COVER_BLOCK')return {width:620,height:500};
  return {width:500,height:72};
}

function newBlock(id:string,type:string,flow:boolean):ReportBlock {
  const base:ReportBlock={id,type,flow,keepTogether:true,content:{title:componentLabels[type]??type},style:{}};
  if(type==='HEADING')base.content={text:'Nuevo título'};
  if(type==='RICH_TEXT')base.content={text:'Escribe aquí el contenido del reporte.'};
  if(type==='IMAGE')base.content={title:'Imagen',src:'',alt:'Imagen del reporte'};
  if(type==='COVER_BLOCK')base.content={kicker:'DIAGNÓSTICO DE',title:'Perfil\nPsicofinanciero',badge:'DPO-PPF©',subject:'{{person.fullName}}',date:'{{assessment.completedAt|monthYear}}',legal:'Todos los derechos reservados.'};
  if(type==='RADAR_CHART'||type==='MULTI_RADAR_CHART')base.content={title:type==='RADAR_CHART'?'Gráfica radar':'Comparativo de resultados'};
  return base;
}

function PendingBindings({presetCode,bindings,options,onChange}:{presetCode:string;bindings:JsonObject[];options:BindingOption[];onChange:(items:JsonObject[])=>void}){
  const relevant=new Set<string>();
  const visit=(code:string)=>{if(relevant.has(code))return;relevant.add(code);const preset=bindings.find(item=>item.code===code);if(Array.isArray(preset?.includes))(preset.includes as string[]).forEach(visit);};
  visit(presetCode);
  const rows=bindings.filter(preset=>relevant.has(String(preset.code))).flatMap((preset)=>{
    const direct=String(preset.status).includes('CONFIGURABLE')&&Array.isArray(preset.displayLabels)?(preset.displayLabels as string[]).map(label=>({preset,key:label,label})):[];
    const groups=Array.isArray(preset.groups)?(preset.groups as JsonObject[]).filter(group=>String(group.status).includes('CONFIGURABLE')).flatMap(group=>(Array.isArray(group.labels)?group.labels as string[]:[]).map(label=>({preset,key:`${String(group.code)}:${label}`,label:`${String(group.code)} · ${label}`}))):[];
    return [...direct,...groups];
  });
  if(!rows.length)return null;
  return <section className={styles.pendingPanel}><h3>Datos opcionales por vincular <span>{rows.length}</span></h3><p>Solo configura los resultados que quieras mostrar en este bloque. Los campos sin vincular se omitirán y no impiden publicar.</p>{rows.map(({preset,key,label})=>{
    const configured=preset.configuredMappings&&typeof preset.configuredMappings==='object'&&!Array.isArray(preset.configuredMappings)?preset.configuredMappings as Record<string,{sourceType?:string;sourceCode?:string}>:{};
    const current=configured[key];
    return <label key={`${String(preset.code)}:${key}`}>{label}<select value={current?`${current.sourceType}|${current.sourceCode}`:''} onChange={event=>{const next=structuredClone(bindings);const target=next.find(entry=>entry.code===preset.code)!;const existing=target.configuredMappings&&typeof target.configuredMappings==='object'&&!Array.isArray(target.configuredMappings)?target.configuredMappings as JsonObject:{};if(!event.target.value){delete existing[key];target.configuredMappings={...existing};}else{const[sourceType,sourceCode]=event.target.value.split('|');target.configuredMappings={...existing,[key]:{sourceType,sourceCode}};}onChange(next);}}><option value="">No mostrar</option>{options.map(option=><option value={`${option.sourceType}|${option.sourceCode}`} key={`${option.sourceType}.${option.sourceCode}`}>{option.label} · {option.sourceCode}</option>)}</select></label>;
  })}</section>
}
