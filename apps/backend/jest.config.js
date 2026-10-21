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
  ],
};
