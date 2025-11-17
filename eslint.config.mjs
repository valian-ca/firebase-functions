import { config } from '@valian/eslint-config'

export default [
  ...config.base,
  ...config.importSort,
  {
    ignores: [
      '**/dist/',
      '**/lib',
      '**/coverage/',
      'packages/**',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
    ],
  },
]
