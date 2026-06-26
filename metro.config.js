const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Limit to 1 worker to prevent macOS security scanner from timing out
// under concurrent file read load.
config.maxWorkers = 1;

// Disable Watchman to avoid concurrent file-access conflicts with
// syspolicyd security scanning on macOS.
config.resolver = {
  ...config.resolver,
  useWatchman: false,
};

module.exports = config;
