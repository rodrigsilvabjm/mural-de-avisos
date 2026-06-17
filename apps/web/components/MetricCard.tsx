import { LucideIcon } from 'lucide-react';

export function MetricCard({
  label,
  value,
  icon: Icon,
  tone = 'blue',
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: 'blue' | 'green' | 'orange' | 'slate';
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    orange: 'bg-orange-50 text-orange-700',
    slate: 'bg-slate-100 text-slate-700',
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold">{value}</p>
        </div>
        <div className={`rounded-md p-2 ${tones[tone]}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}
