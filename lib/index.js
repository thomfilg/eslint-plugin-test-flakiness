/**
 * @fileoverview ESLint plugin to detect flaky test patterns and suggest fixes
 * @author eslint-plugin-test-flakiness
 */
// Released via npm OIDC Trusted Publishing (see .github/workflows/ci.yml).
'use strict';

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const requireIndex = require('requireindex');
const path = require('path');
const fs = require('fs');

//------------------------------------------------------------------------------
// Plugin Definition
//------------------------------------------------------------------------------

// Import all rules in lib/rules
const getRules = () => {
  const rulesPath = path.join(__dirname, 'rules');
  let rules = {};
  if (fs.existsSync(rulesPath)) {
    try {
      rules = requireIndex(rulesPath);
    } catch (_err) {
      // Silently handle error and return empty rules object
      rules = {};
    }
  }
  return rules;
};

// Import configs
const recommendedConfig = require('./configs/recommended');
const strictConfig = require('./configs/strict');
const rules = getRules();

module.exports = {
  rules,
  configs: {
    recommended: recommendedConfig,
    strict: strictConfig,
    all: {
      plugins: ['test-flakiness'],
      rules: Object.keys(rules).reduce((acc, ruleName) => {
        acc[`test-flakiness/${ruleName}`] = 'error';
        return acc;
      }, {})
    }
  }
};