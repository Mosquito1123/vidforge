import { BadRequestException, Controller, Get, Param, Post, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createReadStream, existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';

const MAX_UPLOAD_BYTES = Number(process.env.UPLOAD_MAX_BYTES ?? 200 * 1024 * 1024);

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'audio/mpeg',
  'audio/wav',
  'audio/mp4',
]);

const MIME_EXTENSION: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/mp4': '.m4a',
};

function uploadDir() {
  const dir = resolve(process.env.UPLOAD_DIR || join(process.cwd(), 'uploads'));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function publicBase() {
  return (process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/$/, '');
}

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  @Post()
  @ApiOperation({ summary: 'Upload an image, video or audio asset (multipart/form-data)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async upload(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException('No file provided');
    if (file.size > MAX_UPLOAD_BYTES) throw new BadRequestException('File too large');
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }

    const extension = MIME_EXTENSION[file.mimetype] ?? (extname(file.originalname || '').toLowerCase() || '.bin');
    const filename = `${randomUUID()}${extension}`;
    await writeFile(join(uploadDir(), filename), file.buffer);

    return {
      url: `${publicBase()}/uploads/${filename}`,
      filename,
      originalName: file.originalname,
      size: file.size,
      contentType: file.mimetype,
    };
  }

  @Get(':filename')
  @ApiOperation({ summary: 'Serve an uploaded asset' })
  serve(@Param('filename') filename: string, @Res({ passthrough: true }) res: Response) {
    const safe = basename(filename);
    const path = join(uploadDir(), safe);
    if (!existsSync(path)) {
      throw new BadRequestException('File not found');
    }
    res.set({ 'Cache-Control': 'public, max-age=86400' });
    return new StreamableFile(createReadStream(path));
  }
}
