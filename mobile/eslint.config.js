const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/**', '.expo/**', '.test-build/**'] },
  { files: ['tests/**/*.cjs'], languageOptions: { globals: { global: 'readonly', Response: 'readonly', AbortController: 'readonly', DOMException: 'readonly' } } },
]);
