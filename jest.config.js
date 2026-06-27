/**
 * Jest config for data-layer + e2e tests.
 *
 * Tests run in Node (no React Native runtime). The three React-Native-only
 * modules the data layer touches are mapped to in-memory stubs so the real
 * lib/* code runs unchanged: against a mocked Supabase client (unit tests) or
 * the real backend (e2e tests).
 */
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  testMatch: ['<rootDir>/lib/**/*.test.ts', '<rootDir>/e2e/**/*.test.ts'],
  testTimeout: 30000,
  moduleNameMapper: {
    '^react-native-url-polyfill/auto$': '<rootDir>/test/mocks/empty.js',
    '^@react-native-async-storage/async-storage$': '<rootDir>/test/mocks/async-storage.ts',
    '^@react-native-community/netinfo$': '<rootDir>/test/mocks/netinfo.ts',
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'CommonJS',
          moduleResolution: 'Node',
          esModuleInterop: true,
          allowJs: true,
          // The data layer already passes `tsc --noEmit`; relax a couple of
          // checks that only matter for the app bundle, not the tests.
          jsx: 'react-jsx',
          noUnusedLocals: false,
          noUnusedParameters: false,
        },
      },
    ],
  },
};
