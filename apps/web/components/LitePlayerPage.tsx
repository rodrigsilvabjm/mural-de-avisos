import { PlayerPayload } from '../lib/types';

type LiteSlide = {
  id: string;
  title: string;
  type: string;
  body: unknown;
  duration: number;
  metadata?: Record<string, unknown>;
  displayMode?: 'dark' | 'light';
  transition?: string;
  fitMode?: string;
};

export function LitePlayerPage({ code, payload }: { code: string; payload: PlayerPayload }) {
  const slides = buildLiteSlides(payload);
  const firstSlide = slides[0];
  const branding = payload.branding;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: liteCss() }} />
      <main id="stage" style={backgroundStyle(branding)}>
        {branding?.backgroundType === 'image' && branding.backgroundValue ? (
          <img id="brand-bg-image" src={mediaUrl(branding.backgroundValue)} alt="" />
        ) : null}
        {branding?.backgroundType === 'video' && branding.backgroundValue ? (
          <video id="brand-bg-video" src={mediaUrl(branding.backgroundValue)} autoPlay muted loop playsInline />
        ) : null}
        <div id="shade" />
        <div id="logo" className={`logo-${branding?.logoPosition ?? 'top-left'}`}>
          {branding?.logoUrl ? (
            <img src={mediaUrl(branding.logoUrl)} alt="Logo" />
          ) : (
            <span>Logo Empresa</span>
          )}
        </div>
        <div id="clock">{code}</div>
        <section id="slide">{firstSlide ? renderStaticSlide(firstSlide) : <div className="empty">TV aguardando conteudo</div>}</section>
        <div id="ticker" />
      </main>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__PLAYER_CODE__=${safeJson(code)};window.__PLAYER_PAYLOAD__=${safeJson(payload)};window.__PLAYER_SLIDES__=${safeJson(slides)};`,
        }}
      />
      <script dangerouslySetInnerHTML={{ __html: liteScript() }} />
    </>
  );
}

export function shouldUseLitePlayer(userAgent: string) {
  return /web0s|webos|netcast|smart-tv|smarttv|smarttv|lg browser|lgwebos|tizen|hbbtv|appletv|crkey/i.test(userAgent);
}

function buildLiteSlides(payload: PlayerPayload): LiteSlide[] {
  const now = Date.now();
  const templateSlides = (payload.templates ?? []).map((template) => ({
    id: template.id,
    title: template.name,
    type: 'template',
    body: template.items,
    duration: template.durationSeconds ?? 25,
    displayMode: template.displayMode ?? 'dark',
  }));
  const noticeSlides = payload.notices
    .filter((notice) => isActive(notice.startsAt, notice.endsAt, now))
    .map((notice) => ({
      id: notice.id,
      title: notice.title,
      type: 'notice',
      body: notice.bodyHtml,
      duration: notice.durationSeconds || 15,
      metadata: {
        tickerText: notice.tickerText ?? '',
        tickerPersistent: notice.tickerPersistent ?? false,
      },
    }));
  const assetSlides = payload.assets.flatMap((asset) => {
    const metadata = asset.metadata ?? {};
    const convertedSlides = Array.isArray(metadata.slides) ? metadata.slides.filter(Boolean).map(String) : [];
    if (convertedSlides.length > 0) {
      const perSlideSeconds = Math.max(1, Number(metadata.perSlideSeconds) || 5);
      return convertedSlides.map((slideUrl, index) => ({
        id: `${asset.id}-${index}`,
        title: `${asset.name} ${index + 1}`,
        type: 'image',
        body: slideUrl,
        duration: perSlideSeconds,
        metadata,
        transition: String(metadata.slideTransition ?? 'fade'),
        fitMode: String(metadata.fitMode ?? 'contain'),
      }));
    }
    return [{
      id: asset.id,
      title: asset.name,
      type: effectiveAssetType(asset.type, asset.url),
      body: asset.url,
      duration: asset.durationSeconds || 15,
      metadata,
      transition: String(metadata.slideTransition ?? 'fade'),
      fitMode: String(metadata.fitMode ?? 'cover'),
    }];
  });
  return [...templateSlides, ...noticeSlides, ...assetSlides];
}

function isActive(startsAt?: string, endsAt?: string, now = Date.now()) {
  const starts = startsAt ? new Date(startsAt).getTime() : 0;
  const ends = endsAt ? new Date(endsAt).getTime() : Number.POSITIVE_INFINITY;
  return (Number.isNaN(starts) || starts <= now) && (Number.isNaN(ends) || ends >= now);
}

function renderStaticSlide(slide: LiteSlide) {
  if (slide.type === 'template' && Array.isArray(slide.body)) {
    return (
      <div className="template-slide">
        {slide.body.map((item) => (
          <div
            key={item.id}
            className={`template-item item-${item.kind}`}
            style={{
              left: `${(item.x / 760) * 100}%`,
              top: `${(item.y / 430) * 100}%`,
              width: `${(item.width / 760) * 100}%`,
              height: `${(item.height / 430) * 100}%`,
              zIndex: item.zIndex,
              ...sanitizeStyle(item.style),
            }}
          >
            {renderTemplateItem(item)}
          </div>
        ))}
      </div>
    );
  }

  if (slide.type === 'notice') {
    return (
      <article className="notice-slide">
        <h1>{slide.title}</h1>
        <div className="notice-body" dangerouslySetInnerHTML={{ __html: normalizeMediaHtml(String(slide.body ?? '')) }} />
      </article>
    );
  }

  return renderAssetSlide(slide);
}

function renderAssetSlide(slide: LiteSlide) {
  const url = mediaUrl(String(slide.body ?? ''));
  const metadata = slide.metadata ?? {};
  const fitMode = String(slide.fitMode ?? metadata.fitMode ?? 'cover') === 'contain' ? 'contain' : 'cover';
  const type = effectiveAssetType(slide.type, url);
  if (type === 'image') {
    return (
      <div className={`media-stage fit-${fitMode}`}>
        {fitMode === 'contain' ? <img className="media-blur" src={url} alt="" /> : null}
        <img className={`full-media fit-${fitMode}`} src={url} alt={slide.title} />
      </div>
    );
  }
  if (type === 'video') {
    return (
      <div className={`media-stage fit-${fitMode}`}>
        {fitMode === 'contain' ? <video className="media-blur" src={url} autoPlay muted loop playsInline /> : null}
        <video className={`full-media fit-${fitMode}`} src={url} autoPlay muted loop playsInline />
      </div>
    );
  }
  if (type === 'youtube') return <iframe className="full-frame" src={toYoutubeEmbed(url)} title={slide.title} allow="autoplay; fullscreen" />;
  if (['webpage', 'external-link', 'dashboard'].includes(type)) {
    return <iframe className="full-frame" src={embeddableUrl(url, metadata)} title={slide.title} />;
  }
  if (type === 'rss') {
    return (
      <article className="rss-slide" data-rss-url={url}>
        <h1>{slide.title}</h1>
        <p>Carregando RSS...</p>
      </article>
    );
  }
  return (
    <article className="notice-slide">
      <h1>{slide.title}</h1>
      <p>{url}</p>
    </article>
  );
}

function renderTemplateItem(item: {
  kind: string;
  data: Record<string, unknown>;
}) {
  const data = item.data ?? {};
  const sourceUrl = mediaUrl(String(data.sourceUrl ?? ''));
  const content = String(data.content ?? data.label ?? '');
  const fitMode = data.fitMode === 'cover' ? 'cover' : 'contain';
  if (item.kind === 'image' && sourceUrl) return <img className={`template-media fit-${fitMode}`} src={sourceUrl} alt={content} />;
  if (item.kind === 'video' && sourceUrl) return <video className={`template-media fit-${fitMode}`} src={sourceUrl} autoPlay muted loop playsInline />;
  if (item.kind === 'iframe' && sourceUrl) return <iframe className="template-media" src={embeddableUrl(sourceUrl, data)} title={content || sourceUrl} />;
  if (item.kind === 'rss') {
    return <div className="template-rss" data-rss-url={sourceUrl || content}>Carregando RSS...</div>;
  }
  return <div className="template-text" dangerouslySetInnerHTML={{ __html: normalizeMediaHtml(content) }} />;
}

function sanitizeStyle(style: Record<string, unknown>) {
  const next: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(style ?? {})) {
    if (typeof value === 'string' || typeof value === 'number') next[key] = value;
  }
  return next;
}

function backgroundStyle(branding: PlayerPayload['branding']) {
  const primary = branding?.primaryColor ?? '#155EEF';
  const secondary = branding?.secondaryColor ?? '#0f172a';
  if (branding?.backgroundType === 'color') return { background: branding.backgroundValue || secondary };
  if (branding?.backgroundType === 'gradient') return { background: branding.backgroundValue || `linear-gradient(135deg,${secondary},${primary})` };
  return { background: `linear-gradient(135deg,${secondary},${primary})` };
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

function normalizeMediaHtml(html: string) {
  return html.replace(/https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/media\//gi, '/media/');
}

function safeJson(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function toYoutubeEmbed(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    const id = url.hostname.includes('youtu.be') ? url.pathname.split('/').filter(Boolean)[0] : url.searchParams.get('v');
    return id ? `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&controls=0&rel=0&loop=1&playlist=${id}` : rawUrl;
  } catch {
    return rawUrl;
  }
}

function embeddableUrl(rawUrl: string, metadata: Record<string, unknown>) {
  let authMode = String(metadata.authMode ?? '');
  if (authMode === 'grafana') authMode = 'grafana-image';
  if (!authMode || authMode === 'none') return rawUrl;
  const params = [
    `url=${encodeURIComponent(rawUrl)}`,
    `authMode=${encodeURIComponent(authMode)}`,
    'proxyVersion=lite-1',
  ];
  if (metadata.authUsername) params.push(`username=${encodeURIComponent(String(metadata.authUsername))}`);
  if (metadata.authPassword) params.push(`password=${encodeURIComponent(String(metadata.authPassword))}`);
  return `/api/proxy/frame?${params.join('&')}`;
}

function liteCss() {
  return `
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#050816;color:#fff;font-family:Arial,Helvetica,sans-serif}
#stage{position:relative;width:100%;max-width:100vw;height:100vh;height:100svh;min-height:360px;overflow:hidden}
#stage.hide-chrome #logo,#stage.hide-chrome #clock{display:none}
#shade{position:absolute;left:0;right:0;top:0;bottom:0;background:rgba(2,6,23,.20);z-index:1}
#brand-bg-image,#brand-bg-video{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;z-index:0}
#logo{position:absolute;z-index:4;max-width:min(280px,32vw);max-height:min(110px,18svh)}
#logo img{max-width:min(280px,32vw);max-height:min(110px,18svh);object-fit:contain}
#logo span{display:block;background:#fff;color:#0f172a;border-radius:8px;padding:clamp(8px,1.5vw,14px) clamp(12px,2.2vw,22px);font-size:clamp(16px,2vw,24px);font-weight:700}
.logo-top-left{left:clamp(12px,2vw,32px);top:clamp(10px,2vw,28px)}.logo-top-right{right:clamp(12px,2vw,32px);top:clamp(10px,2vw,28px)}.logo-bottom-left{left:clamp(12px,2vw,32px);bottom:clamp(10px,2vw,28px)}.logo-bottom-right{right:clamp(12px,2vw,32px);bottom:clamp(10px,2vw,28px)}
#clock{position:absolute;z-index:4;right:clamp(12px,2vw,32px);top:clamp(10px,2vw,28px);background:rgba(255,255,255,.18);border-radius:999px;padding:clamp(8px,1.3vw,12px) clamp(12px,2vw,20px);font-size:clamp(13px,1.6vw,18px);font-weight:700}
#slide{position:absolute;z-index:2;left:0;top:0;width:100%;height:100%;overflow:hidden}
.empty,.notice-slide{position:absolute;left:clamp(18px,8vw,9%);right:clamp(18px,8vw,9%);top:clamp(54px,16svh,18%);bottom:clamp(28px,9svh,10%);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;overflow:hidden}
.notice-slide h1{font-size:clamp(32px,6vw,64px);line-height:1.1;margin:0 0 clamp(12px,2.2vw,28px);font-weight:900}
.notice-body{font-size:clamp(18px,3.2vw,36px);line-height:1.35;max-width:min(1100px,92vw);max-height:100%;overflow:hidden}
.notice-body img,.notice-body video{max-width:100%;max-height:62svh;object-fit:contain;border-radius:16px}
.media-stage{position:absolute;left:0;top:0;width:100%;height:100%;overflow:hidden;background:#000}
.media-blur{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;filter:blur(26px);transform:scale(1.08);opacity:.72}
.full-media,.full-frame{position:absolute;left:0;top:0;width:100%;height:100%;border:0;background:#000}
.fit-cover{object-fit:cover}.fit-contain{object-fit:contain}
.template-slide{position:absolute;left:0;top:0;width:100%;height:100%}
.template-item{position:absolute;display:flex;align-items:center;justify-content:center;overflow:hidden;text-align:center;border-radius:14px}
.template-media{width:100%;height:100%;border:0}.template-text{width:100%;font-size:clamp(16px,2.5vw,28px);line-height:1.25;overflow:hidden}
.rss-slide{position:absolute;left:clamp(18px,12vw,12%);right:clamp(18px,12vw,12%);top:clamp(64px,14svh,14%);bottom:clamp(34px,12svh,12%);overflow:hidden;background:rgba(255,255,255,.96);color:#0f172a;border-radius:22px;padding:clamp(20px,3vw,40px) clamp(22px,3.5vw,46px);text-align:left;box-shadow:0 24px 70px rgba(0,0,0,.24)}
.rss-slide h1{font-size:clamp(22px,3vw,34px);color:#b91c1c;margin:0 0 clamp(10px,1.8vw,18px);font-weight:800}.rss-slide h3{font-size:clamp(16px,2.3vw,26px);line-height:1.18;margin:clamp(10px,1.7vw,18px) 0 0;font-weight:800}.rss-slide p{display:none}
.template-rss{width:100%;height:100%;overflow:hidden;text-align:left;background:rgba(255,255,255,.96);color:#0f172a;padding:clamp(8px,1.4vw,14px);border-radius:inherit}.template-rss h1{font-size:clamp(11px,1.5vw,15px);color:#b91c1c;margin:0 0 8px}.template-rss h3{font-size:clamp(10px,1.4vw,13px);line-height:1.15;margin:7px 0;font-weight:800}.template-rss p{display:none}
#ticker{display:none;position:absolute;z-index:5;left:0;right:0;bottom:0;background:#dc2626;color:#fff;white-space:nowrap;overflow:hidden;padding:clamp(8px,1.2vw,12px) 0;font-size:clamp(18px,2.8vw,30px);font-weight:900}
#ticker span{display:inline-block;padding-left:100%;animation:ticker 22s linear infinite}@keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-100%)}}
.slide-in-fade{animation:fadeIn .7s ease}.slide-in-slide{animation:slideIn .7s ease}.slide-in-slide-left{animation:slideLeftIn .7s ease}.slide-in-slide-up{animation:slideUpIn .7s ease}.slide-in-slide-down{animation:slideDownIn .7s ease}.slide-in-zoom{animation:zoomIn .7s ease}.slide-in-blur{animation:blurIn .7s ease}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes fadeOut{from{opacity:1}to{opacity:0}}@keyframes slideIn{from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:translateX(0)}}@keyframes slideOut{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(-60px)}}@keyframes slideLeftIn{from{opacity:0;transform:translateX(-60px)}to{opacity:1;transform:translateX(0)}}@keyframes slideLeftOut{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(60px)}}@keyframes slideUpIn{from{opacity:0;transform:translateY(60px)}to{opacity:1;transform:translateY(0)}}@keyframes slideUpOut{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(-60px)}}@keyframes slideDownIn{from{opacity:0;transform:translateY(-60px)}to{opacity:1;transform:translateY(0)}}@keyframes slideDownOut{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(60px)}}@keyframes zoomIn{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}@keyframes zoomOut{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(.94)}}@keyframes blurIn{from{opacity:0;filter:blur(12px)}to{opacity:1;filter:blur(0)}}@keyframes blurOut{from{opacity:1;filter:blur(0)}to{opacity:0;filter:blur(12px)}}
`;
}

function liteScript() {
  return `
(function(){
  var code=window.__PLAYER_CODE__||'TV001';
  var payload=window.__PLAYER_PAYLOAD__||{};
  var slides=window.__PLAYER_SLIDES__||[];
  var index=0;
  var timer=null;
  function xhr(url, cb){
    try{var r=new XMLHttpRequest();r.open('GET',url,true);r.onreadystatechange=function(){if(r.readyState===4&&r.status>=200&&r.status<300){try{cb(JSON.parse(r.responseText));}catch(e){}}};r.send();}catch(e){}
  }
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function media(u){return String(u||'').replace(/^https?:\\/\\/(localhost|127\\.0\\.0\\.1)(:\\d+)?\\/media\\//i,'/media/');}
  function enc(v){return encodeURIComponent(String(v==null?'':v));}
  function prox(u,m){m=m||{};var a=m.authMode||'';if(a==='grafana')a='grafana-image';if(!a||a==='none')return u;var q='url='+enc(u)+'&authMode='+enc(a)+'&proxyVersion=lite-1';if(m.authUsername)q+='&username='+enc(m.authUsername);if(m.authPassword)q+='&password='+enc(m.authPassword);return '/api/proxy/frame?'+q;}
  function fit(m){return (m&&m.fitMode==='contain')?'contain':'cover';}
  function trans(s){var t=(s&&s.transition)||(s&&s.metadata&&s.metadata.slideTransition)||'fade';return 'slide-in-'+String(t).replace(/[^a-z-]/g,'');}
  function cssValue(v){return String(v==null?'':v).replace(/[;"<>]/g,'');}
  function styleCss(st){st=st||{};var css='';for(var k in st){if(!st.hasOwnProperty(k)||st[k]==null)continue;var key=k.replace(/[A-Z]/g,function(m){return '-'+m.toLowerCase();});css+=key+':'+cssValue(st[k])+';';}return css;}
  function itemCss(it,d){var base=styleCss(it.style||{});if(!base||base.indexOf('background')<0){base+='background:rgba(15,23,42,.74);';}if(base.indexOf('border-radius')<0){base+='border-radius:18px;';}if(base.indexOf('box-shadow')<0&&it.kind==='text'){base+='box-shadow:0 24px 70px rgba(0,0,0,.28);';}if(it.kind==='image'||it.kind==='video'||it.kind==='iframe'){base=styleCss(it.style||{})+'background:transparent;border-radius:'+(it.style&&it.style.borderRadius?it.style.borderRadius:'18px')+';';}return base;}
  function startOf(d){var n=parseFloat(d&&d.startSecond);return isFinite(n)?Math.max(0,n):1;}
  function endOf(d,total){var st=startOf(d),dur=parseFloat(d&&d.durationSecond),en=parseFloat(d&&d.endSecond);if(isFinite(dur)&&dur>0)return st+dur;if(isFinite(en)&&en>0)return en;return total||9999;}
  function hasFullBleed(items){for(var i=0;i<(items||[]).length;i++){var d=items[i].data||{};if(d.fullBleed&&(items[i].kind==='image'||items[i].kind==='video'||items[i].kind==='iframe'))return true;}return false;}
  function isFullSlide(s){if(!s)return false;if(s.type==='template')return hasFullBleed(s.body||[]);var m=s.metadata||{};return !!(m.fullscreen||m.hideChrome);}
  function activeNotice(n){var now=Date.now();var st=n.startsAt?new Date(n.startsAt).getTime():0;var en=n.endsAt?new Date(n.endsAt).getTime():Infinity;return (isNaN(st)||st<=now)&&(isNaN(en)||en>=now);}
  function build(p){
    var out=[],i,a,n,t;
    for(i=0;i<(p.templates||[]).length;i++){t=p.templates[i];out.push({id:t.id,title:t.name,type:'template',body:t.items||[],duration:t.durationSeconds||25,displayMode:t.displayMode||'dark'});}
    for(i=0;i<(p.notices||[]).length;i++){n=p.notices[i];if(activeNotice(n)){out.push({id:n.id,title:n.title,type:'notice',body:n.bodyHtml||'',duration:n.durationSeconds||15,metadata:{tickerText:n.tickerText||'',tickerPersistent:!!n.tickerPersistent}});}}
    for(i=0;i<(p.assets||[]).length;i++){a=p.assets[i];var m=a.metadata||{},arr=m.slides||[];if(arr.length){for(var j=0;j<arr.length;j++){out.push({id:a.id+'-'+j,title:a.name+' '+(j+1),type:'image',body:arr[j],duration:m.perSlideSeconds||5,metadata:m,transition:m.slideTransition||'fade',fitMode:m.fitMode||'contain'});}}else{out.push({id:a.id,title:a.name,type:mediaType(a.type,a.url),body:a.url,duration:a.durationSeconds||15,metadata:m,transition:m.slideTransition||'fade',fitMode:m.fitMode||'cover'});}}
    return out;
  }
  function renderTemplate(items,total){
    var html='<div class="template-slide">';
    for(var i=0;i<items.length;i++){var it=items[i],d=it.data||{},url=media(d.sourceUrl||''),content=String(d.content||d.label||''),left=(it.x/760*100),top=(it.y/430*100),w=(it.width/760*100),h=(it.height/430*100);
      var tm=d.fitMode==='cover'?'cover':'contain';
      var full=d.fullBleed&&(it.kind==='image'||it.kind==='video'||it.kind==='iframe');
      var pos=full?'left:0;top:0;width:100%;height:100%;':'left:'+left+'%;top:'+top+'%;width:'+w+'%;height:'+h+'%;';
      html+='<div class="template-item" data-start="'+startOf(d)+'" data-end="'+endOf(d,total)+'" data-enter="'+esc(d.transition||'none')+'" data-exit="'+esc(d.exitTransition||d.transition||'none')+'" style="'+pos+'z-index:'+(it.zIndex||1)+';'+itemCss(it,d)+'">';
      if(it.kind==='image'&&url){html+='<img class="template-media fit-'+tm+'" src="'+esc(url)+'">';}
      else if(it.kind==='video'&&url){html+='<video class="template-media fit-'+tm+'" src="'+esc(url)+'" autoplay muted loop playsinline></video>';}
      else if(it.kind==='iframe'&&url){html+='<iframe class="template-media" src="'+esc(prox(url,d))+'"></iframe>';}
      else if(it.kind==='rss'){html+='<div class="template-rss" data-rss-url="'+esc(url||content)+'">Carregando RSS...</div>';}
      else{html+='<div class="template-text">'+content+'</div>';}
      html+='</div>';
    }
    return html+'</div>';
  }
  function animName(t){t=String(t||'fade');var m={'fade':'fadeIn','slide':'slideIn','slide-left':'slideLeftIn','slide-up':'slideUpIn','slide-down':'slideDownIn','zoom':'zoomIn','blur':'blurIn','flip':'zoomIn','bounce':'zoomIn','rotate':'zoomIn'};return m[t]||'fadeIn';}
  function youtube(u){try{var url=new URL(u);var id=url.hostname.indexOf('youtu.be')>=0?url.pathname.split('/')[1]:url.searchParams.get('v');return id?'https://www.youtube.com/embed/'+id+'?autoplay=1&mute=1&controls=0&rel=0&loop=1&playlist='+id:u;}catch(e){return u;}}
  function render(s){
    var el=document.getElementById('slide'); if(!el)return;
    var html='',u=media(s.body||''),m=s.metadata||{},arr=m.slides||[];
    var stage=document.getElementById('stage');if(stage)stage.className=isFullSlide(s)?'hide-chrome':'';
    var typ=mediaType(s.type,u);
    if(typ==='template'){html=renderTemplate(s.body||[],s.duration||10);}
    else if(s.type==='notice'){html='<article class="notice-slide"><h1>'+esc(s.title)+'</h1><div class="notice-body">'+String(s.body||'').replace(/https?:\\/\\/(localhost|127\\.0\\.0\\.1)(:\\d+)?\\/media\\//gi,'/media/')+'</div></article>';}
    else if(typ==='image'){var fm=fit(s);html='<div class="media-stage fit-'+fm+'">'+(fm==='contain'?'<img class="media-blur" src="'+esc(u)+'">':'')+'<img class="full-media fit-'+fm+'" src="'+esc(u)+'"></div>';}
    else if(typ==='video'){var fmv=fit(s);html='<div class="media-stage fit-'+fmv+'">'+(fmv==='contain'?'<video class="media-blur" src="'+esc(u)+'" autoplay muted loop playsinline preload="auto"></video>':'')+'<video class="full-media fit-'+fmv+'" src="'+esc(u)+'" autoplay muted loop playsinline preload="auto"></video></div>';}
    else if(typ==='youtube'){html='<iframe class="full-frame" src="'+esc(youtube(u))+'" allow="autoplay; fullscreen"></iframe>';}
    else if(typ==='webpage'||typ==='external-link'||typ==='dashboard'){html='<iframe class="full-frame" src="'+esc(prox(u,m))+'"></iframe>';}
    else if(typ==='rss'){html='<article class="rss-slide" data-rss-url="'+esc(u)+'"><h1>'+esc(s.title)+'</h1><p>Carregando RSS...</p></article>';}
    else{html='<article class="notice-slide"><h1>'+esc(s.title)+'</h1><p>'+esc(u)+'</p></article>';}
    el.innerHTML=html;
    el.className=''; el.offsetHeight; el.className=trans(s);
    loadRssBlocks();
    playVideos();
    startWidgetTimeline(s.duration||10);
    var ticker=document.getElementById('ticker'),txt=(m.tickerText||'');
    if(ticker&&txt){ticker.style.display='block';ticker.innerHTML='<span>'+esc(txt)+' &nbsp;&nbsp;&nbsp; '+esc(txt)+'</span>';}else if(ticker){ticker.style.display='none';}
  }
  function mediaType(t,u){u=String(u||'');if(/\\.(mp4|webm|mov)(\\?|#|$)/i.test(u))return 'video';if(/\\.(png|jpe?g|gif|webp|svg)(\\?|#|$)/i.test(u))return 'image';return t;}
  function playVideos(){var videos=document.getElementsByTagName('video');for(var i=0;i<videos.length;i++){try{videos[i].muted=true;videos[i].playsInline=true;var p=videos[i].play&&videos[i].play();if(p&&p.catch)p.catch(function(){});}catch(e){}}}
  var widgetTimer=null,slideStarted=0;
  function startWidgetTimeline(total){clearInterval(widgetTimer);slideStarted=Date.now();updateWidgets(total);widgetTimer=setInterval(function(){updateWidgets(total);},200);}
  function updateWidgets(total){var nodes=document.querySelectorAll?document.querySelectorAll('.template-item[data-start]'):[];var elapsed=(Date.now()-slideStarted)/1000;for(var i=0;i<nodes.length;i++){var n=nodes[i],st=parseFloat(n.getAttribute('data-start')||'0'),en=parseFloat(n.getAttribute('data-end')||String(total||9999));var was=n.getAttribute('data-visible')==='1';var visible=elapsed>=st&&elapsed<=en;if(visible){n.style.display='flex';if(!was){var ent=n.getAttribute('data-enter')||'fade';n.style.animation=(ent&&ent!=='none')?animName(ent)+' .7s ease forwards':'';n.setAttribute('data-visible','1');}if(en<total&&elapsed>en-.7){var ex=n.getAttribute('data-exit')||'fade';if(ex&&ex!=='none')n.style.animation=animName(ex).replace('In','Out')+' .7s ease forwards';}}else{n.style.display='none';n.setAttribute('data-visible','0');}}}
  function loadRssBlocks(){var blocks=document.querySelectorAll?document.querySelectorAll('[data-rss-url]'):[];for(var i=0;i<blocks.length;i++){(function(b){var u=b.getAttribute('data-rss-url');if(!u)return;try{var r=new XMLHttpRequest();r.open('POST','/api/rss/preview',true);r.setRequestHeader('Content-Type','application/json');r.onreadystatechange=function(){if(r.readyState===4&&r.status>=200&&r.status<300){try{var data=JSON.parse(r.responseText),items=data.items||[],h='<h1>G1 | Ultimas noticias</h1>';for(var j=0;j<items.length&&j<4;j++){h+='<h3>'+esc(items[j].title)+'</h3>';}b.innerHTML=h;}catch(e){}}};r.send(JSON.stringify({url:u}));}catch(e){}})(blocks[i]);}}
  function tickClock(){var d=new Date(),p=function(n){return n<10?'0'+n:n;},c=document.getElementById('clock');if(c)c.innerHTML=esc(code)+' | '+p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds());}
  function next(){if(!slides.length)return;render(slides[index%slides.length]);var s=slides[index%slides.length];index=(index+1)%slides.length;clearTimeout(timer);timer=setTimeout(next,Math.max(1,s.duration||10)*1000);}
  function refresh(){xhr('/api/player/'+encodeURIComponent(code),function(p){payload=p;slides=build(p);if(index>=slides.length)index=0;if(!timer)next();});}
  setInterval(tickClock,1000);tickClock();next();setInterval(refresh,5000);refresh();
})();
`;
}
