import { isCategory, type Category } from "../../types/category.ts";

export const CATEGORY_CACHE_STORAGE_KEY = "jcb-spending-visualizer:category-cache:v1";

export type CategoryCache = Record<string, Category>;

export type CategoryCacheStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function readCategoryCache(storage: CategoryCacheStorage): CategoryCache {
  try {
    const stored = storage.getItem(CATEGORY_CACHE_STORAGE_KEY);
    if (stored === null) {
      return emptyCategoryCache();
    }

    return sanitizeCategoryCache(JSON.parse(stored) as unknown);
  } catch {
    return emptyCategoryCache();
  }
}

export function writeCategoryCache(
  storage: CategoryCacheStorage,
  cache: CategoryCache,
): boolean {
  try {
    const sanitized = sanitizeCategoryCache(cache);
    storage.setItem(CATEGORY_CACHE_STORAGE_KEY, JSON.stringify(sanitized));
    return true;
  } catch {
    return false;
  }
}

export function writeMerchantCategory(
  storage: CategoryCacheStorage,
  merchantNormalized: string,
  category: Category,
): boolean {
  if (typeof merchantNormalized !== "string" || !isCategory(category)) {
    return false;
  }

  const cache = readCategoryCache(storage);
  cache[merchantNormalized] = category;
  return writeCategoryCache(storage, cache);
}

function sanitizeCategoryCache(value: unknown): CategoryCache {
  const sanitized = emptyCategoryCache();
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return sanitized;
  }

  for (const [merchant, category] of Object.entries(value)) {
    if (isCategory(category)) {
      sanitized[merchant] = category;
    }
  }

  return sanitized;
}

function emptyCategoryCache(): CategoryCache {
  return Object.create(null) as CategoryCache;
}
