/** @type {import('jest').Config} */
const config = {
  preset: "jest-puppeteer",
  testMatch: [
    "**/tests/**/*.js",
  ],
};

export default config;
