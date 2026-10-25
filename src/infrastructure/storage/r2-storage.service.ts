import "server-only";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListMultipartUploadsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { errors } from "@/lib/errors";
import { getR2Bucket, getR2Client } from "./r2-client";
import type { ObjectMetadata, ObjectStream, StorageService } from "./storage.types";

function isNotFound(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === "NotFound" || e?.name === "NoSuchKey" || e?.$metadata?.httpStatusCode === 404;
}

/** RFC 6266 filename parameter, ASCII-safe with UTF-8 fallback. */
export function contentDisposition(type: "inline" | "attachment", filename?: string): string {
  if (!filename) return type;
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

class R2StorageService implements StorageService {
  private get s3() {
    return getR2Client();
  }
  private get bucket() {
    return getR2Bucket();
  }

  async presignPut(key: string, opts: { contentType: string; contentLength: number; expiresInSeconds: number }) {
    // Content-Type and Content-Length are signed: R2 rejects an upload whose size or type differs.
    const cmd = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: opts.contentType, ContentLength: opts.contentLength });
    const url = await getSignedUrl(this.s3, cmd, { expiresIn: opts.expiresInSeconds, signableHeaders: new Set(["content-type", "content-length"]) });
    return { url, headers: { "Content-Type": opts.contentType } };
  }

  async createMultipartUpload(key: string, contentType: string) {
    const res = await this.s3.send(new CreateMultipartUploadCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }));
    if (!res.UploadId) throw new Error("R2 did not return an upload id");
    return res.UploadId;
  }

  async presignUploadPart(key: string, uploadId: string, partNumber: number, expiresInSeconds: number) {
    return getSignedUrl(this.s3, new UploadPartCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId, PartNumber: partNumber }), { expiresIn: expiresInSeconds });
  }

  async completeMultipartUpload(key: string, uploadId: string, parts: { partNumber: number; etag: string }[]) {
    await this.s3.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: [...parts].sort((a, b) => a.partNumber - b.partNumber).map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })) },
      }),
    );
  }

  async abortMultipartUpload(key: string, uploadId: string) {
    try {
      await this.s3.send(new AbortMultipartUploadCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId }));
    } catch (err) {
      if (!isNotFound(err)) throw err;
    }
  }

  async headObject(key: string): Promise<ObjectMetadata | null> {
    try {
      const res = await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { size: res.ContentLength ?? 0, contentType: res.ContentType ?? null, lastModified: res.LastModified ?? null };
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  async objectExists(key: string) {
    return (await this.headObject(key)) !== null;
  }

  async getRange(key: string, start: number, endInclusive: number) {
    const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: `bytes=${start}-${endInclusive}` }));
    if (!res.Body) return new Uint8Array();
    return res.Body.transformToByteArray();
  }

  async getBuffer(key: string, maxBytes: number) {
    const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if ((res.ContentLength ?? 0) > maxBytes) throw errors.tooLarge("Object exceeds processing limit");
    if (!res.Body) return Buffer.alloc(0);
    return Buffer.from(await res.Body.transformToByteArray());
  }

  async getStream(key: string, rangeHeader?: string | null): Promise<ObjectStream> {
    try {
      const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: rangeHeader ?? undefined }));
      if (!res.Body) throw errors.notFound("Media");
      const contentRange = res.ContentRange ?? null;
      const total = contentRange ? Number(contentRange.split("/")[1]) : (res.ContentLength ?? 0);
      return {
        body: res.Body.transformToWebStream() as ReadableStream<Uint8Array>,
        status: contentRange ? 206 : 200,
        contentLength: res.ContentLength ?? 0,
        contentRange,
        totalSize: Number.isFinite(total) ? total : (res.ContentLength ?? 0),
      };
    } catch (err) {
      const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (e?.name === "InvalidRange" || e?.$metadata?.httpStatusCode === 416) throw errors.badRequest("Requested range not satisfiable", "INVALID_RANGE");
      if (isNotFound(err)) throw errors.notFound("Media");
      throw err;
    }
  }

  async putObject(key: string, body: Buffer, contentType: string) {
    await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  async presignGet(key: string, opts: { expiresInSeconds: number; downloadFilename?: string; contentType?: string }) {
    const cmd = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: opts.downloadFilename ? contentDisposition("attachment", opts.downloadFilename) : undefined,
      ResponseContentType: opts.contentType,
      ResponseCacheControl: "private, no-store",
    });
    return getSignedUrl(this.s3, cmd, { expiresIn: opts.expiresInSeconds });
  }

  async deleteObject(key: string) {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async listObjects(prefix: string, continuationToken?: string) {
    const res = await this.s3.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: continuationToken, MaxKeys: 1000 }));
    return {
      objects: (res.Contents ?? []).filter((o) => o.Key).map((o) => ({ key: o.Key!, size: o.Size ?? 0, lastModified: o.LastModified ?? new Date(0) })),
      nextToken: res.IsTruncated ? (res.NextContinuationToken ?? null) : null,
    };
  }

  async listMultipartUploads(prefix: string) {
    const res = await this.s3.send(new ListMultipartUploadsCommand({ Bucket: this.bucket, Prefix: prefix, MaxUploads: 1000 }));
    return (res.Uploads ?? []).filter((u) => u.Key && u.UploadId).map((u) => ({ key: u.Key!, uploadId: u.UploadId!, initiated: u.Initiated ?? new Date(0) }));
  }
}

let override: StorageService | undefined;
let instance: StorageService | undefined;

export function getStorage(): StorageService {
  if (override) return override;
  return (instance ??= new R2StorageService());
}

/** Tests inject an in-memory storage. */
export function setStorageForTests(storage: StorageService | undefined): void {
  override = storage;
}
