import { HomePage } from '@/components/HomePage';
import snapshot from '@/data/site-data.json';
import { ALL } from '@/lib/events';
import type { SiteData } from '@/lib/sheet/types';

export default function Page() {
  return <HomePage snapshot={snapshot as SiteData} initialCity={ALL} />;
}
