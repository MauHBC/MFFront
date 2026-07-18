module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    "plugin:react/recommended",
    "airbnb",
    "plugin:prettier/recommended",
  ],
  parser: "@babel/eslint-parser",
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    babelOptions: {
      presets: [require.resolve("@babel/preset-react")],
    },
    ecmaVersion: "latest",
    requireConfigFile: false,
    sourceType: "module",
  },
  plugins: ["react", "prettier", "react-hooks"],
  overrides: [
    {
      files: ["**/*.test.js"],
      env: {
        jest: true,
      },
      rules: {
        "jsx-a11y/label-has-associated-control": "off",
        "no-unused-vars": "off",
        "react/button-has-type": "off",
        "react/function-component-definition": "off",
        "react/jsx-props-no-spreading": "off",
        "react/prop-types": "off",
        "unicode-bom": "off",
      },
    },
    {
      files: ["src/setupProxy.js"],
      rules: {
        "import/no-extraneous-dependencies": "off",
      },
    },
  ],
  rules: {
    "react/jsx-filename-extension": 0,
    "import/prefer-default-export": 0,
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    "react/react-in-jsx-scope": "off",
    "no-console": "off",
    'prettier/prettier': 0,
  },
};
