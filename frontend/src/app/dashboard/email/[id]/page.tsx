'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Archive, MoreVertical, Star, Trash2 } from 'lucide-react';
import { emailApi, EmailRecord } from '@/lib/api';
import { StatusBadge } from '@/components/dashboard/StatusBadge';

function formatDate(value: string | null) {
  if (!value) return 'Not sent yet';
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function safeBody(value: string) {
  if (typeof window === 'undefined') return value;
  const documentBody = new DOMParser().parseFromString(value, 'text/html').body;
  documentBody.querySelectorAll('script, style, iframe, object, embed').forEach((node) => node.remove());
  documentBody.querySelectorAll('*').forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      if (attribute.name.toLowerCase().startsWith('on')) element.removeAttribute(attribute.name);
      if (['href', 'src'].includes(attribute.name.toLowerCase()) && attribute.value.trim().toLowerCase().startsWith('javascript:')) {
        element.removeAttribute(attribute.name);
      }
    });
  });
  return documentBody.innerHTML || value.replace(/[&<>]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[character] || character));
}

export default function EmailDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [email, setEmail] = useState<EmailRecord | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session || !params.id) return;
    emailApi.getById(params.id, session).then(setEmail).catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load this email.');
    });
  }, [params.id, session]);

  if (status === 'loading' || (!email && !error)) {
    return <div className="flex min-h-screen items-center justify-center bg-white text-sm text-slate-500">Loading email…</div>;
  }

  if (error || !email) {
    return <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white text-sm text-rose-600"><p>{error || 'Email not found.'}</p><button type="button" onClick={() => router.back()} className="rounded-full border border-slate-200 px-4 py-2 text-slate-700">Go back</button></div>;
  }

  const displayName = email.sender.name || email.sender.email;
  const date = email.status === 'SENT' || email.status === 'FAILED' ? email.sentAt : email.scheduledAt;

  return (
    <main className="min-h-screen bg-white text-[#172033]">
      <header className="flex h-[58px] items-center justify-between border-b border-[#edf0f3] px-5 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={() => router.back()} aria-label="Back" className="text-[#172033]"><ArrowLeft className="h-5 w-5" strokeWidth={1.6} /></button>
          <h1 className="truncate text-[18px] font-medium">{email.subject || '(No subject)'}</h1>
        </div>
        <div className="flex items-center gap-4 text-[#b0b8c3]">
          <button type="button" aria-label="Star email"><Star className="h-4 w-4" /></button>
          <button type="button" aria-label="Archive email"><Archive className="h-4 w-4" /></button>
          <button type="button" aria-label="Delete email"><Trash2 className="h-4 w-4" /></button>
          <button type="button" aria-label="More actions"><MoreVertical className="h-4 w-4" /></button>
        </div>
      </header>

      <article className="mx-auto max-w-[900px] px-6 py-7 sm:px-10">
        <div className="flex items-start justify-between gap-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#18b865] text-sm font-medium text-white">
              {email.sender.avatar ? <img src={email.sender.avatar} alt="" className="h-full w-full object-cover" /> : displayName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{displayName} <span className="font-normal text-slate-400">&lt;{email.sender.email}&gt;</span></p>
              <p className="text-xs text-slate-500">to {email.to}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2 text-xs text-slate-400"><span>{formatDate(date)}</span><StatusBadge status={email.status} /></div>
        </div>

        <div className="email-detail-body mt-8 text-sm leading-7 text-[#273244]" dangerouslySetInnerHTML={{ __html: safeBody(email.body) }} />

        {email.failureReason ? <div className="mt-8 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{email.failureReason}</div> : null}
        {email.status === 'PENDING' ? <p className="mt-8 text-xs text-slate-400">Scheduled to send on {formatDate(email.scheduledAt)}.</p> : null}
      </article>
    </main>
  );
}