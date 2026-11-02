import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config({ ignores: ['dist/**', '**/dist/**', '**/target/**', '**/gen/**'] }, js.configs.recommended, ...ts.configs.recommended, { languageOptions: { globals: { process: 'readonly', console: 'readonly', URL: 'readonly', setTimeout: 'readonly' } } });
