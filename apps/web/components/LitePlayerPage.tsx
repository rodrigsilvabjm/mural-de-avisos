import { PlayerPayload } from '../lib/types';

type LiteSlide = {
  id: string;
  title: string;
  type: string;
  body: unknown;
  duration: number;
  metadata?: Record<string, unknown>;
  displayMode?: 'dark' | 'light';
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
  const assetSlides = payload.assets.map((asset) => ({
    id: asset.id,
    title: asset.name,
    type: asset.type,
    body: asset.url,
    duration: asset.durationSeconds || 15,
    metadata: asset.metadata ?? {},
  }));
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
  const slides = Array.isArray(metadata.slides) ? metadata.slides.filter(Boolean).map(String) : [];
  if (slides.length > 0) {
    return <img className="full-media" src={mediaUrl(slides[0])} alt={slide.title} />;
  }
  if (slide.type === 'image') return <img className="full-media" src={url} alt={slide.title} />;
  if (slide.type === 'video') return <video className="full-media" src={url} autoPlay muted loop playsInline />;
  if (slide.type === 'youtube') return <iframe className="full-frame" src={toYoutubeEmbed(url)} title={slide.title} allow="autoplay; fullscreen" />;
  if (['webpage', 'external-link', 'dashboard'].includes(slide.type)) return <iframe className="full-frame" src={url} title={slide.title} />;
  if (slide.type === 'rss') {
    return (
      <article className="notice-slide">
        <h1>{slide.title}</h1>
        <p>{url}</p>
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
  if (item.kind === 'image' && sourceUrl) return <img className="template-media" src={sourceUrl} alt={content} />;
  if (item.kind === 'video' && sourceUrl) return <video className="template-media" src={sourceUrl} autoPlay muted loop playsInline />;
  if (item.kind === 'iframe' && sourceUrl) return <iframe className="template-media" src={sourceUrl} title={content || sourceUrl} />;
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

function liteCss() {
  return `
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#050816;color:#fff;font-family:Arial,Helvetica,sans-serif}
#stage{position:relative;width:100vw;height:100vh;overflow:hidden}
#shade{position:absolute;left:0;right:0;top:0;bottom:0;background:rgba(2,6,23,.20);z-index:1}
#brand-bg-image,#brand-bg-video{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;z-index:0}
#logo{position:absolute;z-index:4;max-width:280px;max-height:110px}
#logo img{max-width:280px;max-height:110px;object-fit:contain}
#logo span{display:block;background:#fff;color:#0f172a;border-radius:8px;padding:14px 22px;font-size:24px;font-weight:700}
.logo-top-left{left:32px;top:28px}.logo-top-right{right:32px;top:28px}.logo-bottom-left{left:32px;bottom:28px}.logo-bottom-right{right:32px;bottom:28px}
#clock{position:absolute;z-index:4;right:32px;top:28px;background:rgba(255,255,255,.18);border-radius:999px;padding:12px 20px;font-size:18px;font-weight:700}
#slide{position:absolute;z-index:2;left:0;top:0;width:100%;height:100%;overflow:hidden}
.empty,.notice-slide{position:absolute;left:8%;right:8%;top:18%;bottom:10%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.notice-slide h1{font-size:64px;line-height:1.1;margin:0 0 28px;font-weight:900}
.notice-body{font-size:36px;line-height:1.35;max-width:1100px}
.notice-body img,.notice-body video{max-width:100%;max-height:62vh;object-fit:contain;border-radius:16px}
.full-media,.full-frame{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;border:0;background:#000}
.template-slide{position:absolute;left:0;top:0;width:100%;height:100%}
.template-item{position:absolute;display:flex;align-items:center;justify-content:center;overflow:hidden;text-align:center;border-radius:14px}
.template-media{width:100%;height:100%;object-fit:cover;border:0}.template-text{width:100%;font-size:28px;line-height:1.25}
#ticker{display:none;position:absolute;z-index:5;left:0;right:0;bottom:0;background:#dc2626;color:#fff;white-space:nowrap;overflow:hidden;padding:12px 0;font-size:30px;font-weight:900}
#ticker span{display:inline-block;padding-left:100%;animation:ticker 22s linear infinite}@keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-100%)}}
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
  function activeNotice(n){var now=Date.now();var st=n.startsAt?new Date(n.startsAt).getTime():0;var en=n.endsAt?new Date(n.endsAt).getTime():Infinity;return (isNaN(st)||st<=now)&&(isNaN(en)||en>=now);}
  function build(p){
    var out=[],i,a,n,t;
    for(i=0;i<(p.templates||[]).length;i++){t=p.templates[i];out.push({id:t.id,title:t.name,type:'template',body:t.items||[],duration:t.durationSeconds||25,displayMode:t.displayMode||'dark'});}
    for(i=0;i<(p.notices||[]).length;i++){n=p.notices[i];if(activeNotice(n)){out.push({id:n.id,title:n.title,type:'notice',body:n.bodyHtml||'',duration:n.durationSeconds||15,metadata:{tickerText:n.tickerText||'',tickerPersistent:!!n.tickerPersistent}});}}
    for(i=0;i<(p.assets||[]).length;i++){a=p.assets[i];out.push({id:a.id,title:a.name,type:a.type,body:a.url,duration:a.durationSeconds||15,metadata:a.metadata||{}});}
    return out;
  }
  function renderTemplate(items){
    var html='<div class="template-slide">';
    for(var i=0;i<items.length;i++){var it=items[i],d=it.data||{},url=media(d.sourceUrl||''),content=String(d.content||d.label||''),left=(it.x/760*100),top=(it.y/430*100),w=(it.width/760*100),h=(it.height/430*100);
      html+='<div class="template-item" style="left:'+left+'%;top:'+top+'%;width:'+w+'%;height:'+h+'%;z-index:'+(it.zIndex||1)+'">';
      if(it.kind==='image'&&url){html+='<img class="template-media" src="'+esc(url)+'">';}
      else if(it.kind==='video'&&url){html+='<video class="template-media" src="'+esc(url)+'" autoplay muted loop playsinline></video>';}
      else if(it.kind==='iframe'&&url){html+='<iframe class="template-media" src="'+esc(url)+'"></iframe>';}
      else{html+='<div class="template-text">'+content+'</div>';}
      html+='</div>';
    }
    return html+'</div>';
  }
  function youtube(u){try{var url=new URL(u);var id=url.hostname.indexOf('youtu.be')>=0?url.pathname.split('/')[1]:url.searchParams.get('v');return id?'https://www.youtube.com/embed/'+id+'?autoplay=1&mute=1&controls=0&rel=0&loop=1&playlist='+id:u;}catch(e){return u;}}
  function render(s){
    var el=document.getElementById('slide'); if(!el)return;
    var html='',u=media(s.body||''),m=s.metadata||{},arr=m.slides||[];
    if(s.type==='template'){html=renderTemplate(s.body||[]);}
    else if(s.type==='notice'){html='<article class="notice-slide"><h1>'+esc(s.title)+'</h1><div class="notice-body">'+String(s.body||'').replace(/https?:\\/\\/(localhost|127\\.0\\.0\\.1)(:\\d+)?\\/media\\//gi,'/media/')+'</div></article>';}
    else if(arr.length){html='<img class="full-media" src="'+esc(media(arr[0]))+'">';}
    else if(s.type==='image'){html='<img class="full-media" src="'+esc(u)+'">';}
    else if(s.type==='video'){html='<video class="full-media" src="'+esc(u)+'" autoplay muted loop playsinline></video>';}
    else if(s.type==='youtube'){html='<iframe class="full-frame" src="'+esc(youtube(u))+'" allow="autoplay; fullscreen"></iframe>';}
    else if(s.type==='webpage'||s.type==='external-link'||s.type==='dashboard'){html='<iframe class="full-frame" src="'+esc(u)+'"></iframe>';}
    else{html='<article class="notice-slide"><h1>'+esc(s.title)+'</h1><p>'+esc(u)+'</p></article>';}
    el.innerHTML=html;
    var ticker=document.getElementById('ticker'),txt=(m.tickerText||'');
    if(ticker&&txt){ticker.style.display='block';ticker.innerHTML='<span>'+esc(txt)+' &nbsp;&nbsp;&nbsp; '+esc(txt)+'</span>';}else if(ticker){ticker.style.display='none';}
  }
  function tickClock(){var d=new Date(),p=function(n){return n<10?'0'+n:n;},c=document.getElementById('clock');if(c)c.innerHTML=esc(code)+' | '+p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds());}
  function next(){if(!slides.length)return;render(slides[index%slides.length]);var s=slides[index%slides.length];index=(index+1)%slides.length;clearTimeout(timer);timer=setTimeout(next,Math.max(1,s.duration||10)*1000);}
  function refresh(){xhr('/api/player/'+encodeURIComponent(code),function(p){payload=p;slides=build(p);if(index>=slides.length)index=0;if(!timer)next();});}
  setInterval(tickClock,1000);tickClock();next();setInterval(refresh,5000);refresh();
})();
`;
}
