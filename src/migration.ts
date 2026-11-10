/**
 * Version 0.1 kept its settings, API keys and state under the prefix of the extension's old name.
 * They are moved to the current prefix once, when the extension starts.
 */
export const LEGACY_PREFIX = "bilingualMarkdown";

/** One level of settings, such as the user's settings or a workspace's. Keys are full setting keys. */
export interface SettingsLevel {
  read(key: string): unknown;
  write(key: string, value: unknown): Promise<void>;
}

export interface SecretStore {
  get(key: string): PromiseLike<string | undefined>;
  store(key: string, value: string): PromiseLike<void>;
  delete(key: string): PromiseLike<void>;
}

export interface StateStore {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): PromiseLike<void>;
}

/**
 * Moves each setting from the legacy prefix to `prefix`. A value already under `prefix` wins.
 * Settings that cannot be written, such as a machine setting in a workspace, are left as they are.
 */
export async function moveSettings(level: SettingsLevel, keys: readonly string[], prefix: string): Promise<string[]> {
  const moved: string[] = [];
  for (const key of keys) {
    const legacyKey = `${LEGACY_PREFIX}.${key}`;
    const value = level.read(legacyKey);
    if (value === undefined) continue;
    try {
      if (level.read(`${prefix}.${key}`) === undefined) {
        await level.write(`${prefix}.${key}`, value);
        moved.push(key);
      }
      await level.write(legacyKey, undefined);
    } catch {
      // Leave the legacy setting where it is. It no longer has any effect.
    }
  }
  return moved;
}

/** Moves each secret, such as an API key, from the legacy prefix to `prefix`. */
export async function moveSecrets(secrets: SecretStore, names: readonly string[], prefix: string): Promise<void> {
  await Promise.all(
    names.map(async (name) => {
      try {
        const legacyKey = `${LEGACY_PREFIX}.${name}`;
        const value = await secrets.get(legacyKey);
        if (value === undefined) return;
        if ((await secrets.get(`${prefix}.${name}`)) === undefined) await secrets.store(`${prefix}.${name}`, value);
        await secrets.delete(legacyKey);
      } catch {
        // Secret Storage may be unavailable, as on a Linux desktop without a keyring.
      }
    }),
  );
}

/** Moves one value of the extension's state from the legacy prefix to `prefix`. */
export async function moveState(state: StateStore, name: string, prefix: string): Promise<void> {
  const legacyKey = `${LEGACY_PREFIX}.${name}`;
  const value = state.get<unknown>(legacyKey);
  if (value === undefined) return;
  if (state.get<unknown>(`${prefix}.${name}`) === undefined) await state.update(`${prefix}.${name}`, value);
  await state.update(legacyKey, undefined);
}
