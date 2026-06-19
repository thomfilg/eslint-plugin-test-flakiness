module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'lib/**/*.js',
    '!lib/index.js'
  ],
  testMatch: [
    '**/tests/**/*.test.js'
  ]
};