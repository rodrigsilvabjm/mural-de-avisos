'use client';

import { DndContext, DragEndEvent, useDraggable } from '@dnd-kit/core';
import { restrictToParentElement } from '@dnd-kit/modifiers';
import { AlignCenter, AlignLeft, AlignRight, Bold, BringToFront, Globe, Image, Italic, MonitorPlay, Plus, QrCode, Rss, Save, SendToBack, Trash2, Type, Underline } from 'lucide-react';
import { CSSProperties, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { TemplateLayout } from '../lib/types';

const CANVAS_WIDTH = 760;
const CANVAS_HEIGHT = 430;

type CanvasItem = {
  id: string;
  label: string;
  kind: 'text' | 'image' | 'video' | 'qr' | 'iframe' | 'rss';
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  background: string;
  color: string;
  opacity: number;
  radius: number;
  shadow: boolean;
  content: string;
  sourceUrl: string;
  backgroundImage: string;
  fitMode: 'cover' | 'contain';
  loop: boolean;
  fullBleed: boolean;
  transition: TransitionName;
  exitTransition: TransitionName;
  startSecond: number;
  endSecond: number;
  durationSecond: number;
};

type TransitionName =
  | 'none'
  | 'fade'
  | 'slide'
  | 'slide-left'
  | 'slide-up'
  | 'slide-down'
  | 'zoom'
  | 'flip'
  | 'bounce'
  | 'rotate'
  | 'blur';

const transitionOptions: Array<{ value: TransitionName; label: string }> = [
  { value: 'none', label: 'Sem transicao' },
  { value: 'fade', label: 'Fade' },
  { value: 'slide', label: 'Deslizar direita' },
  { value: 'slide-left', label: 'Deslizar esquerda' },
  { value: 'slide-up', label: 'Subir' },
  { value: 'slide-down', label: 'Descer' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'flip', label: 'Flip' },
  { value: 'bounce', label: 'Bounce' },
  { value: 'rotate', label: 'Rotacionar' },
  { value: 'blur', label: 'Blur' },
];

const initialItems: CanvasItem[] = [
  {
    id: 'headline',
    label: 'Aviso importante',
    kind: 'text',
    x: 44,
    y: 42,
    width: 310,
    height: 96,
    zIndex: 3,
    background: '#ffffff',
    color: '#111827',
    opacity: 0.94,
    radius: 12,
    shadow: true,
    content: 'Aviso importante',
    sourceUrl: '',
    backgroundImage: '',
    fitMode: 'contain',
    loop: true,
    fullBleed: false,
    transition: 'none',
    exitTransition: 'none',
    startSecond: 1,
    endSecond: 0,
    durationSecond: 0,
  },
  {
    id: 'dashboard',
    label: 'Power BI / Grafana',
    kind: 'iframe',
    x: 390,
    y: 70,
    width: 330,
    height: 190,
    zIndex: 1,
    background: '#dbeafe',
    color: '#1e3a8a',
    opacity: 1,
    radius: 8,
    shadow: false,
    content: 'Power BI / Grafana',
    sourceUrl: 'https://app.powerbi.com/reportEmbed',
    backgroundImage: '',
    fitMode: 'contain',
    loop: true,
    fullBleed: false,
    transition: 'none',
    exitTransition: 'none',
    startSecond: 1,
    endSecond: 0,
    durationSecond: 0,
  },
];

const widgetOptions = [
  { kind: 'text', label: 'Texto', icon: Type },
  { kind: 'image', label: 'Imagem', icon: Image },
  { kind: 'video', label: 'Video', icon: MonitorPlay },
  { kind: 'iframe', label: 'Site/YouTube', icon: Globe },
  { kind: 'qr', label: 'QR Code', icon: QrCode },
  { kind: 'rss', label: 'RSS', icon: Rss },
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function fitItemToCanvas(item: CanvasItem): CanvasItem {
  if (item.fullBleed) {
    return { ...item, x: 0, y: 0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT };
  }
  const width = clamp(item.width, 40, CANVAS_WIDTH);
  const height = clamp(item.height, 40, CANVAS_HEIGHT);
  const x = clamp(item.x, 0, CANVAS_WIDTH - width);
  const y = clamp(item.y, 0, CANVAS_HEIGHT - height);
  return { ...item, x, y, width, height };
}

export function TemplateCanvas({ initialTemplates = [] }: { initialTemplates?: TemplateLayout[] }) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [activeTemplateId, setActiveTemplateId] = useState(initialTemplates[0]?.id ?? '');
  const [templateName, setTemplateName] = useState(initialTemplates[0]?.name ?? 'Template principal');
  const [templateDuration, setTemplateDuration] = useState(initialTemplates[0]?.durationSeconds ?? 25);
  const [displayMode, setDisplayMode] = useState<'dark' | 'light'>(initialTemplates[0]?.displayMode ?? 'dark');
  const [items, setItems] = useState(initialItems);
  const [selected, setSelected] = useState(items[0].id);
  const [saved, setSaved] = useState('');
  const current = items.find((item) => item.id === selected);

  useEffect(() => {
    if (initialTemplates[0]) {
      loadTemplate(initialTemplates[0]);
      return;
    }
    const stored = localStorage.getItem('template:main');
    if (stored) {
      const parsed = JSON.parse(stored) as CanvasItem[];
      setItems(parsed.map((item) => ({
        ...item,
        transition: item.transition ?? 'none',
        exitTransition: item.exitTransition ?? item.transition ?? 'none',
        startSecond: item.startSecond ?? 1,
        endSecond: item.endSecond ?? 0,
        durationSecond: item.durationSecond ?? 0,
      })));
      setSelected(parsed[0]?.id ?? '');
    }
  }, []);

  function loadTemplate(template: TemplateLayout) {
    const loadedItems: CanvasItem[] = template.items.map((item) => fitItemToCanvas({
      id: item.id,
      label: String(asRecord(item.data).label ?? asRecord(item.data).content ?? item.kind),
      kind: item.kind as CanvasItem['kind'],
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      zIndex: item.zIndex,
      background: String(asRecord(item.style).background ?? '#ffffff'),
      color: String(asRecord(item.style).color ?? '#111827'),
      opacity: Number(asRecord(item.style).opacity ?? 1),
      radius: Number(asRecord(item.style).borderRadius ?? 12),
      shadow: Boolean(asRecord(item.style).boxShadow),
      content: String(asRecord(item.data).content ?? asRecord(item.data).label ?? ''),
      sourceUrl: String(asRecord(item.data).sourceUrl ?? ''),
      backgroundImage: String(asRecord(item.data).backgroundImage ?? ''),
      fitMode: asRecord(item.data).fitMode === 'contain' ? 'contain' : 'cover',
      loop: asRecord(item.data).loop !== false,
      fullBleed: asRecord(item.data).fullBleed === true,
      transition: widgetTransitionValue(asRecord(item.data).transition),
      exitTransition: widgetTransitionValue(asRecord(item.data).exitTransition ?? asRecord(item.data).transition),
      startSecond: Number(asRecord(item.data).startSecond ?? 1),
      endSecond: Number(asRecord(item.data).endSecond ?? 0),
      durationSecond: Number(asRecord(item.data).durationSecond ?? 0),
    }));
    setItems(loadedItems.length > 0 ? loadedItems : initialItems);
    setSelected(loadedItems[0]?.id ?? initialItems[0].id);
    setActiveTemplateId(template.id);
    setTemplateName(template.name);
    setTemplateDuration(template.durationSeconds ?? 25);
    setDisplayMode(template.displayMode ?? 'dark');
    setSaved(`Editando ${template.name}`);
  }

  function newTemplate() {
    setActiveTemplateId('');
    setTemplateName(`Template ${templates.length + 1}`);
    setTemplateDuration(25);
    setDisplayMode('dark');
    setItems(initialItems);
    setSelected(initialItems[0].id);
    setSaved('Novo template em edicao.');
  }

  function updateSelected(patch: Partial<CanvasItem>) {
    setItems((value) =>
      value.map((item) => (item.id === selected ? fitItemToCanvas({ ...item, ...patch }) : item)),
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, delta } = event;
    setItems((value) =>
      value.map((item) =>
        item.id === active.id
          ? fitItemToCanvas({ ...item, x: item.x + delta.x, y: item.y + delta.y })
          : item,
      ),
    );
  }

  function addWidget(kind: CanvasItem['kind'], label: string) {
    const zIndex = Math.max(0, ...items.map((item) => item.zIndex)) + 1;
    const visual = defaultWidgetVisual(kind);
    const item: CanvasItem = {
      id: `${kind}-${Date.now()}`,
      label,
      kind,
      x: 80 + items.length * 18,
      y: 100 + items.length * 18,
      width: kind === 'text' ? 260 : 180,
      height: kind === 'text' ? 90 : 140,
      zIndex,
      background: visual.background,
      color: visual.color,
      opacity: visual.opacity,
      radius: visual.radius,
      shadow: true,
      content: label,
      sourceUrl: '',
      backgroundImage: '',
      fitMode: 'contain',
      loop: true,
      fullBleed: false,
      transition: 'none',
      exitTransition: 'none',
      startSecond: 1,
      endSecond: 0,
      durationSecond: 0,
    };
    setItems((value) => [...value, item]);
    setSelected(item.id);
  }

  function removeSelected() {
    setItems((value) => value.filter((item) => item.id !== selected));
    setSelected(items.find((item) => item.id !== selected)?.id ?? '');
  }

  async function saveTemplate() {
    try {
      setSaved('Salvando template...');
      const boundedItems = items.map(fitItemToCanvas);
      localStorage.setItem('template:main', JSON.stringify(boundedItems));
      const payload = {
        name: templateName || 'Template sem nome',
        durationSeconds: templateDuration,
        displayMode,
        items: boundedItems.map((item) => ({
          id: item.id,
          kind: item.kind,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          zIndex: item.zIndex,
        style: {
          background: item.background,
          backgroundImage: item.backgroundImage ? `url(${item.backgroundImage})` : undefined,
          backgroundSize: item.fitMode,
          backgroundPosition: 'center',
          color: item.color,
            opacity: item.opacity,
            borderRadius: item.radius,
            boxShadow: item.shadow ? '0 18px 40px rgba(0,0,0,0.22)' : undefined,
          },
          data: {
            label: item.label,
            content: item.content,
            sourceUrl: item.sourceUrl,
            backgroundImage: item.backgroundImage,
            fitMode: item.fitMode,
            loop: item.loop,
            fullBleed: item.fullBleed,
            transition: item.transition,
            exitTransition: item.exitTransition,
            startSecond: item.startSecond,
            endSecond: item.endSecond,
            durationSecond: item.durationSecond,
          },
        })),
      };
      const savedTemplate = activeTemplateId
        ? await api.updateTemplate(activeTemplateId, payload)
        : await api.createTemplate(payload);
      setItems(boundedItems);
      setTemplates((value) => {
        const exists = value.some((item) => item.id === savedTemplate.id);
        return exists
          ? value.map((item) => (item.id === savedTemplate.id ? savedTemplate : item))
          : [savedTemplate, ...value];
      });
      setActiveTemplateId(savedTemplate.id);
      setTemplateName(savedTemplate.name);
      setSaved('Template salvo e enviado para o player.');
    } catch (error) {
      setSaved(error instanceof Error ? error.message : 'Falha ao salvar template.');
    }
  }

  async function deleteActiveTemplate() {
    if (!activeTemplateId) return;
    await api.deleteTemplate(activeTemplateId);
    const remaining = templates.filter((template) => template.id !== activeTemplateId);
    setTemplates(remaining);
    if (remaining[0]) {
      loadTemplate(remaining[0]);
    } else {
      newTemplate();
    }
  }

  return (
    <section id="templates" className="grid gap-4 xl:grid-cols-[1fr_280px]">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Editor de template</h2>
            <p className="text-sm text-slate-500">Arraste, posicione e organize widgets na tela.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              className="h-10 rounded-md border border-slate-300 px-3 text-sm"
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              placeholder="Nome do template"
            />
            <input
              className="h-10 w-28 rounded-md border border-slate-300 px-3 text-sm"
              type="number"
              min="5"
              value={templateDuration}
              onChange={(event) => setTemplateDuration(Number(event.target.value) || 25)}
              title="Tempo de exibicao em segundos"
            />
            <select
              className="h-10 rounded-md border border-slate-300 px-3 text-sm"
              value={displayMode}
              onChange={(event) => setDisplayMode(event.target.value as 'dark' | 'light')}
              title="Tipo de exibicao"
            >
              <option value="dark">Modo noturno</option>
              <option value="light">Modo claro</option>
            </select>
            <select
              className="h-10 rounded-md border border-slate-300 px-3 text-sm"
              value={activeTemplateId}
              onChange={(event) => {
                const template = templates.find((item) => item.id === event.target.value);
                if (template) loadTemplate(template);
              }}
            >
              <option value="">Novo template</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            <button
              className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-100"
              onClick={newTemplate}
              type="button"
            >
              <Plus size={16} />
              Novo
            </button>
            <button
              className="flex items-center gap-2 rounded-md border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
              onClick={deleteActiveTemplate}
              type="button"
              disabled={!activeTemplateId}
            >
              <Trash2 size={16} />
              Apagar
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {widgetOptions.map((widget) => (
              <button
                key={widget.kind}
                className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-100"
                onClick={() => addWidget(widget.kind, widget.label)}
                type="button"
              >
                <widget.icon size={16} />
                {widget.label}
              </button>
            ))}
            <button
              className="flex items-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white"
              onClick={saveTemplate}
              type="button"
            >
              <Save size={16} />
              Salvar na TV
            </button>
            <a
              className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-100"
              href="/player/TV001"
              target="_blank"
            >
              Abrir player
            </a>
          </div>
        </div>
        <DndContext modifiers={[restrictToParentElement]} onDragEnd={handleDragEnd}>
          <div
            className={`relative aspect-video min-h-72 overflow-hidden rounded-lg ${
              displayMode === 'light'
                ? 'bg-[linear-gradient(135deg,#f8fafc,#dbeafe)] text-slate-950'
                : 'bg-[#101828] bg-[radial-gradient(circle_at_top_left,#1d4ed8,transparent_34%),linear-gradient(135deg,#111827,#0f172a)]'
            }`}
          >
            <div className="absolute left-5 top-5 rounded-md bg-white/90 px-3 py-1 text-sm font-semibold text-slate-800">
              Logo Empresa
            </div>
            {items.map((item) => (
              <DraggableItem
                key={item.id}
                item={item}
                selected={item.id === selected}
                onSelect={() => setSelected(item.id)}
              />
            ))}
          </div>
        </DndContext>
        {current ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-700">Editor de texto do widget selecionado</h3>
              <span className="truncate text-xs text-slate-500">{current.label}</span>
            </div>
            <RichWidgetEditor
              key={current.id}
              value={current.content}
              onChange={(content) => updateSelected({ content, label: stripHtml(content).slice(0, 40) || current.label })}
            />
          </div>
        ) : null}
        {saved ? <p className="mt-3 text-sm font-medium text-green-700">{saved}</p> : null}
      </div>
      <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Propriedades</h3>
        {current ? (
          <div className="mt-4 space-y-4">
            <label className="block text-sm">
              Rotulo
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                value={current.label}
                onChange={(event) => updateSelected({ label: event.target.value })}
              />
            </label>
            <label className="block text-sm">
              URL imagem/video/iframe/RSS/QR
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                value={current.sourceUrl}
                onChange={(event) => updateSelected({ sourceUrl: event.target.value })}
              />
            </label>
            <label className="block text-sm">
              URL da imagem de fundo do bloco
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                value={current.backgroundImage}
                onChange={(event) => updateSelected({ backgroundImage: event.target.value })}
              />
            </label>
            <label className="block text-sm">
              Upload imagem de fundo do bloco
              <input
                type="file"
                accept="image/*"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const uploaded = await api.upload(file);
                  updateSelected({ backgroundImage: uploaded.url });
                }}
              />
            </label>
            <label className="block text-sm">
              Upload imagem/video para TV
              <input
                type="file"
                accept="image/*,video/*,.mov,.mp4,.webm"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const previewUrl = URL.createObjectURL(file);
                  updateSelected({ sourceUrl: previewUrl });
                  const uploaded = await api.upload(file);
                  updateSelected({ sourceUrl: uploaded.url });
                }}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <NumberInput label="Posicao X" value={current.x} onChange={(x) => updateSelected({ x })} />
              <NumberInput label="Posicao Y" value={current.y} onChange={(y) => updateSelected({ y })} />
              <NumberInput label="Largura" value={current.width} onChange={(width) => updateSelected({ width })} />
              <NumberInput label="Altura" value={current.height} onChange={(height) => updateSelected({ height })} />
            </div>
            <label className="block text-sm">
              Ajuste de imagem/video
              <select
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                value={current.fitMode}
                onChange={(event) => updateSelected({ fitMode: event.target.value as 'cover' | 'contain' })}
              >
                <option value="contain">Mostrar inteiro com fundo desfocado</option>
                <option value="cover">Cobrir bloco inteiro (pode cortar)</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                Transicao de entrada
                <select
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                  value={current.transition}
                  onChange={(event) => updateSelected({ transition: event.target.value as CanvasItem['transition'] })}
                >
                  {transitionOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Transicao de saida
                <select
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                  value={current.exitTransition}
                  onChange={(event) => updateSelected({ exitTransition: event.target.value as CanvasItem['exitTransition'] })}
                >
                  {transitionOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Linha do tempo do widget</p>
              <div className="grid grid-cols-3 gap-2">
                <NumberInput
                  label="Inicio (s)"
                  value={current.startSecond}
                  onChange={(startSecond) => updateSelected({ startSecond })}
                />
                <NumberInput
                  label="Fim (s)"
                  value={current.endSecond}
                  onChange={(endSecond) => updateSelected({ endSecond })}
                />
                <NumberInput
                  label="Duracao (s)"
                  value={current.durationSecond}
                  onChange={(durationSecond) => updateSelected({ durationSecond })}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Use 0 em fim/duracao para acompanhar o tempo total do template. Inicio padrao: 1 segundo.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={current.loop} onChange={(event) => updateSelected({ loop: event.target.checked })} />
              Repetir em loop
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={current.fullBleed} onChange={(event) => updateSelected({ fullBleed: event.target.checked })} />
              Ocupar tela inteira na TV
            </label>
            <label className="block text-sm">
              Opacidade
              <input
                type="range"
                min="0.2"
                max="1"
                step="0.05"
                className="mt-2 w-full"
                value={current.opacity}
                onChange={(event) => updateSelected({ opacity: Number(event.target.value) })}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                Fundo
                <input
                  type="color"
                  className="mt-1 h-10 w-full rounded-md border border-slate-300"
                  value={current.background}
                  onChange={(event) => updateSelected({ background: event.target.value })}
                />
              </label>
              <label className="block text-sm">
                Texto
                <input
                  type="color"
                  className="mt-1 h-10 w-full rounded-md border border-slate-300"
                  value={current.color}
                  onChange={(event) => updateSelected({ color: event.target.value })}
                />
              </label>
            </div>
            <NumberInput label="Borda arredondada" value={current.radius} onChange={(radius) => updateSelected({ radius })} />
            <div className="flex gap-2">
              <button
                className="flex flex-1 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm"
                onClick={() => updateSelected({ zIndex: current.zIndex + 1 })}
                type="button"
              >
                <BringToFront size={16} />
                Frente
              </button>
              <button
                className="flex flex-1 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm"
                onClick={() => updateSelected({ zIndex: current.zIndex - 1 })}
                type="button"
              >
                <SendToBack size={16} />
                Tras
              </button>
            </div>
            <button
              className="flex w-full items-center justify-center gap-2 rounded-md border border-red-300 px-3 py-2 text-sm font-semibold text-red-700"
              onClick={removeSelected}
              type="button"
            >
              <Trash2 size={16} />
              Remover widget
            </button>
          </div>
        ) : null}
      </aside>
    </section>
  );
}

function defaultWidgetVisual(kind: CanvasItem['kind']) {
  if (kind === 'image' || kind === 'video') {
    return { background: '#000000', color: '#ffffff', opacity: 0.08, radius: 16 };
  }
  if (kind === 'rss') {
    return { background: '#ffffff', color: '#111827', opacity: 0.96, radius: 18 };
  }
  if (kind === 'iframe') {
    return { background: '#0f172a', color: '#ffffff', opacity: 1, radius: 18 };
  }
  if (kind === 'qr') {
    return { background: '#f8fafc', color: '#0f172a', opacity: 0.94, radius: 18 };
  }
  return { background: '#111827', color: '#ffffff', opacity: 0.82, radius: 18 };
}

function DraggableItem({
  item,
  selected,
  onSelect,
}: {
  item: CanvasItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: item.id });
  const style: CSSProperties = {
    left: item.fullBleed ? 0 : item.x,
    top: item.fullBleed ? 0 : item.y,
    width: item.fullBleed ? '100%' : item.width,
    height: item.fullBleed ? '100%' : item.height,
    zIndex: item.zIndex,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    background: item.background,
    backgroundImage: item.backgroundImage ? `url(${item.backgroundImage})` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    color: item.color,
    opacity: item.opacity,
    borderRadius: item.radius,
    boxShadow: item.shadow ? '0 18px 40px rgba(0,0,0,0.22)' : undefined,
    animation: transitionAnimationValue(item.transition, 'in'),
  };

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`absolute grid cursor-move place-items-center overflow-hidden border text-center text-sm font-semibold ${
        selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-white/50'
      } ${['image', 'video', 'iframe'].includes(item.kind) ? 'p-0' : 'p-3'}`}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onSelect}
      onPointerDown={onSelect}
    >
      <WidgetPreview item={item} />
    </button>
  );
}

function WidgetPreview({ item }: { item: CanvasItem }) {
  if (item.kind === 'image' && item.sourceUrl) {
    return <MediaPreview type="image" url={item.sourceUrl} title={item.label} fitMode={item.fitMode} />;
  }
  if (item.kind === 'video' && item.sourceUrl) {
    return <MediaPreview type="video" url={item.sourceUrl} title={item.label} fitMode={item.fitMode} loop={item.loop} />;
  }
  if (item.kind === 'iframe') {
    return item.sourceUrl ? (
      <iframe src={toEmbeddableUrl(item.sourceUrl)} title={item.label} className="pointer-events-none h-full w-full border-0 bg-white" />
    ) : (
      <span>{item.content}</span>
    );
  }
  if (item.kind === 'qr') {
    return <span className="break-all">QR: {item.sourceUrl || item.content}</span>;
  }
  if (item.kind === 'rss') {
    return <RssPreview url={item.sourceUrl || item.content} />;
  }
  return <div className="pointer-events-none w-full" dangerouslySetInnerHTML={{ __html: item.content || item.label }} />;
}

function MediaPreview({
  type,
  url,
  title,
  fitMode,
  loop = true,
}: {
  type: 'image' | 'video';
  url: string;
  title: string;
  fitMode: 'cover' | 'contain';
  loop?: boolean;
}) {
  const mediaClass = fitMode === 'cover' ? 'object-cover' : 'object-contain';

  return (
    <div className="pointer-events-none relative h-full w-full overflow-hidden bg-black">
      {fitMode === 'contain' ? (
        type === 'image' ? (
          <img src={url} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-xl" />
        ) : (
          <video src={url} className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-xl" muted loop autoPlay playsInline />
        )
      ) : null}
      <div className="absolute inset-0 bg-black/15" />
      {type === 'image' ? (
        <img src={url} alt={title} className={`relative z-[1] h-full w-full ${mediaClass}`} />
      ) : (
        <video src={url} className={`relative z-[1] h-full w-full ${mediaClass}`} muted loop={loop} autoPlay playsInline />
      )}
    </div>
  );
}

function RichWidgetEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = value;
    }
  }, []);

  function exec(command: string, commandValue?: string) {
    ref.current?.focus();
    document.execCommand(command, false, commandValue);
    onChange(ref.current?.innerHTML ?? '');
  }

  return (
    <div className="rounded-md border border-slate-200">
      <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 p-2">
        <button type="button" className="grid h-8 w-8 place-items-center rounded border border-slate-300 bg-white" onClick={() => exec('bold')} title="Negrito">
          <Bold size={15} />
        </button>
        <button type="button" className="grid h-8 w-8 place-items-center rounded border border-slate-300 bg-white" onClick={() => exec('italic')} title="Italico">
          <Italic size={15} />
        </button>
        <button type="button" className="grid h-8 w-8 place-items-center rounded border border-slate-300 bg-white" onClick={() => exec('underline')} title="Sublinhado">
          <Underline size={15} />
        </button>
        <button type="button" className="grid h-8 w-8 place-items-center rounded border border-slate-300 bg-white" onClick={() => exec('justifyLeft')} title="Esquerda">
          <AlignLeft size={15} />
        </button>
        <button type="button" className="grid h-8 w-8 place-items-center rounded border border-slate-300 bg-white" onClick={() => exec('justifyCenter')} title="Centro">
          <AlignCenter size={15} />
        </button>
        <button type="button" className="grid h-8 w-8 place-items-center rounded border border-slate-300 bg-white" onClick={() => exec('justifyRight')} title="Direita">
          <AlignRight size={15} />
        </button>
        <input type="color" className="h-8 w-9 rounded border border-slate-300" onChange={(event) => exec('foreColor', event.target.value)} title="Cor" />
        <select className="h-8 rounded border border-slate-300 bg-white px-2 text-xs" onChange={(event) => exec('fontSize', event.target.value)} defaultValue="4">
          <option value="2">12px</option>
          <option value="3">18px</option>
          <option value="4">24px</option>
          <option value="5">30px</option>
          <option value="6">36px</option>
          <option value="7">42px</option>
        </select>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        dir="ltr"
        className="min-h-24 px-3 py-2 text-sm outline-none"
        onInput={() => onChange(ref.current?.innerHTML ?? '')}
      />
    </div>
  );
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, '').trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function widgetTransitionValue(value: unknown): CanvasItem['transition'] {
  return transitionOptions.some((option) => option.value === String(value))
    ? (String(value) as CanvasItem['transition'])
    : 'none';
}

function widgetTransitionClass(transition?: CanvasItem['transition']) {
  const animation = transitionAnimationName(transition ?? 'none', 'in');
  return animation ? `animate-[${animation}_.7s_ease_forwards]` : '';
}

function transitionAnimationValue(transition: CanvasItem['transition'], direction: 'in' | 'out') {
  const animation = transitionAnimationName(transition, direction);
  return animation ? `${animation} .7s ease forwards` : undefined;
}

function transitionAnimationName(transition: CanvasItem['transition'], direction: 'in' | 'out') {
  const suffix = direction === 'in' ? 'In' : 'Out';
  const names: Record<string, string> = {
    fade: `fade${suffix}`,
    slide: `slide${suffix}`,
    'slide-left': `slideLeft${suffix}`,
    'slide-up': `slideUp${suffix}`,
    'slide-down': `slideDown${suffix}`,
    zoom: `zoom${suffix}`,
    flip: `flip${suffix}`,
    bounce: `bounce${suffix}`,
    rotate: `rotate${suffix}`,
    blur: `blur${suffix}`,
  };
  return names[transition] ?? '';
}

function toEmbeddableUrl(url: string) {
  try {
    const decoded = decodeURIComponent(url);
    const parsed = new URL(decoded);
    if (/youtube\.com|youtu\.be/.test(parsed.hostname)) {
      let id = '';
      if (parsed.hostname.includes('youtu.be')) {
        id = parsed.pathname.split('/').filter(Boolean)[0] ?? '';
      } else if (parsed.pathname.startsWith('/shorts/')) {
        id = parsed.pathname.split('/').filter(Boolean)[1] ?? '';
      } else if (parsed.pathname.startsWith('/embed/')) {
        id = parsed.pathname.split('/').filter(Boolean)[1] ?? '';
      } else {
        id = parsed.searchParams.get('v') ?? '';
      }
      return id ? `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&rel=0&controls=0&modestbranding=1&playsinline=1` : decoded;
    }
    return decoded;
  } catch {
    return url;
  }
}

function RssPreview({ url }: { url: string }) {
  const [items, setItems] = useState<Array<{ title: string; link: string; description: string }>>([]);

  useEffect(() => {
    if (!url || !url.startsWith('http')) return;
    let mounted = true;
    api.rssPreview(url)
      .then((result) => {
        if (mounted) setItems(result.items);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [url]);

  if (items.length === 0) {
    return <span className="break-all">RSS: {url}</span>;
  }

  return (
    <div className="h-full w-full overflow-hidden p-2 text-left">
      <p className="mb-1 text-xs font-black text-red-700">G1 | RSS</p>
      {items.slice(0, 3).map((item) => (
        <p key={item.link || item.title} className="mb-1 line-clamp-2 text-xs font-semibold">
          {item.title}
        </p>
      ))}
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-sm">
      {label}
      <input
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
