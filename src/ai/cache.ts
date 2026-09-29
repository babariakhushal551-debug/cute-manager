// Simple in-memory cache for AI results, keyed by content hash — avoids re-analyzing unchanged content (PRD §9 caching).
import { digestStringAsync, CryptoDigestAlgorithm } from "expo-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Classification } from "./aiService";

const CACHE_KEY = "@curio/ai-cache-v1";
const MAX_ENTRIES = 300;

type CacheMap = Record<string, { c: Classification; t: number }>;

let cache: CacheMap | null = null;
let dirty = false;

async function load(): Promise<CacheMap> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    cache = raw ? (JSON.parse(raw) as CacheMap) : {};
  } catch {
    cache = {};
  }
  return cache;
}

export async function getCached(text: string): Promise<Classification | null> {
  const map = await load();
  const key = await digestStringAsync(CryptoDigestAlgorithm.SHA256, text);
  const hit = map[key];
  return hit ? hit.c : null;
}

export async function setCached(text: string, c: Classification): Promise<void> {
  const map = await load();
  const key = await digestStringAsync(CryptoDigestAlgorithm.SHA256, text);
  map[key] = { c, t: Date.now() };
  const keys = Object.keys(map);
  if (keys.length > MAX_ENTRIES) {
    keys
      .sort((a, b) => map[a].t - map[b].t)
      .slice(0, keys.length - MAX_ENTRIES)
      .forEach((k) => delete map[k]);
  }
  dirty = true;
}

export async function flush(): Promise<void> {
  if (!dirty || !cache) return;
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache)).catch(() => {});
  dirty = false;
}
