import { Bell, FileVideo, Monitor, Wifi } from 'lucide-react';
import { AdminControls } from '../components/AdminControls';
import { AppShell } from '../components/AppShell';
import { EmergencyPanel } from '../components/EmergencyPanel';
import { MetricCard } from '../components/MetricCard';
import { NoticeCenter } from '../components/NoticeCenter';
import { ScreensMonitor } from '../components/ScreensMonitor';
import { TemplateCanvas } from '../components/TemplateCanvas';
import { api } from '../lib/api';

export default async function HomePage() {
  const [dashboard, contents, notices, screens, schedules, users, branding, templates] = await Promise.all([
    api.dashboard(),
    api.contents(),
    api.notices(),
    api.screens(),
    api.schedules(),
    api.users(),
    api.branding(),
    api.templates(),
  ]);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-brand">Painel administrativo</p>
            <h1 className="text-3xl font-semibold tracking-tight">TV corporativa</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              href="/player/TV001"
            >
              Abrir player TV001
            </a>
            <a
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              href="/player-lite/TV001"
            >
              Player LG/webOS
            </a>
            <a className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white" href="#conteudos">
              Novo conteudo
            </a>
          </div>
        </header>

        <section id="dashboard" className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Conteudos" value={dashboard.totals.assets} icon={FileVideo} />
          <MetricCard label="Avisos" value={dashboard.totals.notices} icon={Bell} tone="orange" />
          <MetricCard label="Telas" value={dashboard.totals.screens} icon={Monitor} tone="slate" />
          <MetricCard label="Online" value={dashboard.totals.onlineScreens} icon={Wifi} tone="green" />
        </section>

        <div className="mt-6">
          <EmergencyPanel initial={dashboard.emergency} />
        </div>

        <NoticeCenter notices={notices} />

        <div className="mt-6">
          <TemplateCanvas initialTemplates={templates} />
        </div>

        <section className="mt-6 grid gap-6">
          <ScreensMonitor initialScreens={screens} />
        </section>

        <AdminControls
          contents={contents}
          schedules={schedules}
          users={users}
          branding={branding}
          notices={notices}
          templates={templates}
        />
      </div>
    </AppShell>
  );
}
