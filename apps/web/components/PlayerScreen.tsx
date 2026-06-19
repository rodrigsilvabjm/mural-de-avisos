'use client';

import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api } from '../lib/api';
import { EmergencyMessage, PlayerPayload } from '../lib/types';

function getWsUrl() {
  if (typeof window !== 'undefined') return window.location.origin;
  return process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:8080';
}
const TEMPLATE_WIDTH = 760;
const TEMPLATE_HEIGHT = 430;

export function PlayerScreen({
  code,
  initialPayload,
}: {
  code: string;
  initialPayload: PlayerPayload;
}) {
  const [payload, setPayload] = useState(initialPayload);
  const [emergency, setEmergency] = useState<EmergencyMessage>(initialPayload.emergency);
  const [index, setIndex] = useState(0);
  const [clock, setClock] = useState('');
  const [slideElapsed, setSlideElapsed] = useState(0);

  const slides = useMemo(() => {
    const contentSlides = payload.assets.map((asset) => ({
      id: asset.id,
      title: asset.name,
      type: effectiveAssetType(asset.type, asset.url),
      body: asset.url,
      tickerText: '',
      tickerPersistent: false,
      displayMode: 'dark',
      duration: effectiveAssetType(asset.type, asset.url) === 'video' ? Math.max(15, asset.durationSeconds || 15) : asset.durationSeconds,
      metadata: asset.metadata ?? {},
    }));
    const noticeSlides = payload.notices
      .filter((notice) => isNoticeActive(notice.startsAt, notice.endsAt))
      .map((notice) => ({
        id: notice.id,
        title: notice.title,
        type: 'notice',
        body: notice.bodyHtml,
        tickerText: notice.tickerText,
        tickerPersistent: notice.tickerPersistent ?? false,
        displayMode: 'dark',
        duration: notice.durationSeconds || (notice.priority === 'urgent' ? 20 : 12),
        metadata: {},
      }));
    const templateSlides = (payload.templates ?? []).map((template) => ({
      id: template.id,
      title: template.name,
      type: 'template',
      body: template.items,
      tickerText: '',
      tickerPersistent: false,
      duration: template.durationSeconds ?? 25,
      displayMode: template.displayMode ?? 'dark',
      metadata: {},
    }));
    return [...templateSlides, ...noticeSlides, ...contentSlides];
  }, [payload]);

  useEffect(() => {
    void refresh();

    const socket = io(getWsUrl(), {
      transports: ['websocket'],
      reconnection: true,
    });

    socket.emit('player:hello', { code, userAgent: navigator.userAgent });
    socket.on('content:refresh', refresh);
    socket.on('emergency', setEmergency);
    socket.on('connect', () => {
      socket.emit('player:hello', { code, userAgent: navigator.userAgent });
    });
    const refreshTimer = window.setInterval(refresh, 5000);

    return () => {
      window.clearInterval(refreshTimer);
      socket.disconnect();
    };

    async function refresh() {
      const next = await api.player(code);
      setPayload(next);
      setEmergency(next.emergency);
    }
  }, [code]);

  const timerSlide = slides[index % Math.max(slides.length, 1)];
  const timerSlideId = timerSlide?.id;
  const timerSlideDuration = timerSlide?.duration;

  useEffect(() => {
    setSlideElapsed(0);
    if (!timerSlideId || emergency.active) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setSlideElapsed((Date.now() - startedAt) / 1000);
    }, 200);
    return () => window.clearInterval(timer);
  }, [emergency.active, index, timerSlideId]);

  useEffect(() => {
    if (slides.length === 0 || emergency.active || !timerSlideId) return;
    const durationSeconds = Math.max(1, Number(timerSlideDuration) || 10);
    const timer = window.setTimeout(() => {
      setIndex((value) => (value + 1) % slides.length);
    }, durationSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [emergency.active, index, slides.length, timerSlideDuration, timerSlideId]);

  useEffect(() => {
    if (slides.length > 0 && index >= slides.length) {
      setIndex(0);
    }
  }, [index, slides.length]);

  useEffect(() => {
    const updateClock = () => setClock(new Date().toLocaleTimeString('pt-BR'));
    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const enterFullscreen = () => {
      if (!document.fullscreenElement) {
        void document.documentElement.requestFullscreen().catch(() => undefined);
      }
    };
    window.addEventListener('click', enterFullscreen, { once: true });
    return () => window.removeEventListener('click', enterFullscreen);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      document.querySelectorAll('video').forEach((video) => {
        video.muted = true;
        video.playsInline = true;
        video.play().catch(() => undefined);
      });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [timerSlideId, emergency.active, index]);

  if (emergency.active) {
    return (
      <main className="player-safe-area grid place-items-center bg-red-700 text-white">
        <section className="px-8 text-center">
          <h1 className="text-[clamp(2rem,7vw,5rem)] font-black tracking-wide">{emergency.title}</h1>
          {emergency.bodyHtml ? (
            <div
              className="notice-body mx-auto mt-8 max-w-6xl text-[clamp(1.35rem,3.4vw,2.5rem)] font-extrabold leading-normal"
              dangerouslySetInnerHTML={{ __html: normalizeHtmlMedia(emergency.bodyHtml) }}
            />
          ) : (
            <div className="mt-8 space-y-4">
              {emergency.lines.map((line) => (
                <p key={line} className="text-[clamp(1.35rem,3.4vw,2.5rem)] font-extrabold">
                  {line}
                </p>
              ))}
            </div>
          )}
        </section>
      </main>
    );
  }

  const active = slides[index % Math.max(slides.length, 1)];
  const persistentTicker = payload.notices.find(
    (notice) => notice.tickerPersistent && notice.tickerText && isNoticeActive(notice.startsAt, notice.endsAt),
  )?.tickerText;
  const activeTicker = active?.tickerText || persistentTicker || '';
  const activeMetadata = (active?.metadata ?? {}) as NonNullable<PlayerPayload['assets'][number]['metadata']>;
  const activeType = String(active?.type);
  const activeTemplateItems =
    active?.type === 'template'
      ? (active.body as NonNullable<PlayerPayload['templates']>[number]['items'])
      : [];
  const isFullscreenTemplate = hasFullBleedMedia(activeTemplateItems);
  const isFullscreenMedia =
    (Boolean(activeMetadata.fullscreen) || (['image', 'video'].includes(activeType) && Boolean(activeMetadata.hideChrome))) &&
    ['youtube', 'webpage', 'external-link', 'dashboard', 'image', 'video', 'pptx', 'pptm', 'ppt', 'pdf'].includes(activeType);
  const shouldHideChrome = (isFullscreenMedia && activeMetadata.hideChrome) || isFullscreenTemplate;
  const branding = payload.branding;
  const logoClasses = {
    'top-left': 'left-8 top-6',
    'top-right': 'right-8 top-6',
    'bottom-left': 'bottom-8 left-8',
    'bottom-right': 'bottom-8 right-8',
  };
  const transitionStyle = {
    enter: transitionAnimationStyle(branding?.transition ?? 'fade', 'in'),
    exit: transitionAnimationStyle(branding?.exitTransition ?? branding?.transition ?? 'fade', 'out'),
  };
  const isSlideExiting = slideElapsed >= Math.max(0, Number(active?.duration ?? 0) - 0.7);

  return (
    <main className="player-safe-area text-white">
      <div
        className="relative h-full w-full overflow-hidden"
        style={{
          ...backgroundStyle(branding),
          fontFamily: branding?.fontFamily,
        }}
      >
        <div className="absolute inset-0 z-0">
        {branding?.backgroundType === 'image' && branding.backgroundValue ? (
          <ImageBackdrop url={branding.backgroundValue} fit={branding.backgroundFit ?? 'fill'} />
        ) : null}
        {branding?.backgroundType === 'video' && branding.backgroundValue ? (
          <video
            src={mediaUrl(branding.backgroundValue)}
            className={`absolute inset-0 h-full w-full ${backgroundObjectClass(branding.backgroundFit ?? 'fill')}`}
            autoPlay
            muted
            loop
            playsInline
          />
        ) : null}
        <div className="absolute inset-0 bg-slate-950/15" />
        </div>

        {!shouldHideChrome ? (
          <div
            className={`absolute z-10 rounded-md text-xl font-bold text-slate-900 ${
              branding?.logoUrl ? '' : 'bg-white px-4 py-2'
            } ${logoClasses[branding?.logoPosition ?? 'top-left']}`}
          >
            {branding?.logoUrl ? (
              <img src={mediaUrl(branding.logoUrl)} alt="Logo" className="max-h-16 max-w-48 object-contain" />
            ) : (
              'Logo Empresa'
            )}
          </div>
        ) : null}

        {!shouldHideChrome ? (
        <header className="absolute inset-x-8 top-6 z-10 flex items-center justify-end">
          <div className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur">
            {payload.screen.name ?? code} | {clock}
          </div>
        </header>
        ) : null}

        <section
          className={
            active?.type === 'template' || isFullscreenMedia
              ? 'relative z-[1] h-full w-full px-0 pt-0'
              : 'relative z-[1] grid h-full place-items-center px-10 pt-20'
          }
        >
          {active ? (
            <div
              key={`${active.id}-${index}`}
              className={
                active.type === 'template' || isFullscreenMedia ? 'h-full w-full' : 'w-full max-w-5xl'
              }
              style={isSlideExiting ? transitionStyle.exit : transitionStyle.enter}
            >
              {isFullscreenMedia ? (
                <FullscreenMedia
                  type={String(active.type)}
                  url={String(active.body)}
                  title={active.title}
                  fitMode={fullscreenFitMode(activeMetadata.fitMode)}
                  loop={activeMetadata.loop ?? true}
                  metadata={activeMetadata}
                />
              ) : active.type === 'template' ? (
                <TemplateSlide
                  items={activeTemplateItems}
                  displayMode={active.displayMode === 'light' ? 'light' : 'dark'}
                  fullscreen={isFullscreenTemplate}
                  branding={branding}
                  elapsed={slideElapsed}
                  duration={Number(active.duration) || 25}
                />
              ) : (
              <article className="w-full text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.35em]" style={{ color: branding?.primaryColor ?? '#bfdbfe' }}>
                  {active.type}
                </p>
                <h1 className="mt-[clamp(0.75rem,2vw,1.5rem)] text-[clamp(2rem,5.5vw,4.5rem)] font-black leading-tight">{active.title}</h1>
                {active.type === 'notice' ? (
                <>
                  <div
                    className="notice-body mx-auto mt-[clamp(0.75rem,2vw,2rem)] max-w-5xl text-[clamp(1.15rem,2.7vw,1.9rem)] leading-normal text-blue-50"
                    dangerouslySetInnerHTML={{ __html: normalizeHtmlMedia(String(active.body)) }}
                  />
                </>
              ) : active.type === 'rss' ? (
                <RssContent url={String(active.body)} />
              ) : active.type === 'youtube' ? (
                <EmbeddedContent url={String(active.body)} title={active.title} kind="youtube" loop={activeMetadata.loop ?? true} />
              ) : ['webpage', 'external-link', 'dashboard'].includes(String(active.type)) ? (
                <EmbeddedContent
                  url={String(active.body)}
                  title={active.title}
                  kind="web"
                  authMode={activeMetadata.authMode}
                  authUsername={activeMetadata.authUsername}
                  authPassword={activeMetadata.authPassword}
                />
              ) : ['pptx', 'pptm', 'ppt', 'pdf', 'docx', 'xlsx'].includes(String(active.type)) ? (
                <DocumentContent type={String(active.type)} url={String(active.body)} title={active.title} metadata={activeMetadata} />
              ) : active.type === 'image' ? (
                <div className="mx-auto mt-[clamp(0.75rem,2vw,2rem)] h-[min(68svh,680px)] w-full max-w-5xl overflow-hidden rounded-lg shadow-soft">
                  <MediaFrame type="image" url={String(active.body)} title={active.title} fitMode="contain" />
                </div>
              ) : active.type === 'video' ? (
                <div className="mx-auto mt-[clamp(0.75rem,2vw,2rem)] h-[min(68svh,680px)] w-full max-w-5xl overflow-hidden rounded-lg shadow-soft">
                  <MediaFrame type="video" url={String(active.body)} title={active.title} fitMode="contain" loop />
                </div>
              ) : (
                <div className="mx-auto mt-[clamp(0.75rem,2vw,2rem)] grid h-[min(42svh,20rem)] max-w-4xl place-items-center rounded-lg border border-white/25 bg-white/10 p-8 text-[clamp(1.1rem,2.6vw,1.875rem)] font-semibold shadow-soft backdrop-blur">
                  {String(active.body)}
                </div>
              )}
              </article>
              )}
            </div>
          ) : (
            <section className="text-center">
              <h1 className="text-[clamp(2rem,5vw,3rem)] font-black">TV aguardando conteudo</h1>
              <p className="mt-4 text-2xl text-blue-100">Codigo: {code}</p>
            </section>
          )}
        </section>

        {activeTicker ? <Ticker text={String(activeTicker)} /> : null}
      </div>
    </main>
  );
}

function isNoticeActive(startsAt?: string, endsAt?: string) {
  const now = Date.now();
  const starts = startsAt ? new Date(startsAt).getTime() : 0;
  const ends = endsAt ? new Date(endsAt).getTime() : Number.POSITIVE_INFINITY;
  return (Number.isNaN(starts) || starts <= now) && (Number.isNaN(ends) || ends >= now);
}

function backgroundStyle(branding: PlayerPayload['branding']): CSSProperties {
  const primary = branding?.primaryColor ?? '#155EEF';
  const secondary = branding?.secondaryColor ?? '#0f172a';
  const fallback = `linear-gradient(135deg, ${secondary}, #111827 45%, ${primary})`;
  if (!branding?.backgroundValue) return { background: fallback };
  if (branding.backgroundType === 'image') {
    return {
      backgroundColor: secondary,
    };
  }
  if (branding.backgroundType === 'video') {
    return { background: secondary };
  }
  if (branding.backgroundType === 'color') {
    return { background: branding.backgroundValue || secondary };
  }
  return { background: branding.backgroundValue };
}

function mediaUrl(url: string) {
  if (!url) return '';
  return url.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/media\//i, '/media/');
}

function effectiveAssetType(type: string, url: string) {
  if (/\.(mp4|webm|mov)(\?|#|$)/i.test(url)) return 'video';
  if (/\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(url)) return 'image';
  return type;
}

function normalizeHtmlMedia(html: string) {
  return html.replace(/https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/media\//gi, '/media/');
}

function Ticker({ text }: { text: string }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 overflow-hidden bg-red-600/95 py-3 text-white shadow-2xl">
      <div className="ticker-track whitespace-nowrap text-[clamp(1.15rem,2.6vw,1.875rem)] font-black uppercase tracking-wide">
        <span className="px-12">{text}</span>
        <span className="px-12">{text}</span>
      </div>
    </div>
  );
}

function ImageBackdrop({ url, fit }: { url: string; fit: NonNullable<PlayerPayload['branding']>['backgroundFit'] }) {
  const src = mediaUrl(url);
  if (fit === 'tile') {
    return <div className="absolute inset-0" style={{ backgroundImage: `url(${src})`, backgroundRepeat: 'repeat', backgroundPosition: 'center' }} />;
  }
  if (fit === 'stretch') {
    return <img src={src} alt="" aria-hidden className="absolute inset-0 h-full w-full opacity-90" />;
  }
  if (fit === 'center') {
    return (
      <>
        <img src={src} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-45 blur-2xl" />
        <img src={src} alt="" aria-hidden className="absolute left-1/2 top-1/2 max-h-full max-w-full -translate-x-1/2 -translate-y-1/2 opacity-95" />
      </>
    );
  }
  return (
    <>
      <img src={src} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-45 blur-2xl" />
      <img src={src} alt="" aria-hidden className={`absolute inset-0 h-full w-full opacity-90 ${backgroundObjectClass(fit)}`} />
    </>
  );
}

function backgroundObjectClass(fit?: NonNullable<PlayerPayload['branding']>['backgroundFit']) {
  if (fit === 'fit') return 'object-contain';
  if (fit === 'stretch') return 'object-fill';
  if (fit === 'center') return 'object-none';
  return 'object-cover';
}

function TemplateSlide({
  items,
  displayMode,
  className,
  fullscreen = false,
  branding,
  elapsed,
  duration,
}: {
  items: NonNullable<PlayerPayload['templates']>[number]['items'];
  displayMode: 'dark' | 'light';
  className?: string;
  fullscreen?: boolean;
  branding?: PlayerPayload['branding'];
  elapsed: number;
  duration: number;
}) {
  return (
    <div
      className={`grid h-full w-full place-items-center overflow-hidden ${fullscreen ? 'p-0' : 'p-[clamp(10px,2vw,28px)]'} ${
        displayMode === 'light' ? 'text-slate-950' : 'text-white'
      } ${className ?? ''}`}
      style={{
        background: 'transparent',
        color: displayMode === 'light' ? '#0f172a' : '#ffffff',
        '--brand-primary': branding?.primaryColor ?? '#155EEF',
        '--brand-secondary': branding?.secondaryColor ?? '#0f172a',
      } as CSSProperties}
    >
      <div className={`relative overflow-hidden ${fullscreen ? 'h-full w-full' : 'aspect-video w-full max-h-full max-w-full'}`}>
        {items.map((item) => (
          <TemplatePlacedItem key={item.id} item={item} elapsed={elapsed} slideDuration={duration} />
        ))}
      </div>
    </div>
  );
}

function hasFullBleedMedia(items: NonNullable<PlayerPayload['templates']>[number]['items']) {
  return items.some((item) => {
    const data = asRecord(item.data);
    return data.fullBleed === true && ['image', 'video', 'iframe'].includes(item.kind);
  });
}

function TemplatePlacedItem({
  item,
  elapsed,
  slideDuration,
}: {
  item: NonNullable<PlayerPayload['templates']>[number]['items'][number];
  elapsed: number;
  slideDuration: number;
}) {
  const data = asRecord(item.data);
  const fullBleed = data.fullBleed === true;
  const transition = typeof data.transition === 'string' ? data.transition : 'none';
  const exitTransition = typeof data.exitTransition === 'string' ? data.exitTransition : transition;
  const rawStart = data.startSecond === undefined || data.startSecond === '' ? 1 : Number(data.startSecond);
  const startSecond = Math.max(0, Number.isFinite(rawStart) ? rawStart : 1);
  const durationSecond = Math.max(0, Number(data.durationSecond ?? 0) || 0);
  const explicitEnd = Math.max(0, Number(data.endSecond ?? 0) || 0);
  const endSecond = durationSecond > 0 ? startSecond + durationSecond : explicitEnd > 0 ? explicitEnd : slideDuration;
  const width = Math.max(1, Math.min(item.width, TEMPLATE_WIDTH));
  const height = Math.max(1, Math.min(item.height, TEMPLATE_HEIGHT));
  const x = Math.max(0, Math.min(item.x, TEMPLATE_WIDTH - width));
  const y = Math.max(0, Math.min(item.y, TEMPLATE_HEIGHT - height));

  if (elapsed < startSecond || elapsed > endSecond) return null;
  const isLeaving = endSecond < slideDuration && elapsed >= Math.max(startSecond, endSecond - 0.7);

  return (
    <div
      className={`absolute grid place-items-center overflow-hidden text-center font-semibold ${
        ['image', 'video', 'iframe'].includes(item.kind) ? 'p-0' : 'p-3'
      }`}
      style={{
        left: fullBleed ? '0%' : `${(x / TEMPLATE_WIDTH) * 100}%`,
        top: fullBleed ? '0%' : `${(y / TEMPLATE_HEIGHT) * 100}%`,
        width: fullBleed ? '100%' : `${(width / TEMPLATE_WIDTH) * 100}%`,
        height: fullBleed ? '100%' : `${(height / TEMPLATE_HEIGHT) * 100}%`,
        zIndex: item.zIndex,
        ...transitionAnimationStyle(isLeaving ? exitTransition : transition, isLeaving ? 'out' : 'in'),
        ...modernWidgetStyle(item),
      }}
    >
      <TemplateItem item={item} />
    </div>
  );
}

function widgetTransitionClass(transition: string) {
  return transitionAnimationClass(transition, 'in');
}

function transitionAnimationClass(transition: string, direction: 'in' | 'out') {
  const animation = transitionAnimationName(transition, direction);
  return animation ? `animate-[${animation}_.7s_ease_forwards]` : '';
}

function transitionAnimationStyle(transition: string, direction: 'in' | 'out'): CSSProperties {
  const animation = transitionAnimationName(transition, direction);
  return animation ? { animation: `${animation} .7s ease forwards` } : {};
}

function transitionAnimationName(transition: string, direction: 'in' | 'out') {
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

function modernWidgetStyle(item: NonNullable<PlayerPayload['templates']>[number]['items'][number]): CSSProperties {
  const rawStyle = asRecord(item.style) as CSSProperties;
  const data = asRecord(item.data);
  const fullBleed = data.fullBleed === true;
  const style = {
    ...rawStyle,
    backgroundImage:
      typeof rawStyle.backgroundImage === 'string'
        ? rawStyle.backgroundImage.replace(/https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/media\//gi, '/media/')
        : rawStyle.backgroundImage,
  } as CSSProperties;
  const background = String(style.background ?? '').toLowerCase();
  const isPlainWhite = background === '#ffffff' || background === 'white' || background === 'rgb(255, 255, 255)';

  if (fullBleed && ['image', 'video', 'iframe'].includes(item.kind)) {
    return {
      ...style,
      background: item.kind === 'iframe' ? '#000000' : 'transparent',
      border: 0,
      borderRadius: 0,
      boxShadow: 'none',
      padding: 0,
    };
  }

  if (item.kind === 'image' || item.kind === 'video') {
    return {
      ...style,
      background: 'transparent',
      borderRadius: style.borderRadius ?? 18,
      boxShadow: style.boxShadow ?? '0 24px 70px rgba(0,0,0,0.32)',
      padding: 0,
    };
  }

  if (item.kind === 'rss') {
    return {
      ...style,
      background: isPlainWhite ? 'rgba(255,255,255,0.96)' : style.background,
      borderRadius: style.borderRadius ?? 22,
      boxShadow: style.boxShadow ?? '0 24px 70px rgba(0,0,0,0.24)',
      backdropFilter: 'blur(10px)',
    };
  }

  if (item.kind === 'text' && isPlainWhite) {
    return {
      ...style,
      background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand-secondary) 88%, transparent), color-mix(in srgb, var(--brand-primary) 68%, transparent))',
      color: '#ffffff',
      borderRadius: 22,
      boxShadow: '0 24px 70px rgba(0,0,0,0.28)',
      backdropFilter: 'blur(12px)',
    };
  }

  if (item.kind === 'qr' && isPlainWhite) {
    return {
      ...style,
      background: 'rgba(255,255,255,0.94)',
      borderRadius: 22,
      boxShadow: '0 24px 70px rgba(0,0,0,0.24)',
    };
  }

  return {
    ...style,
    borderRadius: style.borderRadius ?? 18,
  };
}

function TemplateItem({ item }: { item: NonNullable<PlayerPayload['templates']>[number]['items'][number] }) {
  const data = asRecord(item.data);
  const content = String(data.content ?? data.label ?? '');
  const sourceUrl = mediaUrl(String(data.sourceUrl ?? ''));
  const fitMode = data.fitMode === 'contain' ? 'contain' : 'cover';
  const loop = data.loop !== false;
  if (item.kind === 'image' && sourceUrl) {
    return <MediaFrame type="image" url={sourceUrl} title={content} fitMode={fitMode} />;
  }
  if (item.kind === 'video' && sourceUrl) {
    return <MediaFrame type="video" url={sourceUrl} title={content} fitMode={fitMode} loop={loop} />;
  }
  if (item.kind === 'iframe') {
    return sourceUrl ? (
      <EmbeddedContent url={sourceUrl} title={content || sourceUrl} kind="web" compact loop={loop} />
    ) : (
      <span>{content}</span>
    );
  }
  if (item.kind === 'qr') {
    return <span className="break-all">QR: {sourceUrl || content}</span>;
  }
  if (item.kind === 'rss') {
    return <RssContent url={sourceUrl || content} compact />;
  }
  return <div className="w-full" dangerouslySetInnerHTML={{ __html: content }} />;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function EmbeddedContent({
  url,
  title,
  kind,
  compact = false,
  loop = true,
  authMode,
  authUsername,
  authPassword,
}: {
  url: string;
  title: string;
  kind: 'youtube' | 'web';
  compact?: boolean;
  loop?: boolean;
  authMode?: string;
  authUsername?: string;
  authPassword?: string;
}) {
  const authenticatedUrl = authMode === 'basic' ? withBasicAuth(url, authUsername, authPassword) : url;
  const embedUrl = kind === 'youtube' ? toYouTubeEmbed(authenticatedUrl, loop) : toEmbeddableUrl(authenticatedUrl, authMode, authUsername, authPassword);

  if (!embedUrl) {
    return (
      <div className="grid h-full w-full place-items-center rounded-lg bg-white/95 p-6 text-center text-slate-900">
        <div>
          <p className="text-xl font-black">{title}</p>
          <p className="mt-2 break-all text-sm text-slate-600">{url}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full w-full overflow-hidden rounded-lg bg-black shadow-soft ${compact ? '' : 'mx-auto mt-8 max-h-[72svh] max-w-6xl'}`}>
      <iframe
        src={embedUrl}
        title={title}
        className={`${compact ? 'h-full' : 'h-full min-h-[320px]'} w-full border-0`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}

function FullscreenMedia({
  type,
  url,
  title,
  fitMode,
  loop,
  metadata,
}: {
  type: string;
  url: string;
  title: string;
  fitMode: 'cover' | 'contain';
  loop: boolean;
  metadata?: NonNullable<PlayerPayload['assets'][number]['metadata']>;
}) {
  if (['pptx', 'pptm', 'ppt', 'pdf', 'docx', 'xlsx'].includes(type)) {
    return <DocumentContent type={type} url={url} title={title} metadata={metadata} fullscreen />;
  }

  if (type === 'image') {
    return <MediaFrame type="image" url={url} title={title} fitMode={fitMode} fullscreen />;
  }

  if (type === 'video') {
    return <MediaFrame type="video" url={url} title={title} fitMode={fitMode} loop={loop} fullscreen />;
  }

  const kind = type === 'youtube' || isYouTubeUrl(url) ? 'youtube' : 'web';
  const authenticatedUrl = metadata?.authMode === 'basic' ? withBasicAuth(url, metadata.authUsername, metadata.authPassword) : url;
  const embedUrl = kind === 'youtube' ? toYouTubeEmbed(authenticatedUrl, loop) : toEmbeddableUrl(authenticatedUrl, metadata?.authMode, metadata?.authUsername, metadata?.authPassword);

  return (
    <iframe
      src={embedUrl}
      title={title}
      className="h-full w-full border-0 bg-black"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
      allowFullScreen
    />
  );
}

function DocumentContent({
  type,
  url,
  title,
  metadata,
  fullscreen = false,
}: {
  type: string;
  url: string;
  title: string;
  metadata?: NonNullable<PlayerPayload['assets'][number]['metadata']>;
  fullscreen?: boolean;
}) {
  const slides = Array.isArray(metadata?.slides) ? metadata.slides.filter(Boolean) : [];
  const perSlideSeconds = Math.max(1, Number(metadata?.perSlideSeconds) || 5);
  const conversionError = metadata?.conversionError;

  if (slides.length > 0) {
    return (
      <DocumentSlideShow
        slides={slides}
        title={title}
        perSlideSeconds={perSlideSeconds}
        fitMode={fullscreenFitMode(metadata?.fitMode)}
        transition={metadata?.slideTransition ?? 'fade'}
        fullscreen={fullscreen}
      />
    );
  }

  if (type === 'pdf') {
    return (
      <iframe
        src={`${mediaUrl(url)}#toolbar=0&navpanes=0&scrollbar=0`}
        title={title}
        className={`${fullscreen ? 'h-full w-full' : 'h-[70svh] w-full'} border-0 bg-white`}
      />
    );
  }

  const officeUrl = toOfficeViewerUrl(url);
  if (officeUrl) {
    return (
      <iframe
        src={officeUrl}
        title={title}
        className={`${fullscreen ? 'h-full w-full' : 'h-[70svh] w-full'} border-0 bg-white`}
        allowFullScreen
      />
    );
  }

  return (
    <div className={`${fullscreen ? 'h-full w-full' : 'mx-auto mt-8 min-h-[min(360px,70svh)] max-w-5xl'} grid place-items-center bg-white p-10 text-center text-slate-950`}>
      <div>
        <p className="text-[clamp(1.35rem,3vw,1.875rem)] font-black">{title}</p>
        <p className="mt-4 text-xl">Este arquivo foi salvo, mas ainda nao tem slides convertidos para exibir automaticamente.</p>
        {conversionError ? <p className="mt-3 text-base text-red-700">{friendlyConversionError(String(conversionError))}</p> : null}
        <p className="mt-3 text-base text-slate-700">Tente reenviar o arquivo ou salvar no PowerPoint como PPTX/PDF antes de enviar.</p>
        <p className="mt-4 break-all text-sm text-slate-600">{url}</p>
      </div>
    </div>
  );
}

function DocumentSlideShow({
  slides,
  title,
  perSlideSeconds,
  fitMode,
  transition,
  fullscreen,
}: {
  slides: string[];
  title: string;
  perSlideSeconds: number;
  fitMode: 'cover' | 'contain';
  transition: string;
  fullscreen: boolean;
}) {
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    setSlideIndex(0);
    if (slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setSlideIndex((value) => (value + 1) % slides.length);
    }, perSlideSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [perSlideSeconds, slides.length]);

  return (
    <div key={`${slides[slideIndex]}-${slideIndex}`} className="h-full w-full" style={transitionAnimationStyle(transition, 'in')}>
      <MediaFrame
        type="image"
        url={slides[slideIndex]}
        title={`${title} - slide ${slideIndex + 1}`}
        fitMode={fitMode}
        fullscreen={fullscreen}
      />
    </div>
  );
}

function fullscreenFitMode(fitMode?: 'cover' | 'contain') {
  return fitMode === 'contain' ? 'contain' : 'cover';
}

function toEmbeddableUrl(url: string, authMode?: string, username?: string, password?: string) {
  if (!url) return '';
  if (isYouTubeUrl(url)) return toYouTubeEmbed(url);
  if (authMode === 'proxy' || authMode === 'basic' || authMode === 'zabbix' || authMode === 'grafana' || authMode === 'grafana-image') {
    return proxiedFrameUrl(url, authMode, username, password);
  }
  return url;
}

function withBasicAuth(rawUrl: string, username?: string, password?: string) {
  if (!rawUrl || !username) return rawUrl;
  try {
    const url = new URL(rawUrl);
    url.username = username;
    url.password = password ?? '';
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function proxiedFrameUrl(rawUrl: string, authMode?: string, username?: string, password?: string) {
  const params = new URLSearchParams({ url: rawUrl, authMode: authMode ?? 'proxy', proxyVersion: 'grafana-unified-1' });
  if (username) params.set('username', username);
  if (password) params.set('password', password);
  return `/api/proxy/frame?${params.toString()}`;
}

function toOfficeViewerUrl(rawUrl: string) {
  const absoluteUrl = absolutePublicUrl(rawUrl);
  if (!absoluteUrl || isLocalUrl(absoluteUrl)) return '';
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(absoluteUrl)}`;
}

function absolutePublicUrl(rawUrl: string) {
  if (!rawUrl) return '';
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  if (typeof window === 'undefined') return rawUrl;
  return new URL(mediaUrl(rawUrl), window.location.origin).toString();
}

function isLocalUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    return ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  } catch {
    return rawUrl.startsWith('/media/');
  }
}

function friendlyConversionError(error: string) {
  if (!error) return 'Nao foi possivel converter este arquivo.';
  if (/source\.(ppt|pptm|pptx)|soffice|convert-to|command failed/i.test(error)) {
    return 'Nao foi possivel converter a apresentacao automaticamente.';
  }
  return error.length > 220 ? `${error.slice(0, 220)}...` : error;
}

function MediaFrame({
  type,
  url,
  title,
  fitMode,
  loop = true,
  fullscreen = false,
}: {
  type: 'image' | 'video';
  url: string;
  title: string;
  fitMode: 'cover' | 'contain';
  loop?: boolean;
  fullscreen?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaClass = fitMode === 'cover' ? 'object-cover' : 'object-contain';
  const sizeClass = fullscreen ? 'h-full w-full' : 'h-full w-full';

  useEffect(() => {
    if (type !== 'video' || !videoRef.current) return;
    const video = videoRef.current;
    video.muted = true;
    video.playsInline = true;
    video.play().catch(() => undefined);
  }, [type, url]);

  return (
    <div className={`relative overflow-hidden bg-black ${sizeClass}`}>
      {fitMode === 'contain' ? (
        type === 'image' ? (
          <img
            src={mediaUrl(url)}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-2xl"
          />
        ) : (
          <video
            src={mediaUrl(url)}
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-2xl"
            autoPlay
            muted
            loop
            playsInline
          />
        )
      ) : null}
      {fitMode === 'contain' ? <div className="absolute inset-0 bg-black/20" /> : null}
      {type === 'image' ? (
        <img src={mediaUrl(url)} alt={title} className={`relative z-[1] h-full w-full ${mediaClass}`} />
      ) : (
        <video
          ref={videoRef}
          src={mediaUrl(url)}
          className={`relative z-[1] h-full w-full ${mediaClass}`}
          autoPlay
          muted
          loop={loop}
          playsInline
          preload="auto"
        />
      )}
    </div>
  );
}

function isYouTubeUrl(url: string) {
  return /youtube\.com|youtu\.be/.test(url);
}

function toYouTubeEmbed(rawUrl: string, loop = true) {
  try {
    const decoded = decodeURIComponent(rawUrl);
    const url = new URL(decoded);
    let id = '';
    if (url.hostname.includes('youtu.be')) {
      id = url.pathname.split('/').filter(Boolean)[0] ?? '';
    } else if (url.pathname.startsWith('/shorts/')) {
      id = url.pathname.split('/').filter(Boolean)[1] ?? '';
    } else if (url.pathname.startsWith('/embed/')) {
      id = url.pathname.split('/').filter(Boolean)[1] ?? '';
    } else {
      id = url.searchParams.get('v') ?? '';
    }
    if (!id) return decoded;
    const params = new URLSearchParams({
      autoplay: '1',
      mute: '1',
      rel: '0',
      controls: '0',
      playsinline: '1',
      modestbranding: '1',
    });
    if (loop) {
      params.set('loop', '1');
      params.set('playlist', id);
    }
    return `https://www.youtube.com/embed/${id}?${params.toString()}`;
  } catch {
    return rawUrl;
  }
}

function RssContent({ url, compact = false }: { url: string; compact?: boolean }) {
  const [items, setItems] = useState<Array<{ title: string; link: string; description: string }>>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!url) return;
    let mounted = true;
    api
      .rssPreview(url)
      .then((result) => {
        if (mounted) setItems(result.items);
      })
      .catch(() => {
        if (mounted) setError('Nao foi possivel carregar o RSS.');
      });
    return () => {
      mounted = false;
    };
  }, [url]);

  if (error) {
    return <span className="text-red-700">{error}</span>;
  }

  if (items.length === 0) {
    return <span>Carregando RSS...</span>;
  }

  return (
    <div className={`w-full overflow-hidden text-left ${compact ? 'h-full p-2' : 'mx-auto max-h-[58svh] max-w-5xl rounded-lg bg-white/95 p-[clamp(1rem,2vw,2rem)] text-slate-950'}`}>
      <div className={`${compact ? 'mb-2 text-sm' : 'mb-5 text-2xl'} font-black text-red-700`}>
        G1 | Ultimas noticias
      </div>
      <div className="space-y-3">
        {items.slice(0, compact ? 4 : 4).map((item) => (
          <article key={item.link || item.title} className="border-b border-slate-200 pb-2 last:border-0">
            <h3 className={`${compact ? 'text-sm' : 'text-xl'} font-bold leading-tight text-slate-950`}>
              {item.title}
            </h3>
            {!compact && item.description ? (
              <p className="mt-1 line-clamp-2 text-base text-slate-600">{item.description}</p>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
