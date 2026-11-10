/** @type {import('jest').Config} */
const common = {
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
};

module.exports = {
  testTimeout: 30000,
  projects: [
    {
      ...common,
      displayName: 'unit',
      rootDir: '.',
      testMatch: ['<rootDir>/src/**/*.spec.ts'],
    },
    {
      // Integration tests: real Nest app, real Postgres (schema `it_test`) and Redis (db 1).
      // Needs `docker compose up db redis -d`. Run in band: they share one database.
      ...common,
      displayName: 'it',
      rootDir: '.',
      testMatch: ['<rootDir>/test/it/**/*.it-spec.ts'],
      setupFiles: ['<rootDir>/test/it/env.ts'],
      globalSetup: '<rootDir>/test/it/global-setup.ts',
    },
    {
      // Parity test (task p6-social-feed): the live feed against the harness orders of .docs/results/p6-parity/.
      // Reads the schema `eval_load` (loaded by `npm run load -w @breadit/eval -- syn-W2M-M`) and Redis db 2.
      // Needs `docker compose up db redis -d`. It never writes Postgres.
      ...common,
      displayName: 'parity',
      rootDir: '.',
      testMatch: ['<rootDir>/test/parity/**/*.parity-spec.ts'],
      setupFiles: ['<rootDir>/test/parity/env.ts'],
      globalSetup: '<rootDir>/test/parity/global-setup.ts',
    },
  ],
};
