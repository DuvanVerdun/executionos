import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default defineConfig(
    { ignores: ['dist'] },
    {
        files: ['src/**/*.{ts,tsx}'],
        extends: [js.configs.recommended, tseslint.configs.strictTypeChecked, reactHooks.configs.flat.recommended],
        languageOptions: {
            parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname }
        },
        rules: {
            // Numbers and booleans in template strings are safe and read well.
            '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true, allowBoolean: true }]
        }
    }
);
