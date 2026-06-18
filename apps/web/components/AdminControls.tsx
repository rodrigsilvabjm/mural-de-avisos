'use client';

import { CalendarPlus, ImagePlus, Pencil, Rss, Save, Trash2, UserPlus } from 'lucide-react';
import type React from 'react';
import { FormEvent, useState } from 'react';
import { api } from '../lib/api';
import { BrandingSettings, ContentAsset, CorporateUser, Notice, RssItem, Schedule, TemplateLayout } from '../lib/types';

const contentTypes = [
  'image',
  'video',
  'pdf',
  'docx',
  'ppt',
  'pptm',
  'pptx',
  'xlsx',
  'webpage',
  'external-link',
  'youtube',
  'rss',
  'qr-code',
  'dashboard',
];

const transitionOptions = ['none', 'fade', 'slide', 'slide-left', 'slide-up', 'slide-down', 'zoom', 'flip', 'bounce', 'rotate', 'blur'];

export function AdminControls({
  contents,
  schedules,
  users,
  branding,
  notices,
  templates,
}: {
  contents: ContentAsset[];
  schedules: Schedule[];
  users: CorporateUser[];
  branding: BrandingSettings;
  notices: Notice[];
  templates: TemplateLayout[];
}) {
  const [assetList, setAssetList] = useState(contents);
  const [scheduleList, setScheduleList] = useState(schedules);
  const [userList, setUserList] = useState(users);
  const [brand, setBrand] = useState<BrandingSettings>({ backgroundFit: 'fill', ...branding });
  const [themePreset, setThemePreset] = useState('custom');
  const [editingAsset, setEditingAsset] = useState<ContentAsset | null>(null);
  const [rssUrl, setRssUrl] = useState('https://g1.globo.com/rss/g1/');
  const [rssItems, setRssItems] = useState<RssItem[]>([]);
  const [message, setMessage] = useState('');
  const [contentSaving, setContentSaving] = useState(false);
  const [contentProgress, setContentProgress] = useState('');

  async function addContent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    let url = String(form.get('url') ?? '');
    let uploadedSlides: string[] = [];
    let conversionError = '';
    setContentSaving(true);
    setContentProgress('Preparando conteudo...');
    try {
      const file = form.get('file');
      if (file instanceof File && file.size > 0) {
        const isPresentation = /\.(ppt|pptm|pptx|pdf)$/i.test(file.name);
        setContentProgress(isPresentation ? 'Enviando arquivo e convertendo slides. Isso pode demorar...' : 'Enviando arquivo...');
        const uploaded = await api.upload(file);
        url = uploaded.url;
        uploadedSlides = uploaded.slides ?? [];
        conversionError = uploaded.conversionError ?? '';
        if (isPresentation && uploadedSlides.length > 0) {
          setContentProgress(`Conversao concluida: ${uploadedSlides.length} slide(s) gerado(s). Salvando na biblioteca...`);
        } else if (conversionError) {
          setContentProgress('Arquivo salvo, mas a conversao nao foi concluida.');
        } else {
          setContentProgress('Upload concluido. Salvando na biblioteca...');
        }
      }
      const fullscreen = form.get('fullscreen') === 'on';
      const selectedFitMode: 'cover' | 'contain' = form.get('fitMode') === 'cover' ? 'cover' : 'contain';
      const fitMode: 'cover' | 'contain' = fullscreen ? 'cover' : selectedFitMode;
      const perSlideSeconds = Math.max(1, Number(form.get('perSlideSeconds')) || 5);
      const payload: Partial<ContentAsset> = {
        name: String(form.get('name')),
        type: String(form.get('type')),
        url,
        durationSeconds: Math.max(Number(form.get('durationSeconds')) || 15, uploadedSlides.length * perSlideSeconds || 1),
        metadata: {
          fullscreen,
          hideChrome: form.get('hideChrome') === 'on',
          loop: form.get('loop') === 'on',
          fitMode,
          slides: uploadedSlides.length > 0 ? uploadedSlides : editingAsset?.metadata?.slides ?? [],
          perSlideSeconds,
          slideTransition: form.get('slideTransition') as NonNullable<ContentAsset['metadata']>['slideTransition'],
          authMode: authModeValue(form.get('authMode')),
          authUsername: String(form.get('authUsername') ?? ''),
          authPassword: String(form.get('authPassword') ?? ''),
          conversionError,
        },
      };
      if (editingAsset) {
        const updated = await api.updateContent(editingAsset.id, payload);
        setAssetList((value) => value.map((item) => (item.id === updated.id ? updated : item)));
        setEditingAsset(null);
        setMessage(conversionError ? `Conteudo editado, mas houve erro na conversao: ${conversionError}` : 'Conteudo editado e enviado para o player.');
      } else {
        const asset = await api.createContent(payload);
        setAssetList((value) => [asset, ...value]);
        setMessage(conversionError ? `Conteudo salvo, mas houve erro na conversao: ${conversionError}` : 'Conteudo salvo e enviado para o player.');
      }
      formElement.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao salvar conteudo.');
    } finally {
      setContentSaving(false);
      setContentProgress('');
    }
  }

  async function removeContent(id: string) {
    await api.deleteContent(id);
    setAssetList((value) => value.filter((item) => item.id !== id));
  }

  async function addSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const target = String(form.get('target'));
      const [targetType, targetId] = target.split(':');
      const schedule = await api.createSchedule({
        name: String(form.get('name')),
        playlistId: 'manual',
        assetId: targetType === 'asset' ? targetId : undefined,
        templateId: targetType === 'template' ? targetId : undefined,
        noticeId: targetType === 'notice' ? targetId : undefined,
        screenGroup: String(form.get('screenGroup') || ''),
        startsAt: String(form.get('startsAt')),
        endsAt: String(form.get('endsAt')),
        weekdays: form.getAll('weekdays').map(Number),
      });
      setScheduleList((value) => [schedule, ...value]);
      event.currentTarget.reset();
      setMessage('Agenda salva.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao salvar agenda.');
    }
  }

  async function removeSchedule(id: string) {
    await api.deleteSchedule(id);
    setScheduleList((value) => value.filter((item) => item.id !== id));
  }

  async function addUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const user = await api.createUser({
        name: String(form.get('name')),
        email: String(form.get('email')),
        role: form.get('role') as CorporateUser['role'],
      });
      setUserList((value) => [user, ...value]);
      event.currentTarget.reset();
      setMessage('Usuario criado.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao criar usuario.');
    }
  }

  async function removeUser(id: string) {
    await api.deleteUser(id);
    setUserList((value) => value.filter((item) => item.id !== id));
  }

  async function saveBranding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      setMessage('Salvando identidade visual...');
      let logoUrl = String(form.get('logoUrl') ?? brand.logoUrl ?? '');
      const logo = form.get('logoFile');
      if (logo instanceof File && logo.size > 0) {
        const uploaded = await api.upload(logo);
        logoUrl = uploaded.url;
      }
      let backgroundType = form.get('backgroundType') as BrandingSettings['backgroundType'];
      let backgroundValue = String(form.get('backgroundValue') ?? '');
      const backgroundFile = form.get('backgroundFile');
      let uploadedBackground = false;
      if (backgroundFile instanceof File && backgroundFile.size > 0) {
        const uploaded = await api.upload(backgroundFile);
        backgroundValue = uploaded.url;
        backgroundType = backgroundFile.type.startsWith('video') ? 'video' : 'image';
        uploadedBackground = true;
      }
      const themePreset = String(form.get('themePreset') ?? 'custom');
      if (!uploadedBackground && themePreset === 'dark') {
        backgroundType = 'gradient';
        backgroundValue = 'linear-gradient(135deg,#0f172a,#111827 45%,#1e3a8a)';
      }
      if (!uploadedBackground && themePreset === 'light') {
        backgroundType = 'gradient';
        backgroundValue = 'linear-gradient(135deg,#f8fafc,#dbeafe 55%,#bfdbfe)';
      }
      if (!uploadedBackground && themePreset === 'corporate') {
        backgroundType = 'gradient';
        backgroundValue = 'linear-gradient(135deg,#06142e,#155EEF 52%,#0ea5e9)';
      }
      if (!uploadedBackground && backgroundType === 'gradient' && themePreset === 'custom') {
        const gradientStart = String(form.get('gradientStart') || form.get('secondaryColor') || '#0f172a');
        const gradientEnd = String(form.get('gradientEnd') || form.get('primaryColor') || '#155EEF');
        backgroundValue = `linear-gradient(135deg,${gradientStart},${gradientEnd})`;
      }
      const next = await api.updateBranding({
        logoUrl,
        logoPosition: form.get('logoPosition') as BrandingSettings['logoPosition'],
        backgroundType,
        backgroundValue,
        backgroundFit: form.get('backgroundFit') as BrandingSettings['backgroundFit'],
        primaryColor: String(form.get('primaryColor')),
        secondaryColor: String(form.get('secondaryColor')),
        fontFamily: String(form.get('fontFamily')),
        transition: form.get('transition') as BrandingSettings['transition'],
        exitTransition: form.get('exitTransition') as BrandingSettings['exitTransition'],
      });
      setBrand(next);
      setMessage('Identidade visual salva.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao salvar identidade visual.');
    }
  }

  function applyThemePreset(preset: string) {
    setThemePreset(preset);
    if (preset === 'dark') {
      setBrand((value) => ({
        ...value,
        backgroundType: 'gradient',
        backgroundValue: 'linear-gradient(135deg,#0f172a,#111827 45%,#1e3a8a)',
        primaryColor: '#155EEF',
        secondaryColor: '#0f172a',
      }));
    }
    if (preset === 'light') {
      setBrand((value) => ({
        ...value,
        backgroundType: 'gradient',
        backgroundValue: 'linear-gradient(135deg,#f8fafc,#dbeafe 55%,#bfdbfe)',
        primaryColor: '#155EEF',
        secondaryColor: '#dbeafe',
      }));
    }
    if (preset === 'corporate') {
      setBrand((value) => ({
        ...value,
        backgroundType: 'gradient',
        backgroundValue: 'linear-gradient(135deg,#06142e,#155EEF 52%,#0ea5e9)',
        primaryColor: '#155EEF',
        secondaryColor: '#06142e',
      }));
    }
  }

  async function previewRss(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setMessage('Carregando RSS...');
      const preview = await api.rssPreview(rssUrl);
      setRssItems(preview.items);
      setMessage('RSS carregado.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao carregar RSS.');
    }
  }

  return (
    <div className="mt-6 space-y-6">
      {message ? (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {message}
        </div>
      ) : null}

      <section id="conteudos" className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <form key={editingAsset?.id ?? 'new-content'} onSubmit={addContent} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ImagePlus size={20} />
            {editingAsset ? 'Editar conteudo' : 'Adicionar conteudo'}
          </h2>
          <div className="mt-4 grid gap-3">
            <Input name="name" label="Nome" defaultValue={editingAsset?.name ?? ''} required />
            <label className="text-sm">
              Tipo
              <select name="type" defaultValue={editingAsset?.type ?? 'image'} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
                {contentTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <Input name="url" label="URL, iframe, YouTube ou link externo" defaultValue={editingAsset?.url ?? ''} />
            <label className="text-sm">
              Arquivo local imagem/video/documento
              <input name="file" type="file" accept="image/*,video/*,.mov,.mp4,.webm,.pdf,.docx,.ppt,.pptm,.pptx,.xlsx" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
            </label>
            <Input name="durationSeconds" label="Duracao em segundos" type="number" defaultValue={String(editingAsset?.durationSeconds ?? 15)} required />
            <Input
              name="perSlideSeconds"
              label="PPTX/PDF: segundos por slide"
              type="number"
              min={1}
              defaultValue={String(editingAsset?.metadata?.perSlideSeconds ?? 5)}
            />
            <label className="text-sm">
              PPTX/PDF: transicao entre slides
              <select name="slideTransition" defaultValue={editingAsset?.metadata?.slideTransition ?? 'fade'} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
                {transitionOptions.map((transition) => (
                  <option key={transition}>{transition}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Ajuste na TV
              <select name="fitMode" defaultValue={editingAsset?.metadata?.fitMode ?? 'cover'} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
                <option value="cover">Cobrir tela inteira (pode cortar)</option>
                <option value="contain">Mostrar inteiro com fundo desfocado</option>
              </select>
            </label>
            <label className="text-sm">
              Login para site/dashboard
              <select name="authMode" defaultValue={editingAsset?.metadata?.authMode ?? 'none'} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
                <option value="none">Direto no iframe</option>
                <option value="proxy">Proxy sem login (corrige bloqueio de iframe)</option>
                <option value="basic">HTTP Basic Auth</option>
                <option value="zabbix">Zabbix login por formulario</option>
                <option value="grafana">Grafana login por formulario</option>
                <option value="grafana-image">Grafana imagem para TV LG</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Input name="authUsername" label="Usuario" defaultValue={editingAsset?.metadata?.authUsername ?? ''} autoComplete="off" />
              <Input name="authPassword" label="Senha" type="password" defaultValue={editingAsset?.metadata?.authPassword ?? ''} autoComplete="new-password" />
            </div>
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Para Zabbix comum, use Zabbix login por formulario. Para Grafana em TV LG, use Grafana imagem para TV LG.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input name="fullscreen" type="checkbox" defaultChecked={editingAsset?.metadata?.fullscreen ?? true} />
              Exibir em tela cheia preenchendo tudo
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input name="hideChrome" type="checkbox" defaultChecked={editingAsset?.metadata?.hideChrome ?? true} />
              Ocultar logo, titulo e rodape neste conteudo
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input name="loop" type="checkbox" defaultChecked={editingAsset?.metadata?.loop ?? true} />
              Repetir em loop quando for video/YouTube
            </label>
            {contentSaving ? (
              <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">
                {contentProgress || 'Enviando e processando arquivo...'}
              </div>
            ) : null}
            <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={contentSaving}>
              {contentSaving ? 'Processando...' : editingAsset ? 'Salvar edicao' : 'Salvar conteudo'}
            </button>
            {editingAsset ? (
              <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60" type="button" disabled={contentSaving} onClick={() => setEditingAsset(null)}>
                Cancelar edicao
              </button>
            ) : null}
          </div>
        </form>

        <DataPanel title="Biblioteca">
          {assetList.map((asset) => (
            <Row key={asset.id} title={asset.name} subtitle={`${asset.type} | ${asset.durationSeconds}s | ${asset.url}`}>
              <button onClick={() => setEditingAsset(asset)} title="Editar" type="button" className="mr-3">
                <Pencil size={17} />
              </button>
              <button onClick={() => removeContent(asset.id)} title="Remover" type="button">
                <Trash2 size={17} />
              </button>
            </Row>
          ))}
        </DataPanel>
      </section>

      <section id="agenda" className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <form onSubmit={addSchedule} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <CalendarPlus size={20} />
            Agenda e horarios
          </h2>
          <div className="mt-4 grid gap-3">
            <Input name="name" label="Nome da programacao" required />
            <label className="text-sm">
              O que exibir na programacao
              <select name="target" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
                <optgroup label="Conteudos da biblioteca">
                  {assetList.map((asset) => (
                    <option key={asset.id} value={`asset:${asset.id}`}>
                      {asset.name} ({asset.type})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Avisos">
                  {notices.map((notice) => (
                    <option key={notice.id} value={`notice:${notice.id}`}>
                      {notice.title}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Templates salvos">
                  {templates.map((template) => (
                    <option key={template.id} value={`template:${template.id}`}>
                      {template.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
            <Input name="screenGroup" label="Grupo de telas" defaultValue="Hall" />
            <Input name="startsAt" label="Inicio" type="datetime-local" required />
            <Input name="endsAt" label="Fim" type="datetime-local" />
            <div className="grid grid-cols-7 gap-1 text-xs">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map((day, index) => (
                <label key={day} className="rounded-md border border-slate-200 p-2 text-center">
                  <input name="weekdays" type="checkbox" value={index} className="mr-1" />
                  {day}
                </label>
              ))}
            </div>
            <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white" type="submit">
              Salvar agenda
            </button>
          </div>
        </form>
        <DataPanel title="Programacoes">
          {scheduleList.map((schedule) => (
            <Row key={schedule.id} title={schedule.name} subtitle={`${schedule.startsAt} ate ${schedule.endsAt ?? '-'} | ${schedule.screenGroup ?? 'Todos'}`}>
              <button onClick={() => removeSchedule(schedule.id)} type="button">
                <Trash2 size={17} />
              </button>
            </Row>
          ))}
        </DataPanel>
      </section>

      <section id="identidade" className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <form onSubmit={saveBranding} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Save size={20} />
            Logo, tema e transicoes
          </h2>
          <div className="mt-4 grid gap-3">
            <label className="text-sm">
              URL da logo
              <input
                name="logoUrl"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                value={brand.logoUrl ?? ''}
                onChange={(event) => setBrand((value) => ({ ...value, logoUrl: event.target.value }))}
              />
            </label>
            <label className="text-sm">
              Upload da logo
              <input
                name="logoFile"
                type="file"
                accept="image/*"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) setBrand((value) => ({ ...value, logoUrl: URL.createObjectURL(file) }));
                }}
              />
            </label>
            <Select name="logoPosition" label="Posicao da logo" value={brand.logoPosition} onChange={(event) => setBrand((value) => ({ ...value, logoPosition: event.target.value as BrandingSettings['logoPosition'] }))} options={['top-left', 'top-right', 'bottom-left', 'bottom-right']} />
            <Select name="themePreset" label="Tema pronto" value={themePreset} onChange={(event) => applyThemePreset(event.target.value)} options={['custom', 'dark', 'light', 'corporate']} />
            <Select name="backgroundType" label="Tipo de fundo" value={brand.backgroundType} onChange={(event) => setBrand((value) => ({ ...value, backgroundType: event.target.value as BrandingSettings['backgroundType'] }))} options={['color', 'gradient', 'image', 'video']} />
            <Select name="backgroundFit" label="Ajuste do fundo" value={brand.backgroundFit ?? 'fill'} onChange={(event) => setBrand((value) => ({ ...value, backgroundFit: event.target.value as BrandingSettings['backgroundFit'] }))} options={['fill', 'fit', 'stretch', 'center', 'tile']} />
            {brand.backgroundType === 'gradient' ? (
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  Cor inicial do gradiente
                  <input
                    name="gradientStart"
                    type="color"
                    className="mt-1 h-10 w-full rounded-md border border-slate-300"
                    value={gradientColors(brand).start}
                    onChange={(event) => setBrand((value) => ({ ...value, backgroundValue: `linear-gradient(135deg,${event.target.value},${gradientColors(value).end})` }))}
                  />
                </label>
                <label className="text-sm">
                  Cor final do gradiente
                  <input
                    name="gradientEnd"
                    type="color"
                    className="mt-1 h-10 w-full rounded-md border border-slate-300"
                    value={gradientColors(brand).end}
                    onChange={(event) => setBrand((value) => ({ ...value, backgroundValue: `linear-gradient(135deg,${gradientColors(value).start},${event.target.value})` }))}
                  />
                </label>
              </div>
            ) : null}
            <label className="text-sm">
              Cor, gradiente, imagem ou video de fundo
              <input
                name="backgroundValue"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                value={brand.backgroundValue}
                onChange={(event) => setBrand((value) => ({ ...value, backgroundValue: event.target.value }))}
              />
            </label>
            <label className="text-sm">
              Upload imagem/video de fundo
              <input
                name="backgroundFile"
                type="file"
                accept="image/*,video/*,.mov,.mp4,.webm"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setBrand((value) => ({
                    ...value,
                    backgroundType: file.type.startsWith('video') ? 'video' : 'image',
                    backgroundValue: URL.createObjectURL(file),
                  }));
                }}
              />
            </label>
            <label className="text-sm">
              Cor principal
              <input name="primaryColor" type="color" className="mt-1 h-10 w-full rounded-md border border-slate-300" value={brand.primaryColor} onChange={(event) => setBrand((value) => ({ ...value, primaryColor: event.target.value }))} />
            </label>
            <label className="text-sm">
              Cor secundaria
              <input name="secondaryColor" type="color" className="mt-1 h-10 w-full rounded-md border border-slate-300" value={brand.secondaryColor} onChange={(event) => setBrand((value) => ({ ...value, secondaryColor: event.target.value }))} />
            </label>
            <label className="text-sm">
              Fonte
              <input name="fontFamily" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={brand.fontFamily} onChange={(event) => setBrand((value) => ({ ...value, fontFamily: event.target.value }))} />
            </label>
            <Select name="transition" label="Transicao de entrada do slide" value={brand.transition} onChange={(event) => setBrand((value) => ({ ...value, transition: event.target.value as BrandingSettings['transition'] }))} options={transitionOptions} />
            <Select name="exitTransition" label="Transicao de saida do slide" value={brand.exitTransition ?? brand.transition} onChange={(event) => setBrand((value) => ({ ...value, exitTransition: event.target.value as BrandingSettings['exitTransition'] }))} options={transitionOptions} />
            <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white" type="submit">
              Salvar identidade
            </button>
          </div>
        </form>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Preview da marca</h2>
          <div className="relative mt-4 grid aspect-video place-items-center overflow-hidden rounded-lg p-6 text-white" style={brandingPreviewStyle(brand)}>
            {brand.backgroundType === 'video' && brand.backgroundValue ? (
              <video src={brand.backgroundValue} className={`absolute inset-0 h-full w-full ${backgroundPreviewObjectClass(brand.backgroundFit)}`} autoPlay muted loop playsInline />
            ) : null}
            <div className="absolute inset-0 bg-slate-950/15" />
            <div className={`absolute z-[1] ${logoPreviewClass(brand.logoPosition)}`}>
              {brand.logoUrl ? <img src={brand.logoUrl} alt="Logo" className="max-h-16 max-w-44 object-contain" /> : <span className="rounded bg-white/90 px-4 py-2 font-semibold text-slate-900">Logo Empresa</span>}
            </div>
            <div className="relative z-[1] rounded bg-black/25 px-4 py-2 text-center backdrop-blur">
              <p className="text-sm">Entrada: {brand.transition}</p>
              <p className="text-sm">Saida: {brand.exitTransition ?? brand.transition}</p>
              <p className="text-xs">Fundo: {brand.backgroundType} / {brand.backgroundFit ?? 'fill'}</p>
            </div>
          </div>
        </div>
      </section>

      <section id="usuarios" className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <form onSubmit={addUser} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <UserPlus size={20} />
            Usuarios
          </h2>
          <div className="mt-4 grid gap-3">
            <Input name="name" label="Nome" required />
            <Input name="email" label="Email" type="email" required />
            <Select name="role" label="Perfil" defaultValue="editor" options={['super-admin', 'admin', 'editor', 'operator', 'viewer']} />
            <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white" type="submit">
              Adicionar usuario
            </button>
          </div>
        </form>
        <DataPanel title="Usuarios cadastrados">
          {userList.map((user) => (
            <Row key={user.id} title={user.name} subtitle={`${user.email} | ${user.role}`}>
              <button onClick={() => removeUser(user.id)} type="button">
                <Trash2 size={17} />
              </button>
            </Row>
          ))}
        </DataPanel>
      </section>

      <section id="rss" className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <form onSubmit={previewRss} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Rss size={20} />
            Feed RSS
          </h2>
          <div className="mt-4 grid gap-3">
            <Input name="rssUrl" label="URL do RSS" value={rssUrl} onChange={(event) => setRssUrl(event.currentTarget.value)} />
            <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white" type="submit">
              Carregar RSS
            </button>
            <button
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold"
              type="button"
              onClick={async () => {
                const asset = await api.createContent({ name: 'Feed RSS', type: 'rss', url: rssUrl, durationSeconds: 30 });
                setAssetList((value) => [asset, ...value]);
                setMessage('RSS adicionado como conteudo.');
              }}
            >
              Adicionar RSS ao player
            </button>
          </div>
        </form>
        <DataPanel title="Noticias do feed">
          {rssItems.map((item) => (
            <Row key={item.link || item.title} title={item.title} subtitle={item.description || item.link} />
          ))}
        </DataPanel>
      </section>
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...inputProps } = props;
  return (
    <label className="text-sm">
      {label}
      <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...inputProps} />
    </label>
  );
}

function Select({ label, options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: string[] }) {
  return (
    <label className="text-sm">
      {label}
      <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...props}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function authModeValue(value: FormDataEntryValue | null): NonNullable<ContentAsset['metadata']>['authMode'] {
  return value === 'proxy' || value === 'basic' || value === 'zabbix' || value === 'grafana' || value === 'grafana-image' ? value : 'none';
}

function DataPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3 max-h-[430px] space-y-2 overflow-auto">{children}</div>
    </div>
  );
}

function brandingPreviewStyle(brand: BrandingSettings): React.CSSProperties {
  if (brand.backgroundType === 'image' && brand.backgroundValue) {
    if (brand.backgroundFit === 'tile') {
      return {
        backgroundImage: `url(${brand.backgroundValue})`,
        backgroundPosition: 'center',
        backgroundRepeat: 'repeat',
        backgroundColor: '#0f172a',
      };
    }
    return {
      backgroundImage: `url(${brand.backgroundValue})`,
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundSize: backgroundPreviewSize(brand.backgroundFit),
      backgroundColor: '#0f172a',
    };
  }
  if (brand.backgroundType === 'video') {
    return { background: '#0f172a' };
  }
  return { background: brand.backgroundValue };
}

function gradientColors(brand: BrandingSettings) {
  const matches = brand.backgroundValue.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
  return {
    start: matches[0] ?? brand.secondaryColor ?? '#0f172a',
    end: matches[matches.length - 1] ?? brand.primaryColor ?? '#155EEF',
  };
}

function backgroundPreviewSize(fit?: BrandingSettings['backgroundFit']) {
  if (fit === 'fit') return 'contain';
  if (fit === 'stretch') return '100% 100%';
  if (fit === 'center') return 'auto';
  return 'cover';
}

function backgroundPreviewObjectClass(fit?: BrandingSettings['backgroundFit']) {
  if (fit === 'fit') return 'object-contain';
  if (fit === 'stretch') return 'object-fill';
  if (fit === 'center') return 'object-none';
  return 'object-cover';
}

function logoPreviewClass(position: BrandingSettings['logoPosition']) {
  return {
    'top-left': 'left-4 top-4',
    'top-right': 'right-4 top-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
  }[position];
}

function Row({ title, subtitle, children }: { title: string; subtitle: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{title}</p>
        <p className="truncate text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="shrink-0 text-slate-600">{children}</div>
    </div>
  );
}
