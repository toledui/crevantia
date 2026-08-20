'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
export default function OpenReportStudio(){const router=useRouter();useEffect(()=>{apiFetch<Array<{versions:Array<{id:string}>}>>('/admin/report-studio/templates').then(items=>{const id=items[0]?.versions[0]?.id;if(id)router.replace(`/admin/report-studio/${id}`);else router.replace('/admin/report-studio');});},[router]);return <main className="admin-page"><p>Abriendo Report Studio…</p></main>}
