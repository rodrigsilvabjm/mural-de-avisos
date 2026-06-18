import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import {
  AuditEvent,
  BrandingSettings,
  ContentAsset,
  CorporateUser,
  EmergencyMessage,
  Notice,
  Playlist,
  Schedule,
  Screen,
  TemplateLayout,
} from './models';
import {
  ApproveScreenDto,
  CreateContentDto,
  CreateNoticeDto,
  CreatePlaylistDto,
  CreateScheduleDto,
  CreateTemplateDto,
  CreateUserDto,
  EmergencyDto,
  RegisterScreenDto,
  UpdateBrandingDto,
} from './dto';

const tenantId = 'default-tenant';
const stateFile = process.env.SIGNAGE_STATE_FILE ?? '/data/signage-state.json';
const screenOfflineAfterMs = 60 * 1000;
const screenHideAfterMs = 5 * 60 * 1000;
const screenCodePattern = /^[A-Z0-9_-]{2,32}$/;

function now() {
  return new Date().toISOString();
}

function parseDate(value?: string) {
  if (!value) return undefined;
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && !/(Z|[+-]\d{2}:\d{2})$/.test(value)
    ? `${value}:00-03:00`
    : value;
  const time = new Date(normalized).getTime();
  return Number.isNaN(time) ? undefined : time;
}

function isInWindow(startsAt?: string, endsAt?: string, date = new Date()) {
  const current = date.getTime();
  const starts = parseDate(startsAt);
  const ends = parseDate(endsAt);
  return (starts === undefined || starts <= current) && (ends === undefined || ends >= current);
}

function isWeekdayAllowed(weekdays: number[] = [], date = new Date()) {
  if (weekdays.length === 0) return true;
  return weekdays.includes(date.getDay());
}

function id(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}

@Injectable()
export class SignageService {
  private readonly assets: ContentAsset[] = [];
  private readonly notices: Notice[] = [];
  private readonly screens: Screen[] = [];
  private readonly playlists: Playlist[] = [];
  private readonly schedules: Schedule[] = [];
  private readonly templates: TemplateLayout[] = [];
  private readonly users: CorporateUser[] = [];
  private readonly audit: AuditEvent[] = [];
  private branding: BrandingSettings = {
    tenantId,
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
  private emergency: EmergencyMessage = {
    active: false,
    title: 'ATENCAO',
    lines: [],
  };

  constructor() {
    this.loadState();
  }

  seed() {
    return;
  }

  dashboard() {
    this.seed();
    const screens = this.listScreens();
    return {
      totals: {
        assets: this.assets.length,
        notices: this.notices.length,
        screens: screens.length,
        onlineScreens: screens.filter((screen) => screen.online).length,
      },
      emergency: this.emergency,
      latestAudit: this.audit.slice(-8).reverse(),
      branding: this.branding,
    };
  }

  listAssets() {
    this.seed();
    return this.assets;
  }

  createAsset(dto: CreateContentDto) {
    const createdAt = now();
    const asset: ContentAsset = {
      id: id('asset'),
      tenantId,
      createdAt,
      updatedAt: createdAt,
      name: dto.name,
      type: dto.type as ContentAsset['type'],
      url: dto.url,
      durationSeconds: dto.durationSeconds,
      metadata: dto.metadata ?? {},
    };
    this.assets.push(asset);
    this.recordAudit('system', 'content.created', asset.id, dto);
    this.saveState();
    return asset;
  }

  updateAsset(assetId: string, dto: Partial<CreateContentDto>) {
    const asset = this.assets.find((item) => item.id === assetId);
    if (!asset) return undefined;
    Object.assign(asset, dto, { updatedAt: now() });
    this.recordAudit('system', 'content.updated', asset.id, dto);
    this.saveState();
    return asset;
  }

  deleteAsset(assetId: string) {
    const index = this.assets.findIndex((item) => item.id === assetId);
    if (index < 0) return { deleted: false };
    const [asset] = this.assets.splice(index, 1);
    this.recordAudit('system', 'content.deleted', asset.id, {});
    this.saveState();
    return { deleted: true };
  }

  listNotices() {
    this.seed();
    return this.notices;
  }

  createNotice(dto: CreateNoticeDto) {
    const createdAt = now();
    const notice: Notice = {
      id: id('notice'),
      tenantId,
      createdAt,
      updatedAt: createdAt,
      ...dto,
      durationSeconds: dto.durationSeconds ?? 15,
    };
    this.notices.push(notice);
    this.recordAudit('system', 'notice.created', notice.id, dto);
    this.saveState();
    return notice;
  }

  updateNotice(noticeId: string, dto: Partial<CreateNoticeDto>) {
    const notice = this.notices.find((item) => item.id === noticeId);
    if (!notice) return undefined;
    Object.assign(notice, dto, { updatedAt: now() });
    this.recordAudit('system', 'notice.updated', notice.id, dto);
    this.saveState();
    return notice;
  }

  deleteNotice(noticeId: string) {
    const index = this.notices.findIndex((item) => item.id === noticeId);
    if (index < 0) return { deleted: false };
    const [notice] = this.notices.splice(index, 1);
    this.recordAudit('system', 'notice.deleted', notice.id, {});
    this.saveState();
    return { deleted: true };
  }

  registerScreen(dto: RegisterScreenDto, ipAddress?: string) {
    const code = sanitizeScreenCode(dto.code) ?? `TV-${Math.floor(10000 + Math.random() * 89999)}`;
    const existing = this.screens.find((screen) => screen.code === code);
    if (existing) {
      existing.online = true;
      existing.lastSeenAt = now();
      existing.ipAddress = ipAddress;
      existing.userAgent = dto.userAgent;
      existing.updatedAt = now();
      this.saveState();
      return existing;
    }

    const createdAt = now();
    const screen: Screen = {
      id: id('screen'),
      tenantId,
      createdAt,
      updatedAt: createdAt,
      code,
      status: 'pending',
      online: true,
      lastSeenAt: createdAt,
      ipAddress,
      userAgent: dto.userAgent,
    };
    this.screens.push(screen);
    this.recordAudit('system', 'screen.registered', screen.id, { code });
    this.saveState();
    return screen;
  }

  approveScreen(code: string, dto: ApproveScreenDto) {
    const screen = this.screens.find((item) => item.code === code);
    if (!screen) return undefined;

    Object.assign(screen, dto, {
      status: 'approved',
      updatedAt: now(),
    });
    this.recordAudit('system', 'screen.approved', screen.id, dto);
    this.saveState();
    return screen;
  }

  listScreens() {
    this.refreshScreenPresence();
    return this.screens.filter((screen) => isValidScreenCode(screen.code));
  }

  markOnline(code: string, userAgent?: string) {
    const screen = this.registerScreen({ code: sanitizeScreenCode(code) ?? 'TV001', userAgent });
    screen.online = true;
    screen.lastSeenAt = now();
    screen.updatedAt = now();
    this.saveState();
    return screen;
  }

  markOffline(code: string) {
    const screen = this.screens.find((item) => item.code === code);
    if (screen) {
      screen.online = false;
      screen.updatedAt = now();
      this.saveState();
    }
    return screen;
  }

  listPlaylists() {
    return this.playlists;
  }

  createPlaylist(dto: CreatePlaylistDto) {
    const createdAt = now();
    const playlist: Playlist = {
      id: id('playlist'),
      tenantId,
      createdAt,
      updatedAt: createdAt,
      name: dto.name,
      repeat: dto.repeat,
      items: dto.items.map((item) => ({
        id: id('playlist_item'),
        ...item,
      })),
    };
    this.playlists.push(playlist);
    this.recordAudit('system', 'playlist.created', playlist.id, dto);
    this.saveState();
    return playlist;
  }

  listSchedules() {
    return this.schedules;
  }

  createSchedule(dto: CreateScheduleDto) {
    const createdAt = now();
    const schedule: Schedule = {
      id: id('schedule'),
      tenantId,
      createdAt,
      updatedAt: createdAt,
      ...dto,
    };
    this.schedules.push(schedule);
    this.recordAudit('system', 'schedule.created', schedule.id, dto);
    this.saveState();
    return schedule;
  }

  listTemplates() {
    return this.templates;
  }

  createTemplate(dto: CreateTemplateDto) {
    const createdAt = now();
    const existing = this.templates.find((template) => template.name === dto.name);
    if (existing) {
      existing.items = dto.items;
      existing.durationSeconds = dto.durationSeconds ?? existing.durationSeconds ?? 25;
      existing.displayMode = dto.displayMode ?? existing.displayMode ?? 'dark';
      existing.updatedAt = createdAt;
      this.recordAudit('system', 'template.updated', existing.id, dto);
      this.saveState();
      return existing;
    }

    const template: TemplateLayout = {
      id: id('template'),
      tenantId,
      createdAt,
      updatedAt: createdAt,
      name: dto.name,
      durationSeconds: dto.durationSeconds ?? 25,
      displayMode: dto.displayMode ?? 'dark',
      items: dto.items,
    };
    this.templates.push(template);
    this.recordAudit('system', 'template.created', template.id, dto);
    this.saveState();
    return template;
  }

  updateTemplate(templateId: string, dto: Partial<CreateTemplateDto>) {
    const template = this.templates.find((item) => item.id === templateId);
    if (!template) return undefined;
    Object.assign(template, dto, { updatedAt: now() });
    this.recordAudit('system', 'template.updated', template.id, dto);
    this.saveState();
    return template;
  }

  deleteTemplate(templateId: string) {
    const index = this.templates.findIndex((item) => item.id === templateId);
    if (index < 0) return { deleted: false };
    const [template] = this.templates.splice(index, 1);
    this.recordAudit('system', 'template.deleted', template.id, {});
    this.saveState();
    return { deleted: true };
  }

  updateSchedule(scheduleId: string, dto: Partial<CreateScheduleDto>) {
    const schedule = this.schedules.find((item) => item.id === scheduleId);
    if (!schedule) return undefined;
    Object.assign(schedule, dto, { updatedAt: now() });
    this.recordAudit('system', 'schedule.updated', schedule.id, dto);
    this.saveState();
    return schedule;
  }

  deleteSchedule(scheduleId: string) {
    const index = this.schedules.findIndex((item) => item.id === scheduleId);
    if (index < 0) return { deleted: false };
    const [schedule] = this.schedules.splice(index, 1);
    this.recordAudit('system', 'schedule.deleted', schedule.id, {});
    this.saveState();
    return { deleted: true };
  }

  playerPayload(code: string) {
    const screen = this.registerScreen({ code: sanitizeScreenCode(code) ?? 'TV001' });
    const date = new Date();
    const notices = this.listNotices().filter((notice) => isInWindow(notice.startsAt, notice.endsAt, date));
    const activeSchedules = this.schedules.filter((schedule) => {
      const groupMatches = !schedule.screenGroup || schedule.screenGroup === screen.group || schedule.screenGroup === code;
      return groupMatches && isInWindow(schedule.startsAt, schedule.endsAt, date) && isWeekdayAllowed(schedule.weekdays, date);
    });
    const scheduledAssetIds = new Set(activeSchedules.map((schedule) => schedule.assetId).filter(Boolean));
    const scheduledTemplateIds = new Set(activeSchedules.map((schedule) => schedule.templateId).filter(Boolean));
    const scheduledNoticeIds = new Set(activeSchedules.map((schedule) => schedule.noticeId).filter(Boolean));
    const hasScheduledTargets =
      scheduledAssetIds.size > 0 || scheduledTemplateIds.size > 0 || scheduledNoticeIds.size > 0;

    return {
      screen,
      emergency: this.emergency,
      notices: hasScheduledTargets
        ? notices.filter((notice) => scheduledNoticeIds.has(notice.id) || (notice.tickerPersistent && notice.tickerText))
        : notices,
      assets: hasScheduledTargets
        ? this.listAssets().filter((asset) => scheduledAssetIds.has(asset.id))
        : this.listAssets(),
      playlists: this.playlists,
      schedules: this.schedules,
      templates: hasScheduledTargets
        ? this.templates.filter((template) => scheduledTemplateIds.has(template.id))
        : this.templates,
      branding: this.branding,
    };
  }

  setEmergency(dto: EmergencyDto) {
    this.emergency = {
      ...dto,
      startedAt: dto.active ? now() : undefined,
    };
    this.recordAudit('system', dto.active ? 'emergency.started' : 'emergency.ended', 'global', dto);
    this.saveState();
    return this.emergency;
  }

  getEmergency() {
    return this.emergency;
  }

  listAudit() {
    return this.audit.slice().reverse();
  }

  getBranding() {
    return this.branding;
  }

  updateBranding(dto: UpdateBrandingDto) {
    this.branding = { ...this.branding, ...dto };
    this.recordAudit('system', 'branding.updated', 'branding', dto);
    this.saveState();
    return this.branding;
  }

  listUsers() {
    if (this.users.length === 0) {
      const createdAt = now();
      this.users.push({
        id: id('user'),
        tenantId,
        createdAt,
        updatedAt: createdAt,
        name: 'Administrador',
        email: 'admin@empresa.com',
        role: 'admin',
        active: true,
      });
      this.saveState();
    }
    return this.users;
  }

  createUser(dto: CreateUserDto) {
    const createdAt = now();
    const user: CorporateUser = {
      id: id('user'),
      tenantId,
      createdAt,
      updatedAt: createdAt,
      name: dto.name,
      email: dto.email,
      role: dto.role,
      active: true,
    };
    this.users.push(user);
    this.recordAudit('system', 'user.created', user.id, dto);
    this.saveState();
    return user;
  }

  deleteUser(userId: string) {
    const index = this.users.findIndex((item) => item.id === userId);
    if (index < 0) return { deleted: false };
    const [user] = this.users.splice(index, 1);
    this.recordAudit('system', 'user.deleted', user.id, {});
    this.saveState();
    return { deleted: true };
  }

  private recordAudit(
    actorId: string,
    action: string,
    target: string,
    payload: object,
  ) {
    this.audit.push({
      id: id('audit'),
      tenantId,
      actorId,
      action,
      target,
      payload,
      createdAt: now(),
    });
  }

  private loadState() {
    try {
      if (!existsSync(stateFile)) return;
      const state = JSON.parse(readFileSync(stateFile, 'utf8')) as Partial<{
        assets: ContentAsset[];
        notices: Notice[];
        screens: Screen[];
        playlists: Playlist[];
        schedules: Schedule[];
        templates: TemplateLayout[];
        users: CorporateUser[];
        audit: AuditEvent[];
        branding: BrandingSettings;
        emergency: EmergencyMessage;
      }>;

      this.assets.push(...(state.assets ?? []));
      this.notices.push(...(state.notices ?? []));
      this.screens.push(...(state.screens ?? []));
      this.playlists.push(...(state.playlists ?? []));
      this.schedules.push(...(state.schedules ?? []));
      this.templates.push(...(state.templates ?? []));
      this.users.push(...(state.users ?? []));
      this.audit.push(...(state.audit ?? []));
      this.branding = state.branding ?? this.branding;
      this.emergency = state.emergency ?? this.emergency;
    } catch (error) {
      console.error('Falha ao carregar estado do signage', error);
    }
  }

  private refreshScreenPresence() {
    const current = Date.now();
    let changed = false;

    for (const screen of this.screens) {
      if (!isValidScreenCode(screen.code)) {
        screen.online = false;
        changed = true;
        continue;
      }

      const lastSeen = parseDate(screen.lastSeenAt);
      if (lastSeen !== undefined && current - lastSeen > screenOfflineAfterMs && screen.online) {
        screen.online = false;
        screen.updatedAt = now();
        changed = true;
      }
    }

    for (let index = this.screens.length - 1; index >= 0; index -= 1) {
      const screen = this.screens[index];
      const lastSeen = parseDate(screen.lastSeenAt) ?? parseDate(screen.updatedAt) ?? parseDate(screen.createdAt) ?? 0;
      const shouldHide = !isValidScreenCode(screen.code) || (!screen.online && current - lastSeen > screenHideAfterMs);
      if (shouldHide) {
        this.screens.splice(index, 1);
        changed = true;
      }
    }

    if (changed) this.saveState();
  }

  private saveState() {
    try {
      mkdirSync(dirname(stateFile), { recursive: true });
      writeFileSync(
        stateFile,
        JSON.stringify(
          {
            assets: this.assets,
            notices: this.notices,
            screens: this.screens,
            playlists: this.playlists,
            schedules: this.schedules,
            templates: this.templates,
            users: this.users,
            audit: this.audit.slice(-250),
            branding: this.branding,
            emergency: this.emergency,
          },
          null,
          2,
        ),
      );
    } catch (error) {
      console.error('Falha ao salvar estado do signage', error);
    }
  }
}

function sanitizeScreenCode(value?: string) {
  if (!value) return undefined;
  const decoded = safeDecodeURIComponent(value);
  const normalized = decoded
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '');
  return isValidScreenCode(normalized) ? normalized : undefined;
}

function isValidScreenCode(value?: string) {
  return Boolean(value && screenCodePattern.test(value));
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
