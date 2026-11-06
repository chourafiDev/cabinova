import type { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';

/**
 * The platform's object storage (Cloudflare R2 in production, MinIO in the
 * tests): one bucket, each cabinet under its own prefix. Files go through
 * this API, never straight from the browser, so access stays checked here.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;

  constructor(config: ConfigService<Env, true>) {
    const endpoint = config.get('S3_ENDPOINT', { infer: true });
    this.bucket = config.get('S3_BUCKET', { infer: true }) ?? '';
    this.client = endpoint
      ? new S3Client({
          endpoint,
          region: config.get('S3_REGION', { infer: true }),
          // MinIO needs bucket-in-path; R2 takes both.
          forcePathStyle: true,
          credentials: {
            accessKeyId: config.get('S3_ACCESS_KEY_ID', { infer: true })!,
            secretAccessKey: config.get('S3_SECRET_ACCESS_KEY', {
              infer: true,
            })!,
          },
        })
      : null;
  }

  async put(key: string, body: Buffer, contentType: string) {
    await this.call(() =>
      this.require().send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      ),
    );
  }

  async get(key: string) {
    const object = await this.call(() =>
      this.require().send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      ),
    );
    return object.Body as Readable;
  }

  async remove(key: string) {
    await this.call(() =>
      this.require().send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      ),
    );
  }

  private require() {
    if (!this.client) {
      throw new ConflictException({
        code: 'STORAGE_NOT_CONFIGURED',
        message: 'L’envoi de documents n’est pas encore disponible.',
      });
    }
    return this.client;
  }

  private async call<T>(run: () => Promise<T>) {
    try {
      return await run();
    } catch (err) {
      if (err instanceof ConflictException) throw err;
      this.logger.warn(`Storage call failed: ${String(err)}`);
      throw new ServiceUnavailableException({
        code: 'STORAGE_UNAVAILABLE',
        message:
          'Le stockage des documents ne répond pas. Réessayez dans un instant.',
      });
    }
  }
}
