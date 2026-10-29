/**
 * Wires the identity session from the environment: the dev config named by
 * `INQUELLO_SERVICE_CONFIG`, HTTPS clients that trust only its CA, the vault
 * under `<userData>/identity`, and the browser opener main chooses.
 */
import path from 'node:path';

import type { Logger } from '../runtime/logger';
import type { BrowserOpener } from './browser';
import { loadServiceConfig, type ConfigResult } from './config';
import { IssuerClient, SharedServiceClient, httpsTransport, type HttpsTransport, type SharedService } from './service-client';
import { IdentitySession } from './session';
import { CredentialVault, type SafeStorageLike } from './vault';

export { SERVICE_CONFIG_ENV } from './config';
export { headlessOpener } from './headless-opener';
export { IdentitySession, toRendererResult, toRendererStatus, type IdentityActionResult, type IdentityStatus } from './session';
export { CredentialVault, SESSION_FILE } from './vault';

export interface IdentityWiring {
  session: IdentitySession;
  vault: CredentialVault;
  config: ConfigResult;
  /** The scoped-trust HTTPS transport, when configured. */
  transport: HttpsTransport | null;
  /** The shared-service client the session uses, when configured (Story 1.14 also uses its Workspace routes). */
  service: SharedService | null;
}

export interface IdentityWiringOptions {
  env: NodeJS.ProcessEnv;
  safeStorage: SafeStorageLike;
  platform: NodeJS.Platform;
  userDataDir: string;
  logger: Logger;
  /** Chooses the opener once the transport exists (the smoke run uses the headless one). */
  opener: (transport: HttpsTransport | null) => BrowserOpener;
  recordSecrets?: boolean;
}

export function identityDir(userDataDir: string): string {
  return path.join(userDataDir, 'identity');
}

export function createIdentity(options: IdentityWiringOptions): IdentityWiring {
  const config = loadServiceConfig(options.env);
  if (config.kind === 'invalid') options.logger.error(`identity: ${config.reason}`);
  const vault = new CredentialVault({ safeStorage: options.safeStorage, platform: options.platform, dir: identityDir(options.userDataDir) });
  const transport = config.kind === 'configured' ? httpsTransport(config.config.ca) : null;
  const service = config.kind === 'configured' && transport ? new SharedServiceClient(config.config.serviceUrl, transport) : null;
  const session = new IdentitySession({
    config,
    vault,
    service: service ?? undefined,
    issuer: config.kind === 'configured' && transport ? new IssuerClient(config.config.issuerUrl, transport) : undefined,
    openBrowser: options.opener(transport),
    logger: options.logger,
    recordSecrets: options.recordSecrets,
  });
  options.logger.info(`identity: shared service ${config.kind}; credential storage ${vault.storage}`);
  return { session, vault, config, transport, service };
}
