import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config({ignores:['dist/**','node_modules/**','functions/lib/**','functions/node_modules/**']},js.configs.recommended,...ts.configs.recommended,{files:['**/*.ts','**/*.tsx'],rules:{'@typescript-eslint/no-explicit-any':'error'}},{files:['**/*.cjs'],languageOptions:{globals:{require:'readonly',process:'readonly',console:'readonly'}},rules:{'@typescript-eslint/no-require-imports':'off'}});
