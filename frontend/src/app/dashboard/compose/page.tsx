'use client';

import { ComposeForm } from '@/components/dashboard/ComposeForm';

export default function ComposePage() {
  return (
    <main className="min-h-screen bg-[#f3f3f3] p-3 sm:p-4">
      <div className="min-h-[calc(100vh-2rem)] overflow-hidden rounded-[18px] border border-[#d9d9d9] bg-white">
        <ComposeForm />
      </div>
    </main>
  );
}
