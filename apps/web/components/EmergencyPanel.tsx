'use client';

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Image,
  Italic,
  Link,
  MonitorPlay,
  ShieldAlert,
  Underline,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { api } from '../lib/api';
import { EmergencyMessage } from '../lib/types';

function exec(command: string, value?: string) {
  document.execCommand(command, false, value);
}

export function EmergencyPanel({ initial }: { initial: EmergencyMessage }) {
  const [emergency, setEmergency] = useState(initial);
  const [title, setTitle] = useState(initial.title || 'ATENCAO');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const imageUploadRef = useRef<HTMLInputElement>(null);
  const videoUploadRef = useRef<HTMLInputElement>(null);

  const initialHtml =
    initial.bodyHtml ||
    (initial.lines.length > 0
      ? initial.lines.map((line) => `<p>${line}</p>`).join('')
      : '<p><strong>MANUTENCAO PROGRAMADA</strong></p><p>INICIO AS 18:00</p><p>FAVOR DESLIGAR OS EQUIPAMENTOS</p>');

  async function uploadIntoEmergency(file: File | undefined, kind: 'image' | 'video') {
    if (!file) return;
    try {
      setStatus('Enviando arquivo...');
      const uploaded = await api.upload(file);
      editorRef.current?.focus();
      exec(
        'insertHTML',
        kind === 'image'
          ? `<img src="${uploaded.url}" alt="" style="display:block;width:100%;max-height:70vh;object-fit:contain;margin:12px auto;border-radius:12px" />`
          : `<video src="${uploaded.url}" autoplay muted loop playsinline style="display:block;width:100%;max-height:70vh;object-fit:contain;margin:12px auto;border-radius:12px"></video>`,
      );
      setStatus('Arquivo anexado ao alerta.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Falha ao anexar arquivo.');
    }
  }

  async function toggleEmergency() {
    setBusy(true);
    const bodyHtml = editorRef.current?.innerHTML ?? '';
    const text = stripHtml(bodyHtml);
    const next = {
      active: !emergency.active,
      title,
      lines: text.split('\n').map((line) => line.trim()).filter(Boolean),
      bodyHtml,
    };
    try {
      setEmergency(await api.setEmergency(next));
      setStatus(next.active ? 'Alerta disparado para as TVs.' : 'Alerta encerrado.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-red-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-red-50 p-2 text-red-700">
            <ShieldAlert size={22} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Alerta de emergencia</h2>
            <p className="text-sm text-slate-500">
              Envia uma interrupcao imediata via WebSocket para todas as TVs.
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          className={`rounded-md px-4 py-2 text-sm font-semibold text-white ${
            emergency.active ? 'bg-slate-700' : 'bg-red-600 hover:bg-red-700'
          }`}
          onClick={toggleEmergency}
        >
          {emergency.active ? 'Encerrar alerta' : 'Disparar alerta'}
        </button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[260px_1fr]">
        <label className="text-sm font-medium text-slate-700">
          Titulo do alerta
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <div className="rounded-md border border-slate-200">
          <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 p-2">
            <ToolbarButton icon={Bold} label="Negrito" onClick={() => exec('bold')} />
            <ToolbarButton icon={Italic} label="Italico" onClick={() => exec('italic')} />
            <ToolbarButton icon={Underline} label="Sublinhado" onClick={() => exec('underline')} />
            <ToolbarButton icon={AlignLeft} label="Esquerda" onClick={() => exec('justifyLeft')} />
            <ToolbarButton icon={AlignCenter} label="Centro" onClick={() => exec('justifyCenter')} />
            <ToolbarButton icon={AlignRight} label="Direita" onClick={() => exec('justifyRight')} />
            <input type="color" className="h-9 w-10 rounded-md border border-slate-300" onChange={(event) => exec('foreColor', event.target.value)} />
            <ToolbarButton icon={Link} label="Link" onClick={() => exec('createLink', prompt('URL') ?? '')} />
            <ToolbarButton icon={Image} label="Anexar imagem" onClick={() => imageUploadRef.current?.click()} />
            <ToolbarButton icon={MonitorPlay} label="Anexar video" onClick={() => videoUploadRef.current?.click()} />
            <input
              ref={imageUploadRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => {
                void uploadIntoEmergency(event.target.files?.[0], 'image');
                event.target.value = '';
              }}
            />
            <input
              ref={videoUploadRef}
              type="file"
              accept="video/*,.mov,.mp4,.webm"
              hidden
              onChange={(event) => {
                void uploadIntoEmergency(event.target.files?.[0], 'video');
                event.target.value = '';
              }}
            />
          </div>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            className="min-h-28 px-3 py-2 text-base leading-relaxed outline-none"
            dangerouslySetInnerHTML={{ __html: initialHtml }}
          />
        </div>
      </div>
      {status ? <p className="mt-3 text-sm font-medium text-green-700">{status}</p> : null}
    </section>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Bold;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      className="grid h-9 w-9 place-items-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
      onClick={onClick}
    >
      <Icon size={17} />
    </button>
  );
}

function stripHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .trim();
}
