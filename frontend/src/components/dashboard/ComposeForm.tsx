'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Bold,
  CalendarDays,
  Clock3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Paperclip,
  Redo2,
  Send,
  Strikethrough,
  Underline,
  Undo2,
  UploadCloud,
} from 'lucide-react';
import { emailApi, senderApi, SenderRecord } from '@/lib/api';

function parseRecipientList(rawValue: string) {
  const entries = rawValue.replace(/\r/g, '').split(/[\n,;]+/).map((value) => value.trim().replace(/^"|"$/g, '')).filter(Boolean);
  const unique = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const item of entries) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item)) invalid.push(item);
    else if (!unique.has(item.toLowerCase())) {
      unique.add(item.toLowerCase());
      valid.push(item.toLowerCase());
    }
  }
  return { valid, invalid };
}

function tomorrowAt(hour: number) {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString().slice(0, 16);
}

const toolbarItems = [
  { label: 'Undo', command: 'undo', icon: Undo2 }, { label: 'Redo', command: 'redo', icon: Redo2 },
  { label: 'Bold', command: 'bold', icon: Bold }, { label: 'Italic', command: 'italic', icon: Italic },
  { label: 'Underline', command: 'underline', icon: Underline }, { label: 'Align left', command: 'justifyLeft', icon: AlignLeft },
  { label: 'Align center', command: 'justifyCenter', icon: AlignCenter }, { label: 'Align right', command: 'justifyRight', icon: AlignRight },
  { label: 'Numbered list', command: 'insertOrderedList', icon: ListOrdered }, { label: 'Bulleted list', command: 'insertUnorderedList', icon: List },
  { label: 'Link', command: 'createLink', icon: LinkIcon }, { label: 'Strikethrough', command: 'strikeThrough', icon: Strikethrough },
];

export function ComposeForm() {
  const router = useRouter();
  const { data: session } = useSession();
  const [recipientTokens, setRecipientTokens] = useState<string[]>([]);
  const [recipientDraft, setRecipientDraft] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [startTime, setStartTime] = useState('');
  const [delayBetweenEmails, setDelayBetweenEmails] = useState(0);
  const [hourlyLimit, setHourlyLimit] = useState(0);
  const [showSchedule, setShowSchedule] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [fileInputKey, setFileInputKey] = useState(0);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [senders, setSenders] = useState<SenderRecord[]>([]);
  const [selectedSenderId, setSelectedSenderId] = useState('');
  const [uploadSummary, setUploadSummary] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const parsedRecipients = useMemo(() => ({ valid: recipientTokens, invalid: [] as string[] }), [recipientTokens]);
  const senderEmail = session?.user?.email || '';
  useEffect(() => {
    if (!session) return;
    void senderApi.list(session).then((available) => {
      setSenders(available);
      setSelectedSenderId(available.find((sender) => sender.isDefault)?.id || available[0]?.id || '');
    });
  }, [session]);

  const runEditorCommand = (command: string) => {
    editorRef.current?.focus();
    if (command === 'createLink') {
      const url = window.prompt('Enter a URL');
      if (!url) return;
      document.execCommand(command, false, url);
    } else {
      document.execCommand(command);
    }
    setBody(editorRef.current?.innerHTML || '');
  };

  const handleRecipientListUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const parsed = parseRecipientList(await file.text());
    setRecipientTokens((current) => {
      const merged = Array.from(new Set([...current, ...parsed.valid]));
      setUploadSummary(`Detected recipients: ${parsed.valid.length} valid${parsed.invalid.length ? `, ${parsed.invalid.length} invalid` : ''}. Total selected: ${merged.length}.`);
      return merged;
    });
    setFileInputKey((value) => value + 1);
  };

  const addRecipients = (value: string) => {
    const parsed = parseRecipientList(value);
    if (parsed.valid.length) {
      setRecipientTokens((current) => Array.from(new Set([...current, ...parsed.valid])));
    }
    setRecipientDraft(parsed.invalid.join(', '));
  };

  const handleRecipientDraftChange = (value: string) => {
    if (!/[\n,;]+/.test(value)) {
      setRecipientDraft(value);
      return;
    }
    const parts = value.split(/[\n,;]+/);
    const remainder = parts.pop() || '';
    addRecipients(parts.join(', '));
    setRecipientDraft(remainder);
  };

  const handleAttachmentUpload = (event: ChangeEvent<HTMLInputElement>) => {
    setAttachments(Array.from(event.target.files || []));
  };

  const handleSubmit = async () => {
    setMessage('');
    const recipients = recipientTokens;
    if (!session?.user?.email) return setMessage('You need to be signed in before scheduling emails.');
    if (!recipients.length) return setMessage('Please add at least one valid recipient email.');
    if (!subject.trim()) return setMessage('Please enter a subject.');
    const editorText = editorRef.current?.innerText.trim() || '';
    if (!editorText) return setMessage('Please enter email content.');
    if (!startTime) return setMessage('Choose a time from Send Later first.');
    setIsSubmitting(true);
    try {
      const selectedSender = senders.find((sender) => sender.id === selectedSenderId);
      await emailApi.schedule({ subject: subject.trim(), body, recipients, startTime: new Date(startTime).toISOString(), delayBetweenEmails: Math.max(0, Number(delayBetweenEmails)), hourlyLimit: Math.max(1, Number(hourlyLimit) || 1), senderEmail: selectedSender?.email || senderEmail, senderId: selectedSenderId || undefined, attachments }, session);
      router.push('/dashboard');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The scheduling request failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="compose-sheet relative min-h-[calc(100vh-2rem)] bg-white text-[#172033]">
      <header className="flex h-[52px] items-center justify-between border-b border-[#edf0f3] px-4 sm:px-8">
        <button type="button" onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-[20px] font-medium text-[#172033]">
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.7} /> Compose New Email
        </button>
        <div className="flex items-center gap-3">
          <label className="cursor-pointer text-[#9aa4b2]" title="Attach files to email">
            <Paperclip className="h-[17px] w-[17px]" strokeWidth={1.6} />
            <input type="file" multiple onChange={handleAttachmentUpload} className="hidden" />
          </label>
          <button type="button" onClick={() => setShowSchedule((value) => !value)} className="text-[#9aa4b2]" aria-label="Send later"><Clock3 className="h-[17px] w-[17px]" strokeWidth={1.5} /></button>
          <button type="button" onClick={handleSubmit} disabled={isSubmitting} className="h-[30px] min-w-[76px] rounded-full border border-[#18b865] px-4 text-[12px] font-medium text-[#15994f] disabled:opacity-50">{isSubmitting ? '...' : 'Send'}</button>
        </div>
      </header>

      <div className="compose-fields">
        <div className="compose-row"><label htmlFor="sender" className="compose-label">From</label><select id="sender" value={selectedSenderId} onChange={(event) => setSelectedSenderId(event.target.value)} className="compose-select">{senders.length ? senders.map((sender) => <option value={sender.id} key={sender.id}>{sender.name ? `${sender.name} (${sender.email})` : sender.email}</option>) : <option value="">{senderEmail || 'Loading sender...'}</option>}</select></div>
        <div className="compose-row compose-recipient-row"><label htmlFor="recipients" className="compose-label">To</label><div className="compose-recipient-list">{recipientTokens.slice(0, 3).map((recipient) => <span className="recipient-chip" key={recipient}>{recipient}</span>)}{recipientTokens.length > 3 ? <span className="recipient-chip recipient-summary">+{recipientTokens.length - 3}</span> : null}<input id="recipients" value={recipientDraft} onChange={(event) => handleRecipientDraftChange(event.target.value)} onKeyDown={(event) => { if ((event.key === 'Enter' || event.key === 'Tab') && recipientDraft.trim()) { event.preventDefault(); addRecipients(recipientDraft); } }} onBlur={() => { if (recipientDraft.trim()) addRecipients(recipientDraft); }} placeholder={recipientTokens.length ? '' : 'recipient@example.com'} className="compose-recipient-input" /></div><label className="compose-upload-list"><UploadCloud className="h-4 w-4" strokeWidth={1.7} /> Upload List<input key={fileInputKey} type="file" accept=".csv,.txt" onChange={handleRecipientListUpload} className="hidden" /></label></div>
        <div className="compose-row"><label htmlFor="subject" className="compose-label">Subject</label><input id="subject" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" className="compose-input" /></div>
        <div className="compose-row compose-limits">
          <label htmlFor="delay" className="compose-label">Delay between 2 emails</label><input id="delay" type="number" min={0} value={delayBetweenEmails || ''} onChange={(event) => setDelayBetweenEmails(Number(event.target.value) || 0)} placeholder="00" className="compose-number" />
          <label htmlFor="hourly" className="compose-label compose-hourly-label">Hourly Limit</label><input id="hourly" type="number" min={1} value={hourlyLimit || ''} onChange={(event) => setHourlyLimit(Number(event.target.value) || 0)} placeholder="00" className="compose-number" />
        </div>
      </div>

      {uploadSummary ? <p className="compose-upload-summary">{uploadSummary}</p> : null}

      {attachments.length ? <div className="compose-attachments">{attachments.map((file, index) => <span className="compose-attachment-chip" key={`${file.name}-${file.lastModified}`}>{file.name} ({Math.ceil(file.size / 1024)} KB)<button type="button" aria-label={`Remove ${file.name}`} onClick={() => setAttachments((current) => current.filter((_item, itemIndex) => itemIndex !== index))}>×</button></span>)}</div> : null}

      <div className="compose-editor">
        <div ref={editorRef} contentEditable role="textbox" aria-label="Email body" data-placeholder="Type Your Reply..." onInput={(event) => setBody(event.currentTarget.innerHTML)} className="compose-body" suppressContentEditableWarning />
        <div className="compose-toolbar">{toolbarItems.map(({ label, command, icon: Icon }) => <button type="button" key={label} aria-label={label} title={label} className="compose-tool" onMouseDown={(event) => event.preventDefault()} onClick={() => runEditorCommand(command)}><Icon className="h-[15px] w-[15px]" strokeWidth={1.4} /></button>)}</div>
      </div>

      {message ? <p className="px-4 pt-3 text-center text-xs text-rose-600 sm:px-[136px]">{message}</p> : null}

      {showSchedule ? <aside className="send-later-panel absolute right-3 top-[52px] z-10 w-[218px] rounded-md border border-[#e5e7eb] bg-white p-3 shadow-[0_2px_7px_rgba(0,0,0,0.18)]">
        <h2 className="mb-4 text-[12px] font-medium text-[#172033]">Send Later</h2>
        <label htmlFor="startTime" className="mb-1 block text-[10px] text-[#8c96a3]">Pick date &amp; time</label>
        <div className="relative border-b border-[#e5e7eb] pb-2"><input id="startTime" type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="w-full bg-transparent text-[10px] text-[#4e5a6b] outline-none" /><CalendarDays className="pointer-events-none absolute right-0 top-0 h-3 w-3 text-[#9aa4b2]" /></div>
        <div className="space-y-3 py-3 text-[10px] text-[#536074]"><button type="button" onClick={() => setStartTime(tomorrowAt(9))} className="block">Tomorrow</button><button type="button" onClick={() => setStartTime(tomorrowAt(10))} className="block">Tomorrow, 10:00 AM</button><button type="button" onClick={() => setStartTime(tomorrowAt(11))} className="block">Tomorrow, 11:00 AM</button><button type="button" onClick={() => setStartTime(tomorrowAt(15))} className="block">Tomorrow, 3:00 PM</button></div>
        <div className="flex items-center justify-end gap-5 pt-4 text-[10px]"><button type="button" onClick={() => setShowSchedule(false)} className="text-[#172033]">Cancel</button><button type="button" onClick={() => setShowSchedule(false)} className="rounded-full border border-[#18b865] px-4 py-1 text-[#15994f]">Done</button></div>
      </aside> : null}
    </section>
  );
}