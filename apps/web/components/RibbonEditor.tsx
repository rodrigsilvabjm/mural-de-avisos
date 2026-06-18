'use client';

import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Highlighter,
  Image,
  Italic,
  Link,
  List,
  ListOrdered,
  MonitorPlay,
  Table,
  Underline,
} from 'lucide-react';
import { FormEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';
import { Notice } from '../lib/types';

function exec(command: string, value?: string) {
  document.execCommand(command, false, value);
}

export function RibbonEditor({
  notice,
  onSaved,
}: {
  notice?: Notice | null;
  onSaved?: (notice: Notice) => void;
}) {
  const router = useRouter();
  const editorRef = useRef<HTMLDivElement>(null);
  const imageUploadRef = useRef<HTMLInputElement>(null);
  const videoUploadRef = useRef<HTMLInputElement>(null);
  const selectedMediaRef = useRef<HTMLElement | null>(null);
  const [fontSize, setFontSize] = useState('4');
  const [mediaWidth, setMediaWidth] = useState('100');
  const [mediaHeight, setMediaHeight] = useState('');
  const [status, setStatus] = useState('');

  function insertHtml(html: string) {
    editorRef.current?.focus();
    exec('insertHTML', html);
  }

  async function uploadIntoNotice(file: File | undefined, kind: 'image' | 'video') {
    if (!file) return;
    try {
      setStatus('Enviando arquivo...');
      const uploaded = await api.upload(file);
      if (kind === 'image') {
        insertHtml(`<img src="${uploaded.url}" alt="" style="display:block;width:100%;max-height:70vh;object-fit:contain;margin:12px 0;border-radius:12px" />`);
      } else {
        insertHtml(`<video src="${uploaded.url}" autoplay muted loop playsinline style="display:block;width:100%;max-height:70vh;object-fit:contain;margin:12px 0;border-radius:12px"></video>`);
      }
      setStatus('Arquivo anexado ao aviso.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Falha ao anexar arquivo.');
    }
  }

  function selectMedia(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return;
    const media = target.closest('img,video') as HTMLElement | null;
    if (!media || !editorRef.current?.contains(media)) return;
    selectedMediaRef.current = media;
    setMediaWidth(parseInt(media.style.width || '100', 10).toString());
    setMediaHeight(media.style.height ? parseInt(media.style.height, 10).toString() : '');
    setStatus('Midia selecionada. Ajuste largura e altura abaixo.');
  }

  function applyMediaSize() {
    const media = selectedMediaRef.current;
    if (!media) {
      setStatus('Clique primeiro na imagem ou video dentro do aviso.');
      return;
    }
    media.style.width = `${Math.max(5, Math.min(100, Number(mediaWidth) || 100))}%`;
    media.style.height = mediaHeight ? `${Math.max(40, Number(mediaHeight))}px` : 'auto';
    media.style.maxHeight = 'none';
    media.style.objectFit = 'contain';
    setStatus('Tamanho da midia atualizado.');
  }

  function applyMediaPosition(position: 'left' | 'center' | 'right' | 'float-left' | 'float-right') {
    const media = selectedMediaRef.current;
    if (!media) {
      setStatus('Clique primeiro na imagem ou video dentro do aviso.');
      return;
    }
    media.style.float = '';
    media.style.display = 'block';
    media.style.margin = '12px auto';
    if (position === 'left') media.style.margin = '12px auto 12px 0';
    if (position === 'right') media.style.margin = '12px 0 12px auto';
    if (position === 'float-left') {
      media.style.float = 'left';
      media.style.margin = '8px 18px 12px 0';
    }
    if (position === 'float-right') {
      media.style.float = 'right';
      media.style.margin = '8px 0 12px 18px';
    }
    setStatus('Posicao da midia atualizada.');
  }

  async function saveNotice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      setStatus('Salvando aviso...');
      const payload = {
        title: String(form.get('title')),
        subtitle: String(form.get('subtitle') ?? ''),
        priority: form.get('priority') as 'low' | 'normal' | 'high' | 'urgent',
        durationSeconds: Number(form.get('durationSeconds') || 15),
        startsAt: String(form.get('startsAt') || new Date().toISOString()),
        endsAt: String(form.get('endsAt') || ''),
        tickerText: String(form.get('tickerText') ?? ''),
        tickerPersistent: form.get('tickerPersistent') === 'on',
        bodyHtml: normalizeNoticeHtml(editorRef.current?.innerHTML ?? ''),
      };
      const saved = notice?.id
        ? await api.updateNotice(notice.id, payload)
        : await api.createNotice(payload);
      setStatus(notice?.id ? 'Aviso editado e enviado para o player.' : 'Aviso salvo e enviado para o player.');
      onSaved?.(saved);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Falha ao salvar aviso.');
    }
  }

  return (
    <form key={notice?.id ?? 'new-notice'} id="mural" onSubmit={saveNotice} className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-3 border-b border-slate-200 p-3 md:grid-cols-2 xl:grid-cols-6">
        <label className="text-sm">
          Titulo
          <input name="title" required defaultValue={notice?.title ?? 'Comunicado da diretoria'} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <label className="text-sm">
          Subtitulo
          <input name="subtitle" defaultValue={notice?.subtitle ?? 'Informativo interno'} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <label className="text-sm">
          Prioridade
          <select name="priority" defaultValue={notice?.priority ?? 'normal'} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
            <option value="low">baixa</option>
            <option value="normal">normal</option>
            <option value="high">alta</option>
            <option value="urgent">urgente</option>
          </select>
        </label>
        <label className="text-sm">
          Tempo na TV (segundos)
          <input
            name="durationSeconds"
            type="number"
            min="5"
            defaultValue={notice?.durationSeconds ?? 15}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          Inicio
          <input name="startsAt" type="datetime-local" defaultValue={toDateTimeLocal(notice?.startsAt)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <label className="text-sm">
          Fim
          <input name="endsAt" type="datetime-local" defaultValue={toDateTimeLocal(notice?.endsAt)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <label className="text-sm md:col-span-2 xl:col-span-6">
          Letreiro passando na TV
          <input
            name="tickerText"
            defaultValue={notice?.tickerText ?? ''}
            placeholder="Ex.: Atendimento especial hoje ate as 18h"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="flex items-center gap-2 text-sm md:col-span-2 xl:col-span-6">
          <input name="tickerPersistent" type="checkbox" defaultChecked={notice?.tickerPersistent ?? false} />
          Manter este letreiro aparecendo tambem nos outros conteudos da biblioteca
        </label>
      </div>
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
            onChange={(event) => exec('fontName', event.target.value)}
            defaultValue="Arial"
          >
            {['Arial', 'Calibri', 'Roboto', 'Verdana', 'Times New Roman'].map((font) => (
              <option key={font}>{font}</option>
            ))}
          </select>
          <select
            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
            value={fontSize}
            onChange={(event) => {
              setFontSize(event.target.value);
              exec('fontSize', event.target.value);
            }}
          >
            {['2', '3', '4', '5', '6', '7'].map((size) => (
              <option key={size} value={size}>
                {Number(size) * 6}px
              </option>
            ))}
          </select>
          <ToolbarButton icon={Bold} onClick={() => exec('bold')} label="Negrito" />
          <ToolbarButton icon={Italic} onClick={() => exec('italic')} label="Italico" />
          <ToolbarButton icon={Underline} onClick={() => exec('underline')} label="Sublinhado" />
          <input
            aria-label="Cor da fonte"
            type="color"
            className="h-9 w-10 rounded-md border border-slate-300"
            onChange={(event) => exec('foreColor', event.target.value)}
          />
          <ToolbarButton icon={Highlighter} onClick={() => exec('backColor', '#fff3a3')} label="Realce" />
          <ToolbarButton icon={AlignLeft} onClick={() => exec('justifyLeft')} label="Esquerda" />
          <ToolbarButton icon={AlignCenter} onClick={() => exec('justifyCenter')} label="Centro" />
          <ToolbarButton icon={AlignRight} onClick={() => exec('justifyRight')} label="Direita" />
          <ToolbarButton icon={AlignJustify} onClick={() => exec('justifyFull')} label="Justificar" />
          <ToolbarButton icon={List} onClick={() => exec('insertUnorderedList')} label="Marcadores" />
          <ToolbarButton icon={ListOrdered} onClick={() => exec('insertOrderedList')} label="Numeracao" />
          <ToolbarButton icon={Link} onClick={() => exec('createLink', prompt('URL') ?? '')} label="Link" />
          <ToolbarButton icon={Image} onClick={() => imageUploadRef.current?.click()} label="Anexar imagem" />
          <ToolbarButton icon={MonitorPlay} onClick={() => videoUploadRef.current?.click()} label="Anexar video" />
          <ToolbarButton icon={Table} onClick={() => insertTable(editorRef.current)} label="Tabela" />
          <input
            ref={imageUploadRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              void uploadIntoNotice(event.target.files?.[0], 'image');
              event.target.value = '';
            }}
          />
          <input
            ref={videoUploadRef}
            type="file"
            accept="video/*,.mov,.mp4,.webm"
            hidden
            onChange={(event) => {
              void uploadIntoNotice(event.target.files?.[0], 'video');
              event.target.value = '';
            }}
          />
        </div>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="min-h-44 px-5 py-4 text-base leading-relaxed outline-none"
        onClick={(event) => selectMedia(event.target)}
        onKeyDown={(event) => {
          if (!event.ctrlKey) return;
          const key = event.key.toLowerCase();
          if (['b', 'i', 'u'].includes(key)) event.preventDefault();
          if (key === 'b') exec('bold');
          if (key === 'i') exec('italic');
          if (key === 'u') exec('underline');
        }}
      >
        {notice ? (
          <div dangerouslySetInnerHTML={{ __html: notice.bodyHtml }} />
        ) : (
          <>
            <h2>Comunicado da diretoria</h2>
            <p>
              Selecione o texto e use a faixa de opcoes para formatar fonte,
              alinhamento, listas, links, imagens e tabelas.
            </p>
          </>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3">
        <label className="text-sm">
          Largura da midia selecionada (%)
          <input
            type="number"
            min="5"
            max="100"
            value={mediaWidth}
            onChange={(event) => setMediaWidth(event.target.value)}
            className="mt-1 w-36 rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          Altura em px (vazio = auto)
          <input
            type="number"
            min="40"
            value={mediaHeight}
            onChange={(event) => setMediaHeight(event.target.value)}
            className="mt-1 w-36 rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <button type="button" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-white" onClick={applyMediaSize}>
          Aplicar tamanho
        </button>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-white" onClick={() => applyMediaPosition('left')}>
            Esquerda
          </button>
          <button type="button" className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-white" onClick={() => applyMediaPosition('center')}>
            Centro
          </button>
          <button type="button" className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-white" onClick={() => applyMediaPosition('right')}>
            Direita
          </button>
          <button type="button" className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-white" onClick={() => applyMediaPosition('float-left')}>
            Ao lado esquerdo do texto
          </button>
          <button type="button" className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-white" onClick={() => applyMediaPosition('float-right')}>
            Ao lado direito do texto
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
        <p className="text-sm font-medium text-green-700">{status}</p>
        <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white" type="submit">
          {notice?.id ? 'Salvar edicao' : 'Salvar aviso'}
        </button>
      </div>
    </form>
  );
}

function toDateTimeLocal(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (input: number) => String(input).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

function normalizeNoticeHtml(html: string) {
  const template = document.createElement('template');
  template.innerHTML = html;

  const sizeMap: Record<string, string> = {
    '1': '12px',
    '2': '18px',
    '3': '24px',
    '4': '32px',
    '5': '42px',
    '6': '54px',
    '7': '68px',
  };

  template.content.querySelectorAll('font').forEach((font) => {
    const span = document.createElement('span');
    const size = font.getAttribute('size');
    const color = font.getAttribute('color');
    const face = font.getAttribute('face');
    if (size && sizeMap[size]) span.style.fontSize = sizeMap[size];
    if (color) span.style.color = color;
    if (face) span.style.fontFamily = face;
    span.innerHTML = font.innerHTML;
    font.replaceWith(span);
  });

  template.content.querySelectorAll('img,video').forEach((media) => {
    const element = media as HTMLElement;
    element.style.maxWidth = element.style.maxWidth || '100%';
    element.style.objectFit = element.style.objectFit || 'contain';
  });

  return template.innerHTML;
}

function insertTable(editor: HTMLDivElement | null) {
  if (!editor) return;
  editor.focus();
  exec(
    'insertHTML',
    '<table style="width:100%;border-collapse:collapse"><tr><td style="border:1px solid #cbd5e1;padding:6px">Item</td><td style="border:1px solid #cbd5e1;padding:6px">Status</td></tr></table>',
  );
}
