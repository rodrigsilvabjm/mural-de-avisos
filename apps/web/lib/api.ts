import {
  BrandingSettings,
  ContentAsset,
  CorporateUser,
  DashboardSummary,
  EmergencyMessage,
  Notice,
  PlayerPayload,
  RssItem,
  Schedule,
  Screen,
  TemplateLayout,
} from './types';

function getApiUrl() {
  if (typeof window !== 'undefined' && window.location.port === '8080') {
    return '/api';
  }
  if (typeof window === 'undefined') {
    return process.env.SERVER_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
}

async function request<T>(path: string, init?: RequestInit, fallback?: T): Promise<T> {
  try {
    const response = await fetch(`${getApiUrl()}${path}`, {
      ...init,
      headers: init?.body instanceof FormData
        ? init.headers
        : {
            'Content-Type': 'application/json',
            ...init?.headers,
          },
      cache: 'no-store',
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(errorMessageForResponse(path, response.status, text));
    }
    return response.json() as Promise<T>;
  } catch (error) {
    if (fallback !== undefined) return fallback;
    if (error instanceof Error && error.message) throw error;
    throw new Error(`Falha ao carregar ${path}`);
  }
}

function errorMessageForResponse(path: string, status: number, body: string) {
  if (status === 504 && path.includes('/contents/upload')) {
    return 'O upload foi recebido, mas a conversao demorou demais. Tente novamente; se o arquivo for muito grande, salve como PDF ou divida a apresentacao.';
  }
  if (status === 413) {
    return 'Arquivo muito grande para upload.';
  }
  try {
    const parsed = JSON.parse(body) as { message?: string | string[]; error?: string };
    const message = Array.isArray(parsed.message) ? parsed.message.join(', ') : parsed.message;
    return message || parsed.error || `HTTP ${status}`;
  } catch {
    return body?.trim() ? `HTTP ${status}: ${body.trim().slice(0, 220)}` : `HTTP ${status}`;
  }
}

function json<T>(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown) {
  return request<T>(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const emergency: EmergencyMessage = {
  active: false,
  title: 'ATENCAO',
  lines: ['MANUTENCAO PROGRAMADA', 'INICIO AS 18:00'],
};

const branding: BrandingSettings = {
  logoPosition: 'top-left',
  backgroundType: 'gradient',
  backgroundValue: 'linear-gradient(135deg,#0f172a,#111827 45%,#1e3a8a)',
  backgroundFit: 'fill',
  primaryColor: '#155EEF',
  secondaryColor: '#0f172a',
  fontFamily: 'Inter, Roboto, Arial',
  transition: 'fade',
  exitTransition: 'fade',
};

const assets: ContentAsset[] = [
  {
    id: 'asset_demo_1',
    name: 'Comunicado institucional',
    type: 'image',
    url: '/demo/comunicado.png',
    durationSeconds: 15,
  },
  {
    id: 'asset_demo_2',
    name: 'Dashboard comercial',
    type: 'dashboard',
    url: 'https://app.powerbi.com/reportEmbed',
    durationSeconds: 45,
  },
];

const notices: Notice[] = [
  {
    id: 'notice_demo_1',
    title: 'Manutencao programada',
    subtitle: 'Hoje as 18:00',
    bodyHtml: '<strong>Favor desligar os equipamentos</strong> antes do inicio.',
    priority: 'urgent',
    durationSeconds: 20,
    startsAt: new Date().toISOString(),
  },
];

const screens: Screen[] = [
  {
    id: 'screen_demo_1',
    code: 'TV001',
    name: 'Recepcao',
    location: 'Matriz',
    department: 'Administrativo',
    group: 'Hall',
    status: 'approved',
    online: true,
    lastSeenAt: new Date().toISOString(),
  },
];

export const api = {
  dashboard: () =>
    request<DashboardSummary>('/dashboard', undefined, {
      totals: {
        assets: assets.length,
        notices: notices.length,
        screens: screens.length,
        onlineScreens: screens.filter((screen) => screen.online).length,
      },
      emergency,
      branding,
      latestAudit: [],
    }),
  contents: () => request<ContentAsset[]>('/contents', undefined, assets),
  createContent: (payload: Partial<ContentAsset>) =>
    json<ContentAsset>('/contents', 'POST', payload),
  updateContent: (id: string, payload: Partial<ContentAsset>) =>
    json<ContentAsset>(`/contents/${id}`, 'PUT', payload),
  deleteContent: (id: string) => json<{ deleted: boolean }>(`/contents/${id}`, 'DELETE'),
  upload: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<{ url: string; mimeType: string; size: number; slides?: string[]; conversionError?: string }>('/contents/upload', {
      method: 'POST',
      body: form,
    });
  },
  notices: () => request<Notice[]>('/notices', undefined, notices),
  createNotice: (payload: Partial<Notice>) => json<Notice>('/notices', 'POST', payload),
  updateNotice: (id: string, payload: Partial<Notice>) =>
    json<Notice>(`/notices/${id}`, 'PUT', payload),
  deleteNotice: (id: string) => json<{ deleted: boolean }>(`/notices/${id}`, 'DELETE'),
  screens: () => request<Screen[]>('/screens', undefined, screens),
  schedules: () => request<Schedule[]>('/schedules', undefined, []),
  createSchedule: (payload: Partial<Schedule>) => json<Schedule>('/schedules', 'POST', payload),
  updateSchedule: (id: string, payload: Partial<Schedule>) =>
    json<Schedule>(`/schedules/${id}`, 'PUT', payload),
  deleteSchedule: (id: string) => json<{ deleted: boolean }>(`/schedules/${id}`, 'DELETE'),
  templates: () => request<TemplateLayout[]>('/templates', undefined, []),
  createTemplate: (payload: Partial<TemplateLayout>) =>
    json<TemplateLayout>('/templates', 'POST', payload),
  updateTemplate: (id: string, payload: Partial<TemplateLayout>) =>
    json<TemplateLayout>(`/templates/${id}`, 'PUT', payload),
  deleteTemplate: (id: string) => json<{ deleted: boolean }>(`/templates/${id}`, 'DELETE'),
  branding: () => request<BrandingSettings>('/branding', undefined, branding),
  updateBranding: (payload: Partial<BrandingSettings>) =>
    json<BrandingSettings>('/branding', 'PUT', payload),
  users: () => request<CorporateUser[]>('/users', undefined, []),
  createUser: (payload: Partial<CorporateUser>) => json<CorporateUser>('/users', 'POST', payload),
  deleteUser: (id: string) => json<{ deleted: boolean }>(`/users/${id}`, 'DELETE'),
  rssPreview: (url: string) =>
    json<{ url: string; items: RssItem[] }>('/rss/preview', 'POST', { url }),
  player: (code: string) =>
    request<PlayerPayload>(`/player/${code}`, undefined, {
      screen: screens.find((screen) => screen.code === code) ?? screens[0],
      emergency,
      assets,
      notices,
      branding,
    }),
  setEmergency: (payload: EmergencyMessage) =>
    json<EmergencyMessage>('/emergency', 'POST', payload),
};
