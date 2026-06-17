'use client';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import { Notice } from '../lib/types';
import { RibbonEditor } from './RibbonEditor';

export function NoticeCenter({ notices }: { notices: Notice[] }) {
  const [items, setItems] = useState(notices);
  const [editing, setEditing] = useState<Notice | null>(null);

  async function removeNotice(id: string) {
    await api.deleteNotice(id);
    setItems((value) => value.filter((notice) => notice.id !== id));
    if (editing?.id === id) setEditing(null);
  }

  function upsertNotice(notice: Notice) {
    setItems((value) => {
      const exists = value.some((item) => item.id === notice.id);
      return exists
        ? value.map((item) => (item.id === notice.id ? notice : item))
        : [notice, ...value];
    });
    setEditing(null);
  }

  return (
    <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
      <RibbonEditor notice={editing} onSaved={upsertNotice} />
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Avisos ativos</h2>
          <button
            className="grid h-9 w-9 place-items-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
            type="button"
            title="Novo aviso"
            onClick={() => setEditing(null)}
          >
            <Plus size={17} />
          </button>
        </div>
        <div className="mt-3 space-y-3">
          {items.map((notice) => (
            <article key={notice.id} className="rounded-md border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{notice.title}</h3>
                  <p className="text-sm text-slate-500">{notice.subtitle ?? 'Sem subtitulo'}</p>
                  <p className="text-xs text-slate-400">{notice.durationSeconds}s na TV</p>
                </div>
                <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-700">
                  {notice.priority}
                </span>
              </div>
              <div
                className="mt-2 line-clamp-3 text-sm text-slate-600"
                dangerouslySetInnerHTML={{ __html: notice.bodyHtml }}
              />
              <div className="mt-3 flex justify-end gap-2">
                <button
                  className="grid h-8 w-8 place-items-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
                  type="button"
                  title="Editar aviso"
                  onClick={() => setEditing(notice)}
                >
                  <Pencil size={15} />
                </button>
                <button
                  className="grid h-8 w-8 place-items-center rounded-md border border-red-300 text-red-700 hover:bg-red-50"
                  type="button"
                  title="Excluir aviso"
                  onClick={() => removeNotice(notice.id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))}
          {items.length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">
              Nenhum aviso cadastrado.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
