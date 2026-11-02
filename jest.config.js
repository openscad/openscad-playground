/** @type {import('jest').Config} */
const config = {
  preset: "jest-puppeteer",
  testMatch: [
    "**/tests/**/*.test.js",
  ],
};

export default config;
