import * as vscode from "vscode";
import { KEY_PROVIDER_IDS, type KeyProviderId } from "./providers/types";

const SECRET_PREFIX = "bilingualMarkdown.apiKey.";

/**
 * BYOK API keys in VS Code Secret Storage (the OS keychain). Keys never touch settings files.
 * A copy is kept in memory so the translation queue can read it synchronously.
 */
export class ApiKeyStore implements vscode.Disposable {
  private readonly keys = new Map<KeyProviderId, string>();
  private readonly emitter = new vscode.EventEmitter<KeyProviderId>();
  private readonly subscription: vscode.Disposable;
  readonly onDidChange = this.emitter.event;

  constructor(private readonly secrets: vscode.SecretStorage) {
    // Also fires when another VS Code window changes a key.
    this.subscription = secrets.onDidChange((event) => {
      const provider = KEY_PROVIDER_IDS.find((id) => secretName(id) === event.key);
      if (provider) void this.refresh(provider);
    });
  }

  async load(): Promise<void> {
    await Promise.all(KEY_PROVIDER_IDS.map((provider) => this.refresh(provider)));
  }

  get(provider: KeyProviderId): string | undefined {
    return this.keys.get(provider);
  }

  has(provider: KeyProviderId): boolean {
    return this.keys.has(provider);
  }

  async set(provider: KeyProviderId, apiKey: string): Promise<void> {
    await this.secrets.store(secretName(provider), apiKey);
    this.update(provider, apiKey);
  }

  async delete(provider: KeyProviderId): Promise<void> {
    await this.secrets.delete(secretName(provider));
    this.update(provider, undefined);
  }

  dispose(): void {
    this.subscription.dispose();
    this.emitter.dispose();
  }

  private async refresh(provider: KeyProviderId): Promise<void> {
    try {
      this.update(provider, await this.secrets.get(secretName(provider)));
    } catch {
      this.update(provider, undefined);
    }
  }

  private update(provider: KeyProviderId, apiKey: string | undefined): void {
    if (this.keys.get(provider) === (apiKey || undefined)) return;
    if (apiKey) this.keys.set(provider, apiKey);
    else this.keys.delete(provider);
    this.emitter.fire(provider);
  }
}

function secretName(provider: KeyProviderId): string {
  return `${SECRET_PREFIX}${provider}`;
}
