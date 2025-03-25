module.exports = {
  preset: "jest-puppeteer",
  testMatch: [
    "**/tests/**/*.js",
  ],
  globals: {
    'jest-puppeteer': {
      launch: {
        args: [
          // https://chromium.googlesource.com/chromium/src/+/main/docs/security/apparmor-userns-restrictions.md#what-if-i-dont-have-root-access-to-the-machine-and-cant-install-anything
          '--no-sandbox',
        ],
      }
    }
  },
};
