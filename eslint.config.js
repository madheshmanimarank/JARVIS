import js from '@eslint/js';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import react from 'eslint-plugin-react';

export default [
  { ignores: ['dist/', 'node_modules/'] },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: typescriptParser,
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.main.json', './tsconfig.preload.json'],
        ecmaFeatures: { jsx: true },
      },
      globals: {
        window: 'readonly', document: 'readonly', console: 'readonly',
        navigator: 'readonly', localStorage: 'readonly', sessionStorage: 'readonly',
        fetch: 'readonly', WebSocket: 'readonly',
        SpeechRecognition: 'readonly', webkitSpeechRecognition: 'readonly',
        setTimeout: 'readonly', clearTimeout: 'readonly',
        setInterval: 'readonly', clearInterval: 'readonly',
        requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly',
        HTMLElement: 'readonly', HTMLCanvasElement: 'readonly',
        CanvasRenderingContext2D: 'readonly', AudioContext: 'readonly',
        MediaStream: 'readonly', MediaRecorder: 'readonly',
        Blob: 'readonly', URL: 'readonly', crypto: 'readonly',
        performance: 'readonly', customElements: 'readonly',
      },
    },
    settings: { react: { version: '19' } },
    plugins: {
      '@typescript-eslint': typescriptEslint,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      react,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...typescriptEslint.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-use-before-define': ['warn', { functions: false, classes: false, variables: false, typedefs: false }],
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
  },
  {
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts', 'src/core/**/*.ts'],
    languageOptions: {
      globals: {
        node: true, NodeJS: 'readonly', process: 'readonly',
        __dirname: 'readonly', __filename: 'readonly',
        require: 'readonly', module: 'readonly', global: 'readonly',
        Buffer: 'readonly', BufferEncoding: 'readonly', console: 'readonly',
        setTimeout: 'readonly', clearTimeout: 'readonly',
        setInterval: 'readonly', clearInterval: 'readonly',
      },
    },
  },
  {
    files: ['src/renderer/**/*.ts', 'src/renderer/**/*.tsx', 'src/core/voice/STTProvider.ts', 'src/shared/types/global.d.ts'],
    languageOptions: {
      globals: {
        SpeechRecognitionConstructor: 'readonly',
        SpeechGrammarList: 'readonly',
      },
    },
  },
];