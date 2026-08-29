import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // jsdom, not node — the component/integration tests exercise real DOM
    // APIs (querySelector, dispatchEvent, focus/blur, dataset, ...).
    environment: 'jsdom',
  },
});
