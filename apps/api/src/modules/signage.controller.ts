import {
  All,
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Headers,
  Ip,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import {
  ApproveScreenDto,
  CreateContentDto,
  CreateNoticeDto,
  CreatePlaylistDto,
  CreateScheduleDto,
  CreateTemplateDto,
  CreateUserDto,
  RssPreviewDto,
  RegisterScreenDto,
  UpdateBrandingDto,
} from './dto';
import { SignageGateway } from './signage.gateway';
import { SignageService } from './signage.service';
import { StorageService } from './storage.service';

@Controller()
export class SignageController {
  constructor(
    private readonly signage: SignageService,
    private readonly storage: StorageService,
    private readonly gateway: SignageGateway,
  ) {}

  @Get('health')
  health() {
    return { ok: true, service: 'signage-api' };
  }

  @Get('dashboard')
  dashboard() {
    return this.signage.dashboard();
  }

  @Get('contents')
  contents() {
    return this.signage.listAssets();
  }

  @Post('contents')
  createContent(@Body() dto: CreateContentDto) {
    const asset = this.signage.createAsset(dto);
    this.gateway.broadcastRefresh();
    return asset;
  }

  @Put('contents/:id')
  updateContent(@Param('id') id: string, @Body() dto: Partial<CreateContentDto>) {
    const asset = this.signage.updateAsset(id, dto);
    this.gateway.broadcastRefresh();
    return asset;
  }

  @Delete('contents/:id')
  deleteContent(@Param('id') id: string) {
    const result = this.signage.deleteAsset(id);
    this.gateway.broadcastRefresh();
    return result;
  }

  @Post('contents/upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: Express.Multer.File) {
    return this.storage.upload(file);
  }

  @Get('notices')
  notices() {
    return this.signage.listNotices();
  }

  @Post('notices')
  createNotice(@Body() dto: CreateNoticeDto) {
    const notice = this.signage.createNotice(dto);
    this.gateway.broadcastRefresh();
    return notice;
  }

  @Put('notices/:id')
  updateNotice(@Param('id') id: string, @Body() dto: Partial<CreateNoticeDto>) {
    const notice = this.signage.updateNotice(id, dto);
    this.gateway.broadcastRefresh();
    return notice;
  }

  @Delete('notices/:id')
  deleteNotice(@Param('id') id: string) {
    const result = this.signage.deleteNotice(id);
    this.gateway.broadcastRefresh();
    return result;
  }

  @Get('screens')
  screens() {
    return this.signage.listScreens();
  }

  @Post('screens/register')
  registerScreen(
    @Body() dto: RegisterScreenDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.signage.registerScreen(
      { ...dto, userAgent: dto.userAgent ?? userAgent },
      ipAddress,
    );
  }

  @Post('screens/:code/approve')
  approveScreen(@Param('code') code: string, @Body() dto: ApproveScreenDto) {
    const screen = this.signage.approveScreen(code, dto);
    this.gateway.broadcastRefresh();
    return screen;
  }

  @Get('playlists')
  playlists() {
    return this.signage.listPlaylists();
  }

  @Post('playlists')
  createPlaylist(@Body() dto: CreatePlaylistDto) {
    const playlist = this.signage.createPlaylist(dto);
    this.gateway.broadcastRefresh();
    return playlist;
  }

  @Get('schedules')
  schedules() {
    return this.signage.listSchedules();
  }

  @Post('schedules')
  createSchedule(@Body() dto: CreateScheduleDto) {
    const schedule = this.signage.createSchedule(dto);
    this.gateway.broadcastRefresh();
    return schedule;
  }

  @Put('schedules/:id')
  updateSchedule(@Param('id') id: string, @Body() dto: Partial<CreateScheduleDto>) {
    const schedule = this.signage.updateSchedule(id, dto);
    this.gateway.broadcastRefresh();
    return schedule;
  }

  @Delete('schedules/:id')
  deleteSchedule(@Param('id') id: string) {
    const result = this.signage.deleteSchedule(id);
    this.gateway.broadcastRefresh();
    return result;
  }

  @Get('branding')
  branding() {
    return this.signage.getBranding();
  }

  @Put('branding')
  updateBranding(@Body() dto: UpdateBrandingDto) {
    const branding = this.signage.updateBranding(dto);
    this.gateway.broadcastRefresh();
    return branding;
  }

  @Get('users')
  users() {
    return this.signage.listUsers();
  }

  @Post('users')
  createUser(@Body() dto: CreateUserDto) {
    return this.signage.createUser(dto);
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: string) {
    return this.signage.deleteUser(id);
  }

  @Post('rss/preview')
  async rssPreview(@Body() dto: RssPreviewDto) {
    const response = await fetch(dto.url);
    const xml = await response.text();
    const items = Array.from(xml.matchAll(/<item>[\s\S]*?<\/item>/g))
      .slice(0, 8)
      .map((match) => {
        const block = match[0];
        return {
          title: cleanXml(extract(block, 'title')),
          link: cleanXml(extract(block, 'link')),
          description: cleanXml(extract(block, 'description')),
        };
      });
    return { url: dto.url, items };
  }

  @Get('proxy/frame')
  async proxyFrame(
    @Query('url') rawUrl: string,
    @Query('authMode') authMode: string | undefined,
    @Query('username') username: string | undefined,
    @Query('password') password: string | undefined,
    @Query('proxyVersion') proxyVersion: string | undefined,
    @Res() response: Response,
  ) {
    const target = safeHttpUrl(rawUrl);

    if (authMode === 'grafana-image' || (authMode === 'grafana' && proxyVersion === 'lite-1')) {
      response.redirect(302, grafanaImagePageUrl(target, { authMode: 'grafana-image', username, password }));
      return;
    }

    if (authMode === 'grafana') {
      response.redirect(302, grafanaUnifiedUrl(target, { authMode, username, password }));
      return;
    }

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 CorporateSignage/1.0',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    };

    if (authMode === 'basic' && username) {
      headers.Authorization = `Basic ${Buffer.from(`${username}:${password ?? ''}`).toString('base64')}`;
    }

    if (authMode === 'zabbix' && username) {
      const cookie = await zabbixSessionCookie(target, username, password ?? '');
      if (cookie) headers.Cookie = cookie;
    }

    if (authMode === 'grafana' && username) {
      const cookie = await grafanaSessionCookie(target, username, password ?? '');
      if (cookie) headers.Cookie = cookie;
    }

    const upstream = await fetch(target.toString(), {
      headers,
      redirect: 'follow',
    });
    const contentType = upstream.headers.get('content-type') ?? 'text/html; charset=utf-8';
    const body = await upstream.text();

    response.setHeader('Content-Type', contentType);
    response.setHeader('Cache-Control', 'no-store');
    response.removeHeader('X-Frame-Options');
    response.removeHeader('Content-Security-Policy');

    if (contentType.includes('text/html')) {
      response.send(rewriteFrameHtml(body, target, { authMode, username, password }));
      return;
    }

    response.send(body);
  }

  @Get('proxy/resource')
  async proxyResource(
    @Query('url') rawUrl: string,
    @Query('authMode') authMode: string | undefined,
    @Query('username') username: string | undefined,
    @Query('password') password: string | undefined,
    @Res() response: Response,
  ) {
    const target = safeHttpUrl(rawUrl);
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 CorporateSignage/1.0',
      Accept: '*/*',
    };

    if (authMode === 'basic' && username) {
      headers.Authorization = `Basic ${Buffer.from(`${username}:${password ?? ''}`).toString('base64')}`;
    }

    if (authMode === 'zabbix' && username) {
      const cookie = await zabbixSessionCookie(target, username, password ?? '');
      if (cookie) headers.Cookie = cookie;
    }

    if (authMode === 'grafana' && username) {
      const cookie = await grafanaSessionCookie(target, username, password ?? '');
      if (cookie) headers.Cookie = cookie;
    }

    const upstream = await fetch(target.toString(), {
      headers,
      redirect: 'follow',
    });
    const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream';

    response.status(upstream.status);
    response.setHeader('Content-Type', contentType);
    response.setHeader('Cache-Control', 'no-store');
    response.removeHeader('X-Frame-Options');
    response.removeHeader('Content-Security-Policy');
    const buffer = Buffer.from(await upstream.arrayBuffer());
    response.send(buffer);
  }

  @Get('proxy/grafana-image')
  async proxyGrafanaImagePage(
    @Query('url') rawUrl: string,
    @Query('authMode') authMode: string | undefined,
    @Query('username') username: string | undefined,
    @Query('password') password: string | undefined,
    @Res() response: Response,
  ) {
    const target = safeHttpUrl(rawUrl);
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.send(grafanaImagePageHtml(target, { authMode, username, password }));
  }

  @Get('proxy/grafana-image/render')
  async proxyGrafanaImageRender(
    @Query('url') rawUrl: string,
    @Query('authMode') authMode: string | undefined,
    @Query('username') username: string | undefined,
    @Query('password') password: string | undefined,
    @Res() response: Response,
  ) {
    const target = safeHttpUrl(rawUrl);
    const renderTarget = grafanaRenderUrl(target);
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 CorporateSignage/1.0',
      Accept: 'image/png,image/*,*/*;q=0.8',
    };

    if ((authMode === 'grafana-image' || authMode === 'grafana') && username) {
      const cookie = await grafanaSessionCookie(target, username, password ?? '');
      if (cookie) headers.Cookie = cookie;
    }

    if (authMode === 'basic' && username) {
      headers.Authorization = `Basic ${Buffer.from(`${username}:${password ?? ''}`).toString('base64')}`;
    }

    const upstream = await fetch(renderTarget.toString(), {
      headers,
      redirect: 'follow',
    });
    const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream';
    const buffer = Buffer.from(await upstream.arrayBuffer());

    response.status(upstream.status);
    response.setHeader('Cache-Control', 'no-store');
    response.removeHeader('X-Frame-Options');
    response.removeHeader('Content-Security-Policy');

    if (!contentType.includes('image/')) {
      response.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      response.send(grafanaErrorSvg(renderTarget, contentType, buffer.toString('utf8').slice(0, 600)));
      return;
    }

    response.setHeader('Content-Type', contentType);
    response.send(buffer);
  }

  @Get('proxy/grafana-resource/:token/*')
  async proxyGrafanaResource(
    @Param('token') token: string,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    return this.proxyGrafanaPath(token, `/proxy/grafana-resource/${token}/`, request, response);
  }

  @All('proxy/grafana-api/:token/*')
  async proxyGrafanaApi(
    @Param('token') token: string,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    return this.proxyGrafanaPath(token, `/proxy/grafana-api/${token}/`, request, response);
  }

  @All('proxy/grafana/:token/*')
  async proxyGrafanaUnified(
    @Param('token') token: string,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    return this.proxyGrafanaPath(token, `/proxy/grafana/${token}/`, request, response);
  }

  private async proxyGrafanaPath(token: string, marker: string, request: Request, response: Response) {
    const auth = decodeGrafanaProxyToken(token);
    const originalUrl = request.originalUrl.includes(marker) ? request.originalUrl : request.url;
    const afterMarker = originalUrl.split(marker)[1] ?? '';
    const [resourcePath, query = ''] = afterMarker.split('?');
    const target = safeHttpUrl(`${auth.origin}/${resourcePath.replace(/^\/+/, '')}${query ? `?${query}` : ''}`);
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 CorporateSignage/1.0',
      Accept: String(request.headers.accept ?? '*/*'),
    };
    if (request.headers['content-type']) headers['Content-Type'] = String(request.headers['content-type']);
    copyGrafanaRequestHeaders(request, headers);

    if (auth.authMode === 'grafana' && auth.username) {
      const cookie = await grafanaSessionCookie(target, auth.username, auth.password ?? '');
      if (cookie) headers.Cookie = cookie;
    }

    const method = request.method.toUpperCase();
    const body = method === 'GET' || method === 'HEAD' ? undefined : JSON.stringify(request.body ?? {});
    const upstream = await fetch(target.toString(), {
      method,
      headers,
      body,
      redirect: 'follow',
    });
    const contentType = upstream.headers.get('content-type') ?? 'application/json; charset=utf-8';

    response.status(upstream.status);
    response.setHeader('Content-Type', contentType);
    response.setHeader('Cache-Control', 'no-store');
    response.removeHeader('X-Frame-Options');
    response.removeHeader('Content-Security-Policy');
    if (contentType.includes('text/html')) {
      const bodyText = await upstream.text();
      response.send(rewriteFrameHtml(bodyText, target, auth));
      return;
    }

    if (isTextLike(contentType)) {
      const bodyText = await upstream.text();
      response.send(rewriteGrafanaResourceBody(bodyText, contentType, token));
      return;
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    response.send(buffer);
  }

  @Get('player/:code')
  player(@Param('code') code: string) {
    return this.signage.playerPayload(code);
  }

  @Get('templates')
  templates() {
    return this.signage.listTemplates();
  }

  @Post('templates')
  createTemplate(@Body() dto: CreateTemplateDto) {
    const template = this.signage.createTemplate(dto);
    this.gateway.broadcastRefresh();
    return template;
  }

  @Put('templates/:id')
  updateTemplate(@Param('id') id: string, @Body() dto: Partial<CreateTemplateDto>) {
    const template = this.signage.updateTemplate(id, dto);
    this.gateway.broadcastRefresh();
    return template;
  }

  @Delete('templates/:id')
  deleteTemplate(@Param('id') id: string) {
    const result = this.signage.deleteTemplate(id);
    this.gateway.broadcastRefresh();
    return result;
  }
}

function extract(xml: string, tag: string) {
  return xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))?.[1] ?? '';
}

function cleanXml(value: string) {
  return value
    .replace(/<!\[CDATA\[/g, '')
    .replace(/\]\]>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeJs(value: string) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '');
}

function safeHttpUrl(rawUrl?: string) {
  if (!rawUrl) throw new BadRequestException('URL nao informada.');
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BadRequestException('URL invalida.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new BadRequestException('Apenas URLs HTTP/HTTPS sao permitidas.');
  }
  return url;
}

async function zabbixSessionCookie(target: URL, username: string, password: string) {
  const loginUrl = new URL('index.php', new URL('.', target));
  const body = new URLSearchParams({
    name: username,
    password,
    autologin: '1',
    enter: 'Sign in',
  });

  const response = await fetch(loginUrl.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 CorporateSignage/1.0',
    },
    body,
    redirect: 'manual',
  });

  const setCookie = response.headers.get('set-cookie');
  return setCookie
    ?.split(/,(?=[^;]+?=)/)
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

async function grafanaSessionCookie(target: URL, username: string, password: string) {
  const loginUrl = new URL('/login', target.origin);
  const response = await fetch(loginUrl.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 CorporateSignage/1.0',
    },
    body: JSON.stringify({ user: username, password }),
    redirect: 'manual',
  });

  const setCookie = response.headers.get('set-cookie');
  return setCookie
    ?.split(/,(?=[^;]+?=)/)
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

function rewriteFrameHtml(
  html: string,
  target: URL,
  auth: { authMode?: string; username?: string; password?: string } = {},
) {
  const grafanaBase =
    auth.authMode === 'grafana'
      ? grafanaUnifiedUrl(new URL('/', target.origin), auth).replace(/\/$/, '')
      : '';
  const baseHref = grafanaBase ? `${grafanaBase}/` : new URL('.', target).toString();
  const baseTag = `<base href="${baseHref}">`;
  const frameStyles = `<style>html,body{margin:0;min-height:100%;background:#fff;} body{overflow:auto;} iframe{max-width:100%;}</style>${grafanaDiagnosticScript()}`;
  const proxiedGrafanaPublicPath =
    auth.authMode === 'grafana'
      ? grafanaUnifiedUrl(new URL('/public/build/', target.origin), auth)
      : proxyResourceUrl(new URL('/public/build/', target.origin), auth);
  const withoutFrameHeaders = html
    .replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, '')
    .replace(/<meta[^>]+http-equiv=["']?x-frame-options["']?[^>]*>/gi, '');
  const rewrittenPaths = withoutFrameHeaders
    .replace(/\b(src|href|action)=["']([^"']+)["']/gi, (match, attribute: string, rawPath: string) => {
      const proxied = proxiedSameOriginResource(rawPath, target, auth);
      return proxied ? `${attribute}="${proxied}"` : match;
    })
    .replace(/(["'])(\/public\/[^"']+)\1/g, (match, quote: string, rawPath: string) => {
      const proxied = proxiedSameOriginResource(rawPath, target, auth);
      return proxied ? `${quote}${proxied}${quote}` : match;
    })
    .replace(/(["'])(public\/[^"']+)\1/g, (match, quote: string, rawPath: string) => {
      const proxied = proxiedSameOriginResource(rawPath, target, auth);
      return proxied ? `${quote}${proxied}${quote}` : match;
    })
    .replace(/"appSubUrl"\s*:\s*"[^"]*"/g, grafanaBase ? `"appSubUrl":"${grafanaBase}"` : '$&')
    .replace(/"appUrl"\s*:\s*"[^"]*"/g, grafanaBase ? `"appUrl":"${grafanaBase}/"` : '$&')
    .replace(/http:\/\/localhost:3000\//g, grafanaBase ? `${grafanaBase}/` : 'http://localhost:3000/')
    .replace(/(["'])\/api\/(?!proxy\/)([^"']*)\1/g, (_match, quote: string, rawPath: string) => {
      return `${quote}${grafanaUnifiedUrl(new URL(`/api/${rawPath}`, target.origin), auth)}${quote}`;
    })
    .replace(/url\((["']?)(\/[^)"']+)\1\)/gi, (_match, quote: string, rawPath: string) => {
      const proxied = proxiedSameOriginResource(rawPath, target, auth);
      return proxied ? `url(${quote}${proxied}${quote})` : `url(${quote}${rawPath}${quote})`;
    })
    .replace(
      /window\.__grafana_public_path__\s*=\s*['"][^'"]*['"]/gi,
      `window.__grafana_public_path__ = '${proxiedGrafanaPublicPath}'`,
    );

  if (/<head[^>]*>/i.test(rewrittenPaths)) {
    return rewrittenPaths.replace(/<head[^>]*>/i, (match) => `${match}${baseTag}${frameStyles}`);
  }

  return `${baseTag}${frameStyles}${rewrittenPaths}`;
}

function proxiedSameOriginResource(
  rawPath: string,
  target: URL,
  auth: { authMode?: string; username?: string; password?: string },
) {
  if (!rawPath || rawPath.startsWith('#') || rawPath.startsWith('data:') || rawPath.startsWith('mailto:')) {
    return '';
  }

  let resolved: URL;
  try {
    const grafanaRootPath = rawPath.replace(/^\.\//, '');
    resolved = /^public\//i.test(grafanaRootPath)
      ? new URL(`/${grafanaRootPath}`, target.origin)
      : new URL(rawPath, target);
  } catch {
    return '';
  }

  if (!['http:', 'https:'].includes(resolved.protocol)) return '';
  if (resolved.origin !== target.origin) return '';
  if (auth.authMode === 'grafana') return grafanaUnifiedUrl(resolved, auth);
  return proxyResourceUrl(resolved, auth);
}

function proxyResourceUrl(
  target: URL,
  auth: { authMode?: string; username?: string; password?: string },
) {
  const params = new URLSearchParams({
    url: target.toString(),
    authMode: auth.authMode ?? 'proxy',
  });
  if (auth.username) params.set('username', auth.username);
  if (auth.password) params.set('password', auth.password);
  return `/api/proxy/resource?${params.toString()}`;
}

function grafanaImagePageUrl(
  target: URL,
  auth: { authMode?: string; username?: string; password?: string },
) {
  const params = new URLSearchParams({
    url: target.toString(),
    authMode: auth.authMode ?? 'grafana-image',
  });
  if (auth.username) params.set('username', auth.username);
  if (auth.password) params.set('password', auth.password);
  return `/api/proxy/grafana-image?${params.toString()}`;
}

function grafanaImageRenderUrl(
  target: URL,
  auth: { authMode?: string; username?: string; password?: string },
) {
  const params = new URLSearchParams({
    url: target.toString(),
    authMode: auth.authMode ?? 'grafana-image',
  });
  if (auth.username) params.set('username', auth.username);
  if (auth.password) params.set('password', auth.password);
  return `/api/proxy/grafana-image/render?${params.toString()}`;
}

function grafanaImagePageHtml(
  target: URL,
  auth: { authMode?: string; username?: string; password?: string },
) {
  const imageUrl = grafanaImageRenderUrl(target, auth);
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="60">
  <style>
    html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#050816;color:#fff;font-family:Arial,Helvetica,sans-serif}
    #wrap{position:fixed;left:0;top:0;width:100%;height:100%;display:-webkit-box;display:-ms-flexbox;display:flex;-webkit-box-align:center;-ms-flex-align:center;align-items:center;-webkit-box-pack:center;-ms-flex-pack:center;justify-content:center;background:#050816}
    img{width:100%;height:100%;object-fit:contain;background:#050816;border:0}
    #msg{display:none;position:fixed;left:4%;right:4%;bottom:6%;background:rgba(15,23,42,.92);border:1px solid rgba(255,255,255,.25);border-radius:14px;padding:20px;font-size:24px;line-height:1.35;text-align:center}
  </style>
</head>
<body>
  <div id="wrap"><img id="grafana" src="${escapeHtml(imageUrl)}" alt="Grafana"></div>
  <div id="msg">Nao foi possivel renderizar a imagem do Grafana. Verifique se o Grafana Image Renderer esta instalado ou se esta URL possui /render habilitado.</div>
  <script>
    (function(){
      var img=document.getElementById('grafana');
      var msg=document.getElementById('msg');
      function reload(){ img.src='${escapeJs(imageUrl)}&ts='+(new Date().getTime()); }
      img.onerror=function(){ msg.style.display='block'; };
      img.onload=function(){ msg.style.display='none'; };
      setInterval(reload,60000);
    })();
  </script>
</body>
</html>`;
}

function grafanaRenderUrl(target: URL) {
  const renderTarget = new URL(target.toString());
  if (!renderTarget.pathname.startsWith('/render/')) {
    if (renderTarget.pathname.startsWith('/d/') || renderTarget.pathname.startsWith('/d-solo/')) {
      renderTarget.pathname = `/render${renderTarget.pathname}`;
    } else {
      renderTarget.pathname = `/render${renderTarget.pathname.startsWith('/') ? '' : '/'}${renderTarget.pathname}`;
    }
  }
  if (!renderTarget.searchParams.has('orgId')) renderTarget.searchParams.set('orgId', '1');
  if (!renderTarget.searchParams.has('from')) renderTarget.searchParams.set('from', 'now-6h');
  if (!renderTarget.searchParams.has('to')) renderTarget.searchParams.set('to', 'now');
  if (!renderTarget.searchParams.has('width')) renderTarget.searchParams.set('width', '1920');
  if (!renderTarget.searchParams.has('height')) renderTarget.searchParams.set('height', '1080');
  renderTarget.searchParams.set('kiosk', 'tv');
  return renderTarget;
}

function grafanaErrorSvg(target: URL, contentType: string, body: string) {
  const message = [
    'Grafana nao retornou uma imagem.',
    'Use uma URL /render do Grafana ou instale/habilite o Grafana Image Renderer.',
    `URL: ${target.toString()}`,
    `Content-Type: ${contentType}`,
    body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
  ].join('\\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
<rect width="1920" height="1080" fill="#050816"/>
<rect x="170" y="250" width="1580" height="580" rx="34" fill="#111827" stroke="#ef4444" stroke-width="4"/>
<text x="240" y="350" fill="#f87171" font-family="Arial, Helvetica, sans-serif" font-size="46" font-weight="700">Erro ao renderizar Grafana</text>
<foreignObject x="240" y="410" width="1440" height="330">
  <div xmlns="http://www.w3.org/1999/xhtml" style="color:#fff;font:30px Arial,Helvetica,sans-serif;line-height:1.4;white-space:pre-wrap">${escapeHtml(message)}</div>
</foreignObject>
</svg>`;
}

function grafanaResourceUrl(
  target: URL,
  auth: { authMode?: string; username?: string; password?: string },
) {
  const token = encodeGrafanaProxyToken({
    origin: target.origin,
    authMode: auth.authMode,
    username: auth.username,
    password: auth.password,
  });
  return `/api/proxy/grafana-resource/${token}${target.pathname}${target.search}`;
}

function grafanaApiUrl(
  target: URL,
  auth: { authMode?: string; username?: string; password?: string },
) {
  const token = encodeGrafanaProxyToken({
    origin: target.origin,
    authMode: auth.authMode,
    username: auth.username,
    password: auth.password,
  });
  return `/api/proxy/grafana-api/${token}${target.pathname}${target.search}`;
}

function grafanaUnifiedUrl(
  target: URL,
  auth: { authMode?: string; username?: string; password?: string },
) {
  const token = encodeGrafanaProxyToken({
    origin: target.origin,
    authMode: auth.authMode,
    username: auth.username,
    password: auth.password,
  });
  return `/api/proxy/grafana/${token}${target.pathname}${target.search}`;
}

function copyGrafanaRequestHeaders(request: Request, headers: Record<string, string>) {
  const allowedPrefixes = ['x-grafana-', 'x-dashboard-', 'x-panel-', 'x-datasource-'];
  for (const [key, value] of Object.entries(request.headers)) {
    const lowerKey = key.toLowerCase();
    if (!allowedPrefixes.some((prefix) => lowerKey.startsWith(prefix))) continue;
    if (Array.isArray(value)) {
      headers[key] = value.join(', ');
    } else if (value !== undefined) {
      headers[key] = String(value);
    }
  }
}

function isTextLike(contentType: string) {
  return /javascript|json|css|text|xml|svg/i.test(contentType);
}

function rewriteGrafanaResourceBody(body: string, contentType: string, token: string) {
  if (!/javascript|json|text/i.test(contentType)) return body;
  const publicBuildPath = `/api/proxy/grafana/${token}/public/build/`;
  const publicRootPath = `/api/proxy/grafana/${token}/public/`;
  return body
    .replace(/([a-zA-Z0-9_$]+)\.p\s*=\s*["']public\/build\/["']/g, `$1.p="${publicBuildPath}"`)
    .replace(/(["'])public\/build\//g, `$1${publicBuildPath}`)
    .replace(/(["'])\/public\//g, `$1${publicRootPath}`);
}

function grafanaDiagnosticScript() {
  return `<script>
window.addEventListener('error', function(event) {
  var box = document.getElementById('signage-grafana-error');
  if (!box) {
    box = document.createElement('pre');
    box.id = 'signage-grafana-error';
    box.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483647;max-height:35vh;overflow:auto;background:#111827;color:#fecaca;border:2px solid #ef4444;border-radius:8px;padding:12px;font:14px/1.4 monospace;white-space:pre-wrap;';
    document.body.appendChild(box);
  }
  box.textContent += '[Grafana JS] ' + (event.message || 'erro') + '\\n' + (event.filename || '') + ':' + (event.lineno || '') + ':' + (event.colno || '') + '\\n';
});
window.addEventListener('unhandledrejection', function(event) {
  var box = document.getElementById('signage-grafana-error');
  if (!box) {
    box = document.createElement('pre');
    box.id = 'signage-grafana-error';
    box.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483647;max-height:35vh;overflow:auto;background:#111827;color:#fecaca;border:2px solid #ef4444;border-radius:8px;padding:12px;font:14px/1.4 monospace;white-space:pre-wrap;';
    document.body.appendChild(box);
  }
  box.textContent += '[Grafana Promise] ' + (event.reason && (event.reason.stack || event.reason.message) || event.reason || 'rejeicao') + '\\n';
});
</script>`;
}

function encodeGrafanaProxyToken(value: {
  origin: string;
  authMode?: string;
  username?: string;
  password?: string;
}) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeGrafanaProxyToken(token: string): {
  origin: string;
  authMode?: string;
  username?: string;
  password?: string;
} {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    const origin = safeHttpUrl(decoded.origin);
    return {
      origin: origin.origin,
      authMode: typeof decoded.authMode === 'string' ? decoded.authMode : 'proxy',
      username: typeof decoded.username === 'string' ? decoded.username : undefined,
      password: typeof decoded.password === 'string' ? decoded.password : undefined,
    };
  } catch {
    throw new BadRequestException('Proxy Grafana invalido.');
  }
}
