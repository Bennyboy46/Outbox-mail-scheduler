'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { EmailRecord } from '@/lib/api';
import { StatusBadge } from '@/components/dashboard/StatusBadge';

function formatDate(value: string | null | undefined) {
  if (!value) return '—';

  const date = new Date(value);
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function EmailTable({
  emails,
  emptyMessage,
}: {
  emails: EmailRecord[];
  emptyMessage: string;
}) {
  const [starred, setStarred] = useState<Record<string, boolean>>({});
  const rows = useMemo(() => emails, [emails]);

  if (!rows.length) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-2 p-2">
      {rows.map((email) => {
        const isStarred = !!starred[email.id];
        const recipient = email.to || 'Unknown recipient';
        const timeLabel = email.status === 'SENT' || email.status === 'FAILED'
          ? formatDate(email.sentAt)
          : formatDate(email.scheduledAt);

        return (
          <Link
            href={`/dashboard/email/${email.id}`}
            key={email.id}
            className="group flex min-w-0 items-center gap-3 overflow-hidden rounded-[12px] border border-transparent bg-transparent px-2 py-3 transition hover:bg-white hover:shadow-sm"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden whitespace-nowrap text-xs">
              <span className="max-w-[220px] shrink-0 truncate font-medium text-[#111827]">To: {recipient}</span>
              <StatusBadge status={email.status} />
              <span className="shrink-0 rounded-full bg-[#fff1e8] px-1.5 py-0.5 text-[11px] font-medium text-[#f28c28]">{timeLabel}</span>
              <span className="max-w-[260px] shrink-0 truncate text-slate-700">{email.subject || '(No subject)'}</span>
              <span className="min-w-0 flex-1 truncate text-slate-400">- {email.body.replace(/<[^>]*>/g, ' ')}</span>
            </div>
            <div className="flex shrink-0 items-center text-slate-400">
              <button
                type="button"
                aria-label={isStarred ? 'Unstar email' : 'Star email'}
                onClick={(event) => {
                  event.preventDefault();
                  setStarred((current) => ({ ...current, [email.id]: !current[email.id] }));
                }}
                className={`rounded-full p-1 transition ${
                  isStarred ? 'bg-amber-100 text-amber-500' : 'hover:bg-slate-100 hover:text-slate-600'
                }`}
              >
                <Star className={`h-4 w-4 ${isStarred ? 'fill-current' : ''}`} />
              </button>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
