import { PortalShell } from '@/components/Portal';
import { ProjectsPanel } from '@/components/UserPanel';

export const dynamic = 'force-dynamic';

export default function ProjectsPage() {
  return <PortalShell><ProjectsPanel /></PortalShell>;
}
