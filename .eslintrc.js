module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 2018,
  },
  plugins: [
    'node'
  ],
  extends: [
    'eslint:recommended',
    'plugin:node/recommended'
  ],
  env: {
    node: true
  },
  rules: {
    "no-console": "off"
  },
  overrides: [
    {
      files: [
        'tests/**/*.js',
      ],
      plugins: [
         'mocha',
      ],
      rules: Object.assign({}, require('eslint-plugin-node').configs.recommended.rules, { 
        // add your custom rules and overrides for node files here 
        'node/no-unpublished-require': 0 
      }),
      env: {
        mocha: true
      },
    }
  ]
};