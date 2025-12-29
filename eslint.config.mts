import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import stylistic from '@stylistic/eslint-plugin'
import { defineConfig } from 'eslint/config'

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    plugins: {
      js,
      '@stylistic': stylistic,
    },
    extends: ['js/recommended'],
    languageOptions: { globals: globals.node },
    rules: {
      '@stylistic/indent': ['error', 2],
    },
  },
  tseslint.configs.recommended,
  stylistic.configs.recommended,
])
