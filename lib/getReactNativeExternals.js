'use strict';

const path = require('path');
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));

/**
 * Extract the React Native module paths
 *
 * @return {Promise<Object>} A promise which resolves with
 *                           a webpack 'externals' configuration object
 */
function getReactNativeExternals() {
  const reactNativeRoot = path.dirname(require.resolve('react-native/package'));
  const blacklist = require('react-native/packager/blacklist');
  const ReactPackager = require('react-native/packager/react-packager');
  const reactNativePackage = require('react-native/package');
  const reactNativeModuleDir = path.join(reactNativeRoot, 'node_modules');

  /* Create symlinks for all flattened react-native dependencies */
  return fs.readdirAsync(reactNativeModuleDir).then(function(modules) {
    const modulesSet = {};
    modules.forEach(mod => { modulesSet[mod] = true; });

    return Promise.all(Object.keys(reactNativePackage.dependencies)
      .filter(dep => !modulesSet[dep])
      .map(dep => {
        const src = path.resolve(reactNativeRoot, '..', dep);
        const dst = path.join(reactNativeModuleDir, dep);
        return fs.statAsync(src)
          .catch(() => {})
          .then(stat => {
            if (stat && stat.isDirectory()) {
              return fs.symlinkAsync(src, dst);
            }
          });
      }));

  }).then(function() {
    return ReactPackager.getDependencies({
      assetRoots: [reactNativeRoot],
      blacklistRE: blacklist(false /* don't blacklist any platform */),
      projectRoots: [reactNativeRoot],
      transformModulePath: require.resolve('react-native/packager/transformer'),
    }, reactNativePackage.main);
  }).then(function(dependencies) {
    return dependencies.filter(function(dependency) {
      return !dependency.isPolyfill();
    });
  }).then(function(dependencies) {
    return Promise.all(dependencies.map(function(dependency) {
      return dependency.getName();
    }));
  }).then(function(moduleIds) {
    return moduleIds.reduce(function(externals, moduleId) {
      externals[moduleId] = 'commonjs ' + moduleId;
      return externals;
    }, {});
  });
}

module.exports = getReactNativeExternals;
