import { Injectable } from '@nestjs/common';
import { execFile } from 'child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'fs/promises';
import { Client } from 'minio';
import { basename, extname, join } from 'path';
import { Readable } from 'stream';
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

  async compatibleVideoUrl(rawUrl: string) {
    const compatibleObjectName = await this.ensureCompatibleVideo(rawUrl);
    return `${process.env.PUBLIC_MEDIA_URL ?? '/media'}/${compatibleObjectName}`;
  }

  async compatibleVideoStream(rawUrl: string, range?: string) {
    const objectName = await this.ensureCompatibleVideo(rawUrl);
    const stat = await this.client.statObject(this.bucket, objectName);
    const size = Number(stat.size ?? 0);
    const headers: Record<string, string | number> = {
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
    };

    const parsed = parseRange(range, size);
    if (parsed) {
      const { start, end } = parsed;
      const length = end - start + 1;
      return {
        status: 206,
        headers: {
          ...headers,
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Content-Length': length,
        },
        stream: await this.client.getPartialObject(this.bucket, objectName, start, length),
      };
    }

    return {
      status: 200,
      headers: {
        ...headers,
        'Content-Length': size,
      },
      stream: await this.client.getObject(this.bucket, objectName),
    };
  }

  private async ensureCompatibleVideo(rawUrl: string) {
    const objectName = objectNameFromMediaUrl(rawUrl);
    const compatibleObjectName = objectName.replace(/\.[^.]+$/, '') + '-compat.mp4';
    await this.ensureBucket();

    const exists = await this.client.statObject(this.bucket, compatibleObjectName).then(() => true).catch(() => false);
    if (exists) return compatibleObjectName;

    const stream = await this.client.getObject(this.bucket, objectName);
    const inputBuffer = await streamToBuffer(stream);
    const tempDir = await mkdtemp('/tmp/signage-video-compat-');
    try {
      const inputPath = join(tempDir, basename(objectName));
      const outputPath = join(tempDir, 'compatible.mp4');
      await writeFile(inputPath, inputBuffer);
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
          'main',
          '-level',
          '4.0',
          '-pix_fmt',
          'yuv420p',
          '-vf',
          'scale=trunc(iw/2)*2:trunc(ih/2)*2',
          '-c:a',
          'aac',
          '-b:a',
          '128k',
          '-movflags',
          '+faststart',
          outputPath,
        ],
        { timeout: 900000 },
      );
      await this.client.fPutObject(this.bucket, compatibleObjectName, outputPath, {
        'Content-Type': 'video/mp4',
      });
      return compatibleObjectName;
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private async prepareUploadFile(file: Express.Multer.File) {
    const extension = extname(file.originalname).toLowerCase();
    if (extension !== '.mov') {
      return {
        originalname: file.originalname,
        buffer: file.buffer,
        contentType: contentTypeFor(file),
      };
    }

    const tempDir = await mkdtemp('/tmp/signage-video-');
    try {
      const inputPath = join(tempDir, 'source.mov');
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
          '-pix_fmt',
          'yuv420p',
          '-c:a',
          'aac',
          '-movflags',
          '+faststart',
          outputPath,
        ],
        { timeout: 900000 },
      );
      return {
        originalname: file.originalname.replace(/\.mov$/i, '.mp4'),
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
  if (name.endsWith('.mp4')) return 'video/mp4';
  if (name.endsWith('.webm')) return 'video/webm';
  if (name.endsWith('.pptm')) return 'application/vnd.ms-powerpoint.presentation.macroEnabled.12';
  if (name.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  if (name.endsWith('.ppt')) return 'application/vnd.ms-powerpoint';
  return file.mimetype || 'application/octet-stream';
}

function objectNameFromMediaUrl(rawUrl: string) {
  const decoded = decodeURIComponent(rawUrl);
  const mediaPrefix = '/media/';
  const index = decoded.indexOf(mediaPrefix);
  if (index >= 0) return decoded.slice(index + mediaPrefix.length).split(/[?#]/)[0];
  try {
    const url = new URL(decoded);
    const pathIndex = url.pathname.indexOf(mediaPrefix);
    if (pathIndex >= 0) return url.pathname.slice(pathIndex + mediaPrefix.length);
  } catch {
    // handled below
  }
  throw new Error('URL de video invalida para compatibilidade.');
}

async function streamToBuffer(stream: Readable) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function parseRange(range: string | undefined, size: number) {
  if (!range || size <= 0) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim());
  if (!match) return null;

  let start = match[1] ? Number(match[1]) : 0;
  let end = match[2] ? Number(match[2]) : size - 1;

  if (!match[1] && match[2]) {
    const suffixLength = Number(match[2]);
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) return null;
  if (start >= size) return null;
  end = Math.min(end, size - 1);
  return { start, end };
}

function conversionErrorMessage(error: unknown) {
  if (!error || typeof error !== 'object') return 'Falha ao converter arquivo.';
  const record = error as { stderr?: unknown; stdout?: unknown; message?: unknown };
  const stderr = typeof record.stderr === 'string' ? record.stderr.trim() : '';
  const stdout = typeof record.stdout === 'string' ? record.stdout.trim() : '';
  const message = typeof record.message === 'string' ? record.message.trim() : '';
  return stderr || stdout || message || 'Falha ao converter arquivo.';
}
