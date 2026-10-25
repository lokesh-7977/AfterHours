import "server-only";
import mongoose from "mongoose";
import { MongoClient } from "mongodb";
import { getEnv } from "./env";
import { logger } from "./logger";

type Cache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  authClient: MongoClient | null;
};

declare global {
  var __eventsDb: Cache | undefined;
}

const cache: Cache = (globalThis.__eventsDb ??= { conn: null, promise: null, authClient: null });

// Unknown paths in query filters are dropped. User input never reaches a
// filter as an object: every external value is Zod-parsed to a primitive
// first, so operator injection ({ $ne: ... }) is not possible.
mongoose.set("strictQuery", true);

/**
 * Connect Mongoose (application data). Index builds are NOT triggered here in
 * production; run `pnpm db:indexes` during deployment instead.
 */
export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn && mongoose.connection.readyState === 1) return cache.conn;
  if (!cache.promise) {
    const env = getEnv();
    cache.promise = mongoose
      .connect(env.MONGODB_URI, {
        bufferCommands: false,
        autoIndex: env.NODE_ENV === "development",
        autoCreate: env.NODE_ENV !== "production",
        maxPoolSize: 10,
        tls: true,
        tlsAllowInvalidCertificates: env.NODE_ENV !== "production",
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
      })
      .then((m) => {
        logger.info("mongodb.connected");
        return m;
      });
  }
  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null;
    throw err;
  }
  return cache.conn;
}

/**
 * Native driver client used by the Better Auth MongoDB adapter. The driver
 * connects lazily on first operation, so creating it is synchronous.
 */
export function getAuthMongoClient(): MongoClient {
  if (!cache.authClient) {
    cache.authClient = new MongoClient(getEnv().MONGODB_URI, { 
    maxPoolSize: 10,
    tls: true,
    tlsAllowInvalidCertificates: getEnv().NODE_ENV !== "production",
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });
  }
  return cache.authClient;
}

/** Test/script hook. */
export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  cache.conn = null;
  cache.promise = null;
  if (cache.authClient) {
    await cache.authClient.close();
    cache.authClient = null;
  }
}
