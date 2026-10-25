import type { AllowedMimeType } from "@/modules/media/media.constants";

const ascii = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.subarray(start, Math.min(bytes.length, start + length)));

const MP4_BRANDS = new Set(["isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "dash", "M4V ", "M4VP", "mmp4", "MSNV", "3gp4", "3gp5", "3g2a"]);

/**
 * Identify a file from its leading bytes (magic numbers). Extensions and the
 * browser-reported MIME type are never trusted.
 */
export function detectMimeFromSignature(bytes: Uint8Array): AllowedMimeType | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && ascii(bytes, 1, 3) === "PNG" && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "image/webp";
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    // EBML header: WebM declares its DocType in the first few dozen bytes.
    return ascii(bytes, 0, Math.min(bytes.length, 64)).includes("webm") ? "video/webm" : null;
  }
  if (ascii(bytes, 4, 4) === "ftyp") {
    const major = ascii(bytes, 8, 4);
    const boxSize = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
    const compatible: string[] = [];
    for (let i = 16; i + 4 <= Math.min(boxSize, bytes.length, 64); i += 4) compatible.push(ascii(bytes, i, 4));
    if (major === "avif" || major === "avis") return "image/avif";
    if (major === "qt  ") return "video/quicktime";
    if (MP4_BRANDS.has(major) || compatible.some((b) => MP4_BRANDS.has(b))) return "video/mp4";
    return null;
  }
  // Older QuickTime files may start directly with a moov/mdat/wide/free atom.
  if (["moov", "mdat", "wide", "free", "skip", "pnot"].includes(ascii(bytes, 4, 4))) return "video/quicktime";
  return null;
}

/** MP4 and QuickTime share the ISO base media format; browsers report either for .mov/.mp4. */
export function isSignatureCompatible(declared: AllowedMimeType, detected: AllowedMimeType | null): boolean {
  if (!detected) return false;
  if (declared === detected) return true;
  const isoVideo = new Set<AllowedMimeType>(["video/mp4", "video/quicktime"]);
  return isoVideo.has(declared) && isoVideo.has(detected);
}

/**
 * Find the `mvhd` box in an MP4/QuickTime byte window and return the movie
 * duration in seconds, or null if the header is not inside the window.
 */
export function parseIsoBmffDuration(bytes: Uint8Array): number | null {
  for (let i = 4; i + 32 <= bytes.length; i++) {
    if (bytes[i] !== 0x6d || ascii(bytes, i, 4) !== "mvhd") continue; // 'm'
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const version = bytes[i + 4];
    if (version === 1) {
      if (i + 4 + 32 > bytes.length) return null;
      const timescale = view.getUint32(i + 4 + 20);
      const duration = Number(view.getBigUint64(i + 4 + 24));
      return timescale > 0 ? duration / timescale : null;
    }
    const timescale = view.getUint32(i + 4 + 12);
    const duration = view.getUint32(i + 4 + 16);
    return timescale > 0 ? duration / timescale : null;
  }
  return null;
}

/** Keep a display/download name without path separators or control characters. */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[\x00-\x1f\x7f<>:"|?*]/g, "_").replace(/\s+/g, " ").trim().slice(0, 150);
  return cleaned || "file";
}
