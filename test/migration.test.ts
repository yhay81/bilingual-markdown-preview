import { describe, expect, it } from "vitest";
import { LEGACY_PREFIX, moveSecrets, moveSettings, moveState } from "../src/migration";

const PREFIX = "markdownTranslation";

function mapLevel(entries: Record<string, unknown>, unwritable: string[] = []) {
  const values = new Map(Object.entries(entries));
  return {
    values,
    read: (key: string) => values.get(key),
    write: async (key: string, value: unknown) => {
      if (unwritable.includes(key)) throw new Error(`cannot write ${key}`);
      if (value === undefined) values.delete(key);
      else values.set(key, value);
    },
  };
}

describe("moveSettings", () => {
  it("moves legacy settings to the new prefix", async () => {
    const level = mapLevel({ [`${LEGACY_PREFIX}.provider`]: "openai", [`${LEGACY_PREFIX}.openai.model`]: "gpt-x", other: 1 });
    const moved = await moveSettings(level, ["provider", "openai.model", "syncScroll"], PREFIX);
    expect(moved).toEqual(["provider", "openai.model"]);
    expect(Object.fromEntries(level.values)).toEqual({ [`${PREFIX}.provider`]: "openai", [`${PREFIX}.openai.model`]: "gpt-x", other: 1 });
  });

  it("keeps a value already set under the new prefix, and removes the legacy one", async () => {
    const level = mapLevel({ [`${LEGACY_PREFIX}.provider`]: "openai", [`${PREFIX}.provider`]: "gemini" });
    expect(await moveSettings(level, ["provider"], PREFIX)).toEqual([]);
    expect(Object.fromEntries(level.values)).toEqual({ [`${PREFIX}.provider`]: "gemini" });
  });

  it("moves falsy values such as false and an empty object", async () => {
    const level = mapLevel({ [`${LEGACY_PREFIX}.syncScroll`]: false, [`${LEGACY_PREFIX}.glossary`]: {} });
    await moveSettings(level, ["syncScroll", "glossary"], PREFIX);
    expect(Object.fromEntries(level.values)).toEqual({ [`${PREFIX}.syncScroll`]: false, [`${PREFIX}.glossary`]: {} });
  });

  it("goes on past a setting it cannot write", async () => {
    const level = mapLevel({ [`${LEGACY_PREFIX}.provider`]: "openai", [`${LEGACY_PREFIX}.tokenLimit`]: 5 }, [`${PREFIX}.provider`]);
    expect(await moveSettings(level, ["provider", "tokenLimit"], PREFIX)).toEqual(["tokenLimit"]);
    expect(Object.fromEntries(level.values)).toEqual({ [`${LEGACY_PREFIX}.provider`]: "openai", [`${PREFIX}.tokenLimit`]: 5 });
  });
});

describe("moveSecrets", () => {
  function secretStore(entries: Record<string, string>, failing = false) {
    const values = new Map(Object.entries(entries));
    return {
      values,
      get: async (key: string) => {
        if (failing) throw new Error("no keyring");
        return values.get(key);
      },
      store: async (key: string, value: string) => void values.set(key, value),
      delete: async (key: string) => void values.delete(key),
    };
  }

  it("moves API keys and keeps keys stored under the new prefix", async () => {
    const secrets = secretStore({
      [`${LEGACY_PREFIX}.apiKey.anthropic`]: "old-a",
      [`${LEGACY_PREFIX}.apiKey.openai`]: "old-o",
      [`${PREFIX}.apiKey.openai`]: "new-o",
    });
    await moveSecrets(secrets, ["apiKey.anthropic", "apiKey.openai", "apiKey.gemini"], PREFIX);
    expect(Object.fromEntries(secrets.values)).toEqual({ [`${PREFIX}.apiKey.anthropic`]: "old-a", [`${PREFIX}.apiKey.openai`]: "new-o" });
  });

  it("does not fail when Secret Storage is unavailable", async () => {
    await expect(moveSecrets(secretStore({}, true), ["apiKey.anthropic"], PREFIX)).resolves.toBeUndefined();
  });
});

describe("moveState", () => {
  it("moves a state value", async () => {
    const values = new Map<string, unknown>([[`${LEGACY_PREFIX}.viewMode`, "target"]]);
    const state = {
      get: <T>(key: string) => values.get(key) as T | undefined,
      update: async (key: string, value: unknown) => void (value === undefined ? values.delete(key) : values.set(key, value)),
    };
    await moveState(state, "viewMode", PREFIX);
    expect(Object.fromEntries(values)).toEqual({ [`${PREFIX}.viewMode`]: "target" });
  });
});
