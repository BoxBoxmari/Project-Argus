/* Fallback only if typings unresolved at build time */
declare const GM_getValue: <T=unknown>(key: string, defaultValue?: T) => Promise<T> | T;
declare const GM_setValue: <T=unknown>(key: string, value: T) => Promise<void> | void;
declare const GM_download: (details: any, onerror?: any) => void;