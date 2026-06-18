'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { Screen } from '../lib/types';

const HIDE_OFFLINE_AFTER_MS = 5 * 60 * 1000;

export function ScreensMonitor({ initialScreens }: { initialScreens: Screen[] }) {
  const [screens, setScreens] = useState(initialScreens);

  useEffect(() => {
    let mounted = true;

    async function refresh() {
      try {
        const next = await api.screens();
        if (mounted) setScreens(next);
      } catch {
        // Mantem o ultimo estado visivel se a rede falhar por alguns segundos.
      }
    }

    const timer = window.setInterval(refresh, 5000);
    void refresh();
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const visibleScreens = useMemo(() => {
    const now = Date.now();
    return screens
      .filter((screen) => isValidTvCode(screen.code))
      .filter((screen) => {
        if (screen.online) return true;
        const lastSeen = screen.lastSeenAt ? new Date(screen.lastSeenAt).getTime() : 0;
        return Number.isNaN(lastSeen) || now - lastSeen <= HIDE_OFFLINE_AFTER_MS;
      })
      .sort((left, right) => String(left.code).localeCompare(String(right.code)));
  }, [screens]);

  return (
    <div id="telas" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Monitoramento das TVs</h2>
        <span className="text-xs font-medium text-slate-500">Atualiza automaticamente a cada 5s</span>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[540px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2">Codigo</th>
              <th>Ultima atividade</th>
              <th>Conexao</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleScreens.map((screen) => (
              <tr key={screen.id}>
                <td className="py-3 font-medium">{screen.code}</td>
                <td>{formatLastSeen(screen.lastSeenAt)}</td>
                <td>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      screen.online ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {screen.online ? 'online' : 'offline'}
                  </span>
                </td>
              </tr>
            ))}
            {visibleScreens.length === 0 ? (
              <tr>
                <td className="py-4 text-slate-500" colSpan={3}>
                  Nenhuma TV online no momento.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function isValidTvCode(code: string) {
  return /^[A-Z0-9_-]{2,32}$/.test(code);
}

function formatLastSeen(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR');
}
