module.exports = {
  verbose: false,
  preset: "ts-jest",
  testEnvironment: "node",

  // Need this to avoid "Unable to find the root of the project"
  // See https://github.com/kulshekhar/ts-jest/issues/823
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        packageJson: "<rootDir>/package.json",
      },
    ],
  }
};
