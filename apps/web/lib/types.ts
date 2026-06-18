export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export type TransitionName =
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

export interface DashboardSummary {
  totals: {
    assets: number;
    notices: number;
    screens: number;
    onlineScreens: number;
  };
  emergency: EmergencyMessage;
  latestAudit: AuditEvent[];
  branding?: BrandingSettings;
}

export interface EmergencyMessage {
  active: boolean;
  title: string;
  lines: string[];
  bodyHtml?: string;
  startedAt?: string;
}

export interface AuditEvent {
  id: string;
  action: string;
  target: string;
  actorId: string;
  createdAt: string;
}

export interface ContentAsset {
  id: string;
  name: string;
  type: string;
  url: string;
  durationSeconds: number;
  metadata?: {
    fullscreen?: boolean;
    loop?: boolean;
    fitMode?: 'cover' | 'contain';
    hideChrome?: boolean;
    slides?: string[];
    perSlideSeconds?: number;
    slideTransition?: TransitionName;
    authUsername?: string;
    authPassword?: string;
    authMode?: 'none' | 'proxy' | 'basic' | 'zabbix' | 'grafana' | 'grafana-image';
    conversionError?: string;
  };
}

export interface Notice {
  id: string;
  title: string;
  subtitle?: string;
  bodyHtml: string;
  tickerText?: string;
  tickerPersistent?: boolean;
  priority: Priority;
  durationSeconds: number;
  startsAt: string;
  endsAt?: string;
}

export interface Screen {
  id: string;
  code: string;
  name?: string;
  location?: string;
  department?: string;
  group?: string;
  status: 'pending' | 'approved' | 'blocked';
  online: boolean;
  lastSeenAt?: string;
}

export interface Schedule {
  id: string;
  name: string;
  playlistId: string;
  assetId?: string;
  templateId?: string;
  noticeId?: string;
  screenGroup?: string;
  startsAt: string;
  endsAt?: string;
  weekdays: number[];
}

export interface TemplateLayout {
  id: string;
  name: string;
  durationSeconds?: number;
  displayMode?: 'dark' | 'light';
  items: Array<{
    id: string;
    kind: string;
    x: number;
    y: number;
    width: number;
    height: number;
    zIndex: number;
    style: Record<string, unknown>;
    data: Record<string, unknown>;
  }>;
}

export interface CorporateUser {
  id: string;
  name: string;
  email: string;
  role: 'super-admin' | 'admin' | 'editor' | 'operator' | 'viewer';
  active: boolean;
}

export interface BrandingSettings {
  logoUrl?: string;
  logoPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  backgroundType: 'color' | 'gradient' | 'image' | 'video';
  backgroundValue: string;
  backgroundFit?: 'fill' | 'fit' | 'stretch' | 'center' | 'tile';
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  transition: TransitionName;
  exitTransition?: TransitionName;
}

export interface RssItem {
  title: string;
  link: string;
  description: string;
}

export interface PlayerPayload {
  screen: Screen;
  emergency: EmergencyMessage;
  notices: Notice[];
  assets: ContentAsset[];
  schedules?: Schedule[];
  templates?: TemplateLayout[];
  branding?: BrandingSettings;
}
