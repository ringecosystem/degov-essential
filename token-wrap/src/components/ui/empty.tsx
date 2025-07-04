import Image from 'next/image';

import { cn } from '@/lib/utils';

import type { ReactNode } from 'react';
export function Empty({
  className,
  label,
  style
}: {
  className?: string;
  label?: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-[10px]', className)}
      style={style}
    >
      <Image src="/empty.svg" alt="empty" className="size-[60px]" width={60} height={60} />
      <div className="text-foreground max-w-[320px] text-center text-[12px] font-normal text-balance">
        {label || 'No data'}
      </div>
    </div>
  );
}
