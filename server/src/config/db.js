import mongoose from 'mongoose';
import { env } from './env.js';

const READY_STATE_MAP = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnected',
};

export function getDbStatus() {
  return READY_STATE_MAP[mongoose.connection.readyState] || 'disconnected';
}

export async function connectDB(uri = env.mongodbUri) {
  if (!uri) {
    console.warn('[db] MONGODB_URI is empty; starting server without database connection.');
    return false;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3000,
    });
    console.log(`[db] Connected to MongoDB (${mongoose.connection.name})`);
    return true;
  } catch (err) {
    if (env.nodeEnv === 'production') {
      throw err;
    }
    console.warn(
      `[db] Could not connect to MongoDB at ${uri} (${err.message}). ` +
        'Server will keep running in development mode until MongoDB is started.'
    );
    return false;
  }
}

export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
