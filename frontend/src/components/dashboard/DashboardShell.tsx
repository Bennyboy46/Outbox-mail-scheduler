'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  ArrowLeft,
  CalendarClock,
  Clock3,
  FileText,
  Filter,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Send,
  SlidersHorizontal,
} from 'lucide-react';
import { ReactNode } from 'react';
import { slackApi } from '@/lib/api';

const navItems = [
  { label: 'Scheduled', href: '/dashboard', icon: Clock3 },
  { label: 'Sent', href: '/dashboard/sent', icon: Send },
];

export function DashboardShell({
  title,
  subtitle,
  children,
  scheduledCount = 0,
  sentCount = 0,
  showToolbar = true,
  showHeader = true,
  searchValue,
  onSearchChange,
  filterValue,
  onFilterChange,
  onRefresh,
  refreshing = false,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  scheduledCount?: number;
  sentCount?: number;
  showToolbar?: boolean;
  showHeader?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const userName = session?.user?.name || 'User';
  const userEmail = session?.user?.email || 'user@example.com';
  const avatar = session?.user?.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}`;
  const connectSlack = async () => {
    try {
      const { url } = await slackApi.connect(session);
      window.location.href = url;
    } catch {
      window.alert('Slack is not configured or could not be connected.');
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f3f3] p-0 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="w-[280px] shrink-0 border-r border-[#d9d9d9] bg-[#f8f8f8] px-4 py-5">
          <div className="mb-6 px-2">
            <div className="brand-mark text-4xl tracking-[-0.07em] text-[#111827]">ONB</div>
          </div>

          <div className="mb-5 flex items-center gap-3 rounded-2xl bg-transparent px-2 py-2">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm">
              {avatar ? <img src={avatar} alt={userName} className="h-full w-full object-cover" /> : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">{userName}</p>
              <p className="truncate text-[11px] text-slate-500">{userEmail}</p>
            </div>
          </div>

          <Link
            href="/dashboard/compose"
            className="mb-6 flex w-full items-center justify-center gap-2 rounded-full border border-[#1dbf5a] bg-[#effdf3] px-3 py-2.5 text-sm font-semibold text-[#1a7d45] transition hover:bg-[#e5f9ed]"
          >
            <Plus className="h-4 w-4" />
            Compose
          </Link>

          <button type="button" onClick={connectSlack} className="mb-6 flex w-full items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:border-[#18b865] hover:text-[#15994f]">
            Connect Slack
          </button>

          <div className="px-2">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Core</p>
            <nav className="space-y-2">
              {navItems.map(({ label, href, icon: Icon }) => {
                const isActive = href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);
                const activeClass = isActive
                  ? 'border border-[#00a854] bg-[#ecfdf5] text-[#00a854] shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50';
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition ${activeClass}`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4" />
                      {label}
                    </span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500 shadow-sm">
                      {label === 'Scheduled' ? scheduledCount : sentCount}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="mt-6 flex items-center justify-center">
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            >
              Logout
            </button>
          </div>
        </aside>

        <main className="flex-1 bg-[#f5f5f5] p-3 md:p-4 xl:p-5">
          <div className="h-full rounded-[18px] border border-[#d9d9d9] bg-[#f5f5f5] p-4">
            {showToolbar ? (
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-[#d9d9d9] pb-3">
                <div className="relative w-full max-w-[520px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchValue ?? ''}
                    onChange={(event) => onSearchChange?.(event.target.value)}
                    className="w-full rounded-full border border-[#d9d9d9] bg-[#f8f8f8] py-2.5 pl-10 pr-10 text-sm text-slate-700 outline-none transition focus:border-[#00a854] focus:bg-white"
                    placeholder="Search"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                    aria-label="Filters"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={onRefresh}
                    disabled={refreshing}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Refresh"
                  >
                    <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            ) : showHeader ? (
              <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-3">
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Link>
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title || 'Compose'}</h1>
                    {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="h-[calc(100%-70px)] min-h-[600px] overflow-hidden rounded-[18px] border border-[#d9d9d9] bg-[#f8f8f8]">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
