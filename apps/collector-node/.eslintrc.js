// eslint-disable-next-line no-undef
module.exports = {
  env: { node: true, es2020: true, commonjs: true },
  parserOptions: { ecmaVersion: 2020, sourceType: "script" },
  extends: ["eslint:recommended"],
  globals: { module: "readonly", exports: "readonly", require: "readonly" },
  rules: {
    // các rules hiện có...
  }
};
