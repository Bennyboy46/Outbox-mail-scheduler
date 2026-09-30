'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { EmailTable } from '@/components/dashboard/EmailTable';
import { EmptyState } from '@/components/dashboard/EmptyState';
import { emailApi, EmailRecord } from '@/lib/api';

export default function ScheduledDashboardPage() {
  const { data: session, status } = useSession();
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [sentEmails, setSentEmails] = useState<EmailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  const loadEmails = useCallback(async () => {
    if (!session) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [scheduled, sent] = await Promise.all([
        query.trim()
          ? emailApi.search({ q: query.trim(), status: 'PENDING' }, session).catch(() => emailApi.getScheduled(session))
          : emailApi.getScheduled(session),
        emailApi.getSent(session),
      ]);

      setEmails(scheduled);
      setSentEmails(sent);
      setError('');
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Unable to load your scheduled emails.';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query, session]);

  useEffect(() => {
    void loadEmails();
  }, [loadEmails]);

  const filteredEmails = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return emails.filter((email) => {
      const matchesStatus = filter === 'All' || email.status === filter;
      const haystack = `${email.to} ${email.subject} ${email.body}`.toLowerCase();
      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
      return matchesStatus && matchesQuery;
    });
  }, [emails, filter, query]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadEmails();
  };

  return (
    <DashboardShell
      title="Scheduled"
      subtitle="Track and manage the campaigns waiting to be sent."
      scheduledCount={emails.length}
      sentCount={sentEmails.length}
      searchValue={query}
      onSearchChange={setQuery}
      filterValue={filter}
      onFilterChange={setFilter}
      onRefresh={handleRefresh}
      refreshing={refreshing}
    >
      {status === 'loading' ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-3xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
          Loading your scheduled emails…
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : loading ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-3xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
          Loading scheduled emails…
        </div>
      ) : filteredEmails.length ? (
        <EmailTable emails={filteredEmails} emptyMessage="No scheduled emails match your filters." />
      ) : (
        <EmptyState
          title="No scheduled emails yet"
          description="Schedule a campaign to start your outreach flow."
        />
      )}
    </DashboardShell>
  );
}
