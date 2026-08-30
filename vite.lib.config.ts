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

import { copyFileSync, globSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

const root = process.cwd();
const sourceRoot = resolve(root, 'src');

export default defineConfig({
  plugins: [react(), copyPreservedAssets()],
  build: {
    copyPublicDir: false,
    emptyOutDir: false,
    lib: {
      entry: getLibraryEntries(),
      formats: ['es'],
    },
    minify: false,
    outDir: 'dist/lib',
    reportCompressedSize: false,
    sourcemap: true,
    target: 'es2023',
    rolldownOptions: {
      external: isExternalImport,
      preserveEntrySignatures: 'strict',
      output: {
        assetFileNames: '[name][extname]',
        entryFileNames: '[name].js',
        preserveModules: true,
        preserveModulesRoot: sourceRoot,
      },
    },
  },
});

/** Make every source module an entry so public deep imports retain all of their exports. */
function getLibraryEntries(): Record<string, string> {
  const sourceFiles = globSync('src/**/*.{ts,tsx}', {
    cwd: root,
    exclude: ['src/**/*.stories.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
  }).toSorted();

  return Object.fromEntries(
    sourceFiles.map((sourceFile) => {
      const entryName = sourceFile.slice('src/'.length).replace(/\.(?:ts|tsx)$/, '');
      return [entryName, resolve(root, sourceFile)];
    }),
  );
}

/** Keep the library unbundled by leaving packages and runtime assets as imports. */
function isExternalImport(source: string): boolean {
  const isBareImport = !source.startsWith('.') && !source.startsWith('/');
  return isBareImport || source.endsWith('.css');
}

/** Preserve assets that stay as relative imports in the emitted ESM modules. */
function copyPreservedAssets(): Plugin {
  return {
    name: 'copy-preserved-library-assets',
    apply: 'build',
    closeBundle() {
      for (const sourceFile of globSync('src/**/*.css', { cwd: root })) {
        const destination = resolve(root, 'dist/lib', sourceFile.slice('src/'.length));
        mkdirSync(dirname(destination), { recursive: true });
        copyFileSync(resolve(root, sourceFile), destination);
      }
    },
  };
}
