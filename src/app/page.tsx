import { HomePage } from '@/components/HomePage';
import snapshot from '@/data/site-data.json';
import type { SiteData } from '@/lib/sheet/types';

export default function Page() {
  return <HomePage snapshot={snapshot as SiteData} />;
}
