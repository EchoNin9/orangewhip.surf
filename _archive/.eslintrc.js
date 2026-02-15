module.exports = {
  root: true,
  extends: ['@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  env: {
    node: true,
    es2022: true
  },
  rules: {
    // Add any custom rules here
  }
}
