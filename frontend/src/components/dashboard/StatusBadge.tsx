'use client';

import { AlertTriangle, CheckCircle2, Clock3, LoaderCircle } from 'lucide-react';
import { EmailRecord } from '@/lib/api';

const badgeStyles: Record<string, string> = {
  PENDING: 'border border-orange-200 bg-orange-50 text-orange-700',
  PROCESSING: 'border border-sky-200 bg-sky-50 text-sky-700',
  SENT: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  FAILED: 'border border-rose-200 bg-rose-50 text-rose-700',
};

const badgeLabels: Record<string, string> = {
  PENDING: 'Scheduled',
  PROCESSING: 'Sending',
  SENT: 'Sent',
  FAILED: 'Failed',
};

const badgeIcons: Record<string, JSX.Element> = {
  PENDING: <Clock3 className="h-3.5 w-3.5" />,
  PROCESSING: <LoaderCircle className="h-3.5 w-3.5 animate-spin" />,
  SENT: <CheckCircle2 className="h-3.5 w-3.5" />,
  FAILED: <AlertTriangle className="h-3.5 w-3.5" />,
};

export function StatusBadge({ status }: { status: EmailRecord['status'] | string }) {
  const normalized = status ?? 'PENDING';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${badgeStyles[normalized] ?? badgeStyles.PENDING}`}
    >
      {badgeIcons[normalized] ?? badgeIcons.PENDING}
      {badgeLabels[normalized] ?? badgeLabels.PENDING}
    </span>
  );
}
