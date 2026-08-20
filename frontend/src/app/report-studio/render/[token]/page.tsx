'use client';
import { useEffect,useState } from 'react';
import { ReportRenderer } from '@/components/report-studio/report-renderer';
import type { JsonObject,PreviewData,ReportVersionResponse } from '@/lib/report-studio';
export default function RenderPage({params}:{params:Promise<{token:string}>}){const[payload,setPayload]=useState<{version:ReportVersionResponse;previewData:PreviewData;pageSize?:'LETTER'|'A4'}|null>(null);useEffect(()=>{params.then(({token})=>fetch(`/api/v1/report-studio/render-sessions/${token}`).then(response=>response.json()).then(setPayload));},[params]);if(!payload)return <p>Preparando PDF…</p>;return <><style>{`@page{size:${payload.pageSize==='A4'?'A4':'Letter'};margin:0}`}</style><ReportRenderer layout={payload.version.layoutJson} data={payload.previewData} theme={payload.version.theme?.configJson as JsonObject} bindings={payload.version.bindingConfigJson.bindingPresets??[]} printMode/></>}
