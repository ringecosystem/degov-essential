'use client';

import { TokenSwap } from '@/components/token-swap';

export default function Home() {
  return (
    <div className="container flex min-h-[calc(100vh-200px)] items-center justify-center">
      <TokenSwap />
    </div>
  );
}
