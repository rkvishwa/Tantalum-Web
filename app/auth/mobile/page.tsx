import { Suspense } from 'react';
import { MobileAuthPage } from '@/components/DesktopAuth';

export default function MobileAuthRoute() {
  return <Suspense><MobileAuthPage /></Suspense>;
}
