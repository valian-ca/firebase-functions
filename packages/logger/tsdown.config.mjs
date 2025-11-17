import { defineConfig } from 'tsdown'

export default defineConfig({
  outDir: 'lib',
  platform: 'node',
  format: ['esm', 'cjs'],
  target: 'es2022',
  fixedExtension: true,
  tsconfig: './tsconfig.lib.json',
})
