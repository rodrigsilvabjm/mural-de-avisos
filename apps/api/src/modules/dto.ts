import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { CanvasElement, Priority, TransitionName } from './models';

export class CreateContentDto {
  @IsString()
  name!: string;

  @IsString()
  type!: string;

  @IsString()
  url!: string;

  @IsNumber()
  durationSeconds = 15;

  @IsOptional()
  @IsObject()
  metadata: Record<string, unknown> = {};
}

export class CreateNoticeDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  subtitle?: string;

  @IsString()
  bodyHtml!: string;

  @IsOptional()
  @IsString()
  tickerText?: string;

  @IsOptional()
  @IsBoolean()
  tickerPersistent?: boolean;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsIn(['low', 'normal', 'high', 'urgent'])
  priority: Priority = 'normal';

  @IsNumber()
  durationSeconds = 15;

  @IsString()
  startsAt!: string;

  @IsOptional()
  @IsString()
  endsAt?: string;

  @IsArray()
  layout: CanvasElement[] = [];
}

export class RegisterScreenDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;
}

export class ApproveScreenDto {
  @IsString()
  name!: string;

  @IsString()
  location!: string;

  @IsString()
  department!: string;

  @IsString()
  group!: string;
}

export class CreatePlaylistDto {
  @IsString()
  name!: string;

  @IsArray()
  items: Array<{ assetId: string; durationSeconds: number; order: number }> = [];

  @IsBoolean()
  repeat = true;
}

export class CreateScheduleDto {
  @IsString()
  name!: string;

  @IsString()
  playlistId!: string;

  @IsOptional()
  @IsString()
  assetId?: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  noticeId?: string;

  @IsOptional()
  @IsString()
  screenGroup?: string;

  @IsString()
  startsAt!: string;

  @IsOptional()
  @IsString()
  endsAt?: string;

  @IsArray()
  weekdays: number[] = [];
}

export class CreateTemplateDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsNumber()
  durationSeconds = 25;

  @IsOptional()
  @IsIn(['dark', 'light'])
  displayMode: 'dark' | 'light' = 'dark';

  @IsArray()
  items: CanvasElement[] = [];
}

export class UpdateBrandingDto {
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  logoPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

  @IsOptional()
  @IsString()
  backgroundType?: 'color' | 'gradient' | 'image' | 'video';

  @IsOptional()
  @IsString()
  backgroundValue?: string;

  @IsOptional()
  @IsString()
  backgroundFit?: 'fill' | 'fit' | 'stretch' | 'center' | 'tile';

  @IsOptional()
  @IsString()
  primaryColor?: string;

  @IsOptional()
  @IsString()
  secondaryColor?: string;

  @IsOptional()
  @IsString()
  fontFamily?: string;

  @IsOptional()
  @IsString()
  transition?: TransitionName;

  @IsOptional()
  @IsString()
  exitTransition?: TransitionName;
}

export class CreateUserDto {
  @IsString()
  name!: string;

  @IsString()
  email!: string;

  @IsString()
  role!: 'super-admin' | 'admin' | 'editor' | 'operator' | 'viewer';
}

export class RssPreviewDto {
  @IsString()
  url!: string;
}

export class EmergencyDto {
  @IsBoolean()
  active!: boolean;

  @IsString()
  title!: string;

  @IsArray()
  lines!: string[];

  @IsOptional()
  @IsString()
  bodyHtml?: string;
}
