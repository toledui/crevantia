import type { Metadata } from 'next';
import { ReportStudioDashboard } from '@/components/report-studio/report-studio-dashboard';

export const metadata: Metadata = { title: 'Report Studio' };

export default function ReportStudioPage() {
  return <ReportStudioDashboard />;
}
