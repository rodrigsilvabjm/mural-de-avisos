import { Injectable } from '@nestjs/common';
import { execFile } from 'child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'fs/promises';
import { Client } from 'minio';
import { extname, join } from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

@Injectable()
export class StorageService {
  private readonly bucket = process.env.MINIO_BUCKET ?? 'signage-assets';
  private readonly client = new Client({
    endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
    port: Number(process.env.MINIO_PORT ?? 9000),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
  });

  async upload(file?: Express.Multer.File) {
    if (!file) {
      return { error: 'Arquivo nao enviado.' };
    }

    await this.ensureBucket();

    const prepared = await this.prepareUploadFile(file);
    const objectName = `${Date.now()}-${prepared.originalname}`;
    const contentType = prepared.contentType;
    await this.client.putObject(
      this.bucket,
      objectName,
      prepared.buffer,
      prepared.buffer.length,
      { 'Content-Type': contentType },
    );

    const convertedSlides = await this.convertPresentationToSlides(file, objectName).catch((error) => ({
      slides: [],
      conversionError: conversionErrorMessage(error),
    }));

    return {
      bucket: this.bucket,
      objectName,
      url: `${process.env.PUBLIC_MEDIA_URL ?? '/media'}/${objectName}`,
      mimeType: contentType,
      size: prepared.buffer.length,
      ...convertedSlides,
    };
  }

  private async prepareUploadFile(file: Express.Multer.File) {
    const extension = extname(file.originalname).toLowerCase();
    if (!isVideoUpload(file)) {
      return {
        originalname: file.originalname,
        buffer: file.buffer,
        contentType: contentTypeFor(file),
      };
    }

    const tempDir = await mkdtemp('/tmp/signage-video-');
    try {
      const inputPath = join(tempDir, `source${extension || '.video'}`);
      const outputPath = join(tempDir, 'source.mp4');
      await writeFile(inputPath, file.buffer);
      await execFileAsync(
        'ffmpeg',
        [
          '-y',
          '-i',
          inputPath,
          '-map',
          '0:v:0',
          '-map',
          '0:a?',
          '-c:v',
          'libx264',
          '-preset',
          'veryfast',
          '-profile:v',
          'baseline',
          '-level',
          '4.0',
          '-pix_fmt',
          'yuv420p',
          '-vf',
          'scale=w=min(1920\\,iw):h=min(1080\\,ih):force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2',
          '-r',
          '30',
          '-bf',
          '0',
          '-refs',
          '3',
          '-maxrate',
          '5000k',
          '-bufsize',
          '10000k',
          '-c:a',
          'aac',
          '-b:a',
          '128k',
          '-ac',
          '2',
          '-ar',
          '44100',
          '-tag:v',
          'avc1',
          '-movflags',
          '+faststart',
          outputPath,
        ],
        { timeout: 900000 },
      );
      return {
        originalname: videoOutputName(file.originalname),
        buffer: await readFile(outputPath),
        contentType: 'video/mp4',
      };
    } catch {
      return {
        originalname: file.originalname,
        buffer: file.buffer,
        contentType: contentTypeFor(file),
      };
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private async convertPresentationToSlides(file: Express.Multer.File, objectName: string) {
    const extension = extname(file.originalname).toLowerCase();
    if (!['.pptx', '.pptm', '.ppt', '.pdf'].includes(extension)) {
      return { slides: [] };
    }

    const tempDir = await mkdtemp('/tmp/signage-doc-');
    try {
      const inputPath = join(tempDir, `source${extension}`);
      await writeFile(inputPath, file.buffer);

      let pdfPath = inputPath;
      if (extension !== '.pdf') {
        await execFileAsync(
          'soffice',
          [
            '--headless',
            '--nologo',
            '--nodefault',
            '--nofirststartwizard',
            '--convert-to',
            'pdf',
            '--outdir',
            tempDir,
            inputPath,
          ],
          { timeout: 600000 },
        );
        pdfPath = join(tempDir, 'source.pdf');
      }

      const outputPrefix = join(tempDir, 'slide');
      await execFileAsync('pdftoppm', ['-png', '-r', '144', pdfPath, outputPrefix]);

      const files = (await readdir(tempDir))
        .filter((name) => /^slide-\d+\.png$/i.test(name))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      const slides: string[] = [];
      for (const slideName of files) {
        const slidePath = join(tempDir, slideName);
        const slideObjectName = `${objectName.replace(/\.[^.]+$/, '')}-${slideName}`;
        await this.client.fPutObject(this.bucket, slideObjectName, slidePath, {
          'Content-Type': 'image/png',
        });
        slides.push(`${process.env.PUBLIC_MEDIA_URL ?? '/media'}/${slideObjectName}`);
      }

      return { slides };
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private async ensureBucket() {
    const exists = await this.client.bucketExists(this.bucket).catch(() => false);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
    }

    await this.client.setBucketPolicy(
      this.bucket,
      JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${this.bucket}/*`],
          },
        ],
      }),
    );
  }
}

function contentTypeFor(file: Express.Multer.File) {
  const name = file.originalname.toLowerCase();
  if (name.endsWith('.mov')) return 'video/quicktime';
  if (name.endsWith('.m4v')) return 'video/mp4';
  if (name.endsWith('.mp4')) return 'video/mp4';
  if (name.endsWith('.webm')) return 'video/webm';
  if (name.endsWith('.pptm')) return 'application/vnd.ms-powerpoint.presentation.macroEnabled.12';
  if (name.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  if (name.endsWith('.ppt')) return 'application/vnd.ms-powerpoint';
  return file.mimetype || 'application/octet-stream';
}

function isVideoUpload(file: Express.Multer.File) {
  const extension = extname(file.originalname).toLowerCase();
  return file.mimetype.startsWith('video/') || ['.mp4', '.mov', '.m4v', '.webm'].includes(extension);
}

function videoOutputName(originalName: string) {
  const baseName = originalName.replace(/\.[^.]+$/i, '') || 'video';
  return `${baseName}-tv.mp4`;
}

function conversionErrorMessage(error: unknown) {
  if (!error || typeof error !== 'object') return 'Falha ao converter arquivo.';
  const record = error as { stderr?: unknown; stdout?: unknown; message?: unknown };
  const stderr = typeof record.stderr === 'string' ? record.stderr.trim() : '';
  const stdout = typeof record.stdout === 'string' ? record.stdout.trim() : '';
  const message = typeof record.message === 'string' ? record.message.trim() : '';
  return stderr || stdout || message || 'Falha ao converter arquivo.';
}
