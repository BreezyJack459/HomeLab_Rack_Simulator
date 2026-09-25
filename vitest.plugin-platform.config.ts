import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    fileParallelism: false,
    maxWorkers: 1,
    include: [
      'src/plugins/pluginHost.test.ts',
      'src/plugins/pluginCatalog.test.ts',
      'src/plugins/localPackageLoader.test.ts',
      'src/plugins/workspacePacks.test.ts',
      'src/components/CommandPalette.helpers.test.ts',
      'src/components/TopContextBar.test.tsx',
      'src/utils/portDocumentation.test.ts',
    ],
  },
});
