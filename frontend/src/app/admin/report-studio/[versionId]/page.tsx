import { ReportStudioEditor } from '@/components/report-studio/report-studio-editor';
export default async function ReportStudioVersionPage({params}:{params:Promise<{versionId:string}>}){const{versionId}=await params;return <ReportStudioEditor versionId={versionId}/>}
