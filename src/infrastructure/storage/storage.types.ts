export interface ObjectMetadata {
  size: number;
  contentType: string | null;
  lastModified: Date | null;
}

export interface ObjectStream {
  body: ReadableStream<Uint8Array>;
  status: 200 | 206;
  contentLength: number;
  contentRange: string | null;
  totalSize: number;
}

export interface StoredObjectInfo {
  key: string;
  size: number;
  lastModified: Date;
}

export interface MultipartUploadInfo {
  key: string;
  uploadId: string;
  initiated: Date;
}

/**
 * Storage abstraction used by the media services. Business code never touches
 * the S3 SDK directly; tests substitute an in-memory implementation.
 */
export interface StorageService {
  presignPut(key: string, opts: { contentType: string; contentLength: number; expiresInSeconds: number }): Promise<{ url: string; headers: Record<string, string> }>;
  createMultipartUpload(key: string, contentType: string): Promise<string>;
  presignUploadPart(key: string, uploadId: string, partNumber: number, expiresInSeconds: number): Promise<string>;
  completeMultipartUpload(key: string, uploadId: string, parts: { partNumber: number; etag: string }[]): Promise<void>;
  abortMultipartUpload(key: string, uploadId: string): Promise<void>;
  headObject(key: string): Promise<ObjectMetadata | null>;
  objectExists(key: string): Promise<boolean>;
  getRange(key: string, start: number, endInclusive: number): Promise<Uint8Array>;
  getBuffer(key: string, maxBytes: number): Promise<Buffer>;
  getStream(key: string, rangeHeader?: string | null): Promise<ObjectStream>;
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  presignGet(key: string, opts: { expiresInSeconds: number; downloadFilename?: string; contentType?: string }): Promise<string>;
  deleteObject(key: string): Promise<void>;
  listObjects(prefix: string, continuationToken?: string): Promise<{ objects: StoredObjectInfo[]; nextToken: string | null }>;
  listMultipartUploads(prefix: string): Promise<MultipartUploadInfo[]>;
}
