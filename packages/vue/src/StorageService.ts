import {
  getABStorageKey,
  getFFStorageKey,
  getRCStorageKey,
  type StorageServiceOptions,
} from "@tryabby/core";
import Cookie from "js-cookie";

const DEFAULT_COOKIE_EXPIRY_DAYS = 365;

function isBrowser(): boolean {
  return typeof document !== "undefined";
}

class CookieStorage {
  constructor(
    private readonly keyFor: (projectId: string, name: string) => string
  ) {}

  get(projectId: string, name: string): string | null {
    if (!isBrowser()) {
      return null;
    }

    return Cookie.get(this.keyFor(projectId, name)) ?? null;
  }

  set(
    projectId: string,
    name: string,
    value: string,
    options?: StorageServiceOptions
  ): void {
    if (!isBrowser()) {
      return;
    }

    Cookie.set(this.keyFor(projectId, name), value, {
      expires: options?.expiresInDays ?? DEFAULT_COOKIE_EXPIRY_DAYS,
    });
  }

  remove(projectId: string, name: string): void {
    if (!isBrowser()) {
      return;
    }

    Cookie.remove(this.keyFor(projectId, name));
  }
}

export const TestStorageService = new CookieStorage(getABStorageKey);
export const FlagStorageService = new CookieStorage(getFFStorageKey);
export const RemoteConfigStorageService = new CookieStorage(getRCStorageKey);
