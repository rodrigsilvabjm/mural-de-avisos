export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export type ScreenStatus = 'pending' | 'approved' | 'blocked';
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

export interface TenantScoped {
  id: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContentAsset extends TenantScoped {
  name: string;
  type:
    | 'image'
    | 'video'
    | 'pdf'
    | 'docx'
    | 'ppt'
    | 'pptm'
    | 'pptx'
    | 'xlsx'
    | 'webpage'
    | 'external-link'
    | 'youtube'
    | 'rss'
    | 'qr-code'
    | 'dashboard';
  url: string;
  durationSeconds: number;
  metadata: Record<string, unknown>;
}

export interface CorporateUser extends TenantScoped {
  name: string;
  email: string;
  role: 'super-admin' | 'admin' | 'editor' | 'operator' | 'viewer';
  active: boolean;
}

export interface BrandingSettings {
  tenantId: string;
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

export interface Notice extends TenantScoped {
  title: string;
  subtitle?: string;
  bodyHtml: string;
  tickerText?: string;
  tickerPersistent?: boolean;
  imageUrl?: string;
  priority: Priority;
  durationSeconds: number;
  startsAt: string;
  endsAt?: string;
  layout: CanvasElement[];
}

export interface CanvasElement {
  id: string;
  kind: 'text' | 'image' | 'video' | 'clock' | 'weather' | 'rss' | 'qr' | 'iframe';
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  style: Record<string, unknown>;
  data: Record<string, unknown>;
}

export interface TemplateLayout extends TenantScoped {
  name: string;
  durationSeconds: number;
  displayMode: 'dark' | 'light';
  items: CanvasElement[];
}

export interface Screen extends TenantScoped {
  code: string;
  name?: string;
  location?: string;
  department?: string;
  group?: string;
  status: ScreenStatus;
  online: boolean;
  lastSeenAt?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface Playlist extends TenantScoped {
  name: string;
  items: PlaylistItem[];
  repeat: boolean;
}

export interface PlaylistItem {
  id: string;
  assetId: string;
  durationSeconds: number;
  order: number;
}

export interface Schedule extends TenantScoped {
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

export interface AuditEvent {
  id: string;
  tenantId: string;
  actorId: string;
  action: string;
  target: string;
  payload: object;
  createdAt: string;
}

export interface EmergencyMessage {
  active: boolean;
  title: string;
  lines: string[];
  bodyHtml?: string;
  startedAt?: string;
}
