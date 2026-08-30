// Copyright The Perses Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';

import { federation } from '@module-federation/vite';
import type { ModuleFederationOptions, PluginManifestOptions } from '@module-federation/vite';
import { mergeConfig } from 'vite';
import type { Plugin, UserConfig } from 'vite';

/** The base path for all plugin assets. This should match the path where plugins are stored on the Perses server.
 * @see {@link https://github.com/perses/perses}
 */
const PLUGINS_PATH = '/plugins';

interface PluginConfigOptions {
  /** The plugin name. Typically PascalCase. */
  name: string;
  /** Any Vite configuration to merge over the shared defaults. */
  viteConfig?: UserConfig;
  /** Any Module Federation configuration to merge over the shared defaults. */
  moduleFederation?: Omit<ModuleFederationOptions, 'name'>;
}

/** Creates a Vite configuration for building and serving a Perses plugin. */
export function createConfigForPlugin(options: PluginConfigOptions): UserConfig {
  const { name, viteConfig = {}, moduleFederation = {} } = options;
  const version = process.env.NODE_ENV === 'development' ? undefined : getPluginVersion();
  const config = mergeConfig(getViteConfig(name, version), viteConfig);
  const moduleFederationConfig: ModuleFederationOptions = {
    ...getBaseModuleFederationConfig(name, version),
    ...moduleFederation,
    name,
  };

  return {
    ...config,
    plugins: [...(config.plugins ?? []), ...federation(moduleFederationConfig)],
  };
}

function getViteConfig(name: string, version?: string): UserConfig {
  return {
    appType: 'custom',
    // Production assets stay relative so deployments with an API prefix resolve from the loaded plugin URL.
    // Development keeps the Perses proxy path so Vite's client and React Refresh requests are routed to this plugin.
    base: version ? './' : getAssetPrefix(name),
    input: './src/index-federation.ts',
    publicDir: false,
    plugins: [persesCliPlugin(name), copyPluginMetadata()],
    server: {
      cors: true,
      port: 3000 + Math.floor(Math.random() * 1000),
      strictPort: false,
    },
    build: {
      assetsDir: '__mf',
      outDir: 'dist',
    },
  };
}

function getBaseModuleFederationConfig(name: string, version?: string): ModuleFederationOptions {
  const assetPrefix = getAssetPrefix(name, version);
  const manifest: PluginManifestOptions = {
    additionalData: ({ stats }) => addPluginIdentity(stats, name, version),
  };

  return {
    name,
    dts: false,
    filename: '__mf/js/remoteEntry-[hash]',
    getPublicPath: `function() { const prefix = window.PERSES_PLUGIN_ASSETS_PATH || window.PERSES_APP_CONFIG?.api_prefix || ""; return prefix + "${assetPrefix}"; }`,
    manifest,
  };
}

function getAssetPrefix(name: string, version?: string): string {
  const identity = version ? `${name}~${version}` : name;
  return `${PLUGINS_PATH}/${identity}/`;
}

function getPluginVersion(): string | undefined {
  try {
    const pkg: unknown = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8'));
    if (isRecord(pkg) && typeof pkg.version === 'string' && pkg.version.length > 0) {
      return pkg.version;
    }
  } catch {
    // Vite can still serve a plugin without package metadata during local development.
  }
  return undefined;
}

function addPluginIdentity(manifest: Record<string, unknown>, name: string, version?: string): Record<string, unknown> {
  if (!version || !isRecord(manifest.metaData)) {
    return manifest;
  }

  const buildInfo = isRecord(manifest.metaData.buildInfo) ? manifest.metaData.buildInfo : {};
  return {
    ...manifest,
    metaData: {
      ...manifest.metaData,
      buildInfo: { ...buildInfo, buildVersion: version },
      globalName: toGlobalName(name, version),
    },
  };
}

function persesCliPlugin(name: string): Plugin {
  return {
    name: 'perses-cli-dev-server',
    apply: 'serve',
    configureServer(server) {
      if (!process.env.PERSES_CLI) {
        return;
      }

      server.httpServer?.once('listening', () => {
        const address = server.httpServer?.address() as AddressInfo | null | undefined;
        if (!address) {
          return;
        }

        const protocol = server.config.server.https ? 'https' : 'http';
        console.log(`[PERSES_PLUGIN] NAME="${name}" PORT="${address.port}" PROTOCOL="${protocol}"\n`);
      });
    },
  };
}

function copyPluginMetadata(): Plugin {
  let outDir = resolve(process.cwd(), 'dist');

  return {
    name: 'copy-plugin-metadata',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      mkdirSync(outDir, { recursive: true });
      copyFileSync(resolve(process.cwd(), 'package.json'), resolve(outDir, 'package.json'));
      copyFileSync(resolve(process.cwd(), 'README.md'), resolve(outDir, 'README.md'));
      copyFileSync(resolve(process.cwd(), '../LICENSE'), resolve(outDir, 'LICENSE'));
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Build a JS-identifier-safe global container name that is unique per plugin version. */
function toGlobalName(name: string, version: string): string {
  return `${name}_${version}`.replace(/[^a-zA-Z0-9_$]/g, '_');
}
