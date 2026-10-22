'use client';

import dynamic from 'next/dynamic';

const Experience = dynamic(() => import('@/scene/Experience'), { ssr: false });

export default function ClientRoot() {
  return <Experience />;
}
