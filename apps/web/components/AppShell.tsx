import {
  Bell,
  CalendarDays,
  GalleryVerticalEnd,
  LayoutDashboard,
  Monitor,
  Palette,
  ShieldAlert,
  Users,
} from 'lucide-react';

const nav = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Conteudos', icon: GalleryVerticalEnd },
  { label: 'Mural', icon: Bell },
  { label: 'Telas', icon: Monitor },
  { label: 'Agenda', icon: CalendarDays },
  { label: 'Identidade', icon: Palette },
  { label: 'Usuarios', icon: Users },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f5f7fb] text-ink">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white px-4 py-5 lg:block">
        <div className="flex items-center gap-3 px-2">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand text-sm font-bold text-white">
            TV
          </div>
          <div>
            <p className="text-sm font-semibold">Corporate Signage</p>
            <p className="text-xs text-slate-500">Multiempresa</p>
          </div>
        </div>
        <nav className="mt-8 space-y-1">
          {nav.map((item) => (
            <a
              key={item.label}
              href={`#${item.label.toLowerCase()}`}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <item.icon size={18} />
              {item.label}
            </a>
          ))}
        </nav>
        <div className="absolute bottom-5 left-4 right-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
          <div className="flex items-center gap-2 font-semibold text-red-700">
            <ShieldAlert size={16} />
            Emergencia
          </div>
          <p className="mt-1 text-xs text-red-600">Interrompe todas as TVs em tempo real.</p>
        </div>
      </aside>
      <section className="lg:pl-64">{children}</section>
    </main>
  );
}
