module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  globals: {
    _: true,
    app: true,
  },
  extends: "eslint:recommended",
  parserOptions: {
    ecmaVersion: 12,
    sourceType: "module",
  },
  rules: {},
};
