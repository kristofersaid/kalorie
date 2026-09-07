// Mapuje Node'owy moduł wbudowany `punycode` (wymagany przez markdown-it)
// na pakiet userland, żeby Metro umiało go zbundlować.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  punycode: require.resolve('punycode/'),
};

module.exports = config;
