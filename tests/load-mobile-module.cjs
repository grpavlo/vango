const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('../mobile-app/node_modules/@babel/core');
module.exports = function loadMobileModule(filename, dependencies = {}, globals = {}) {
  const full = path.resolve(__dirname, '../mobile-app', filename);
  const code = babel.transformSync(fs.readFileSync(full, 'utf8'), {
    filename: full, configFile: false, babelrc: false,
    plugins: [require.resolve('../mobile-app/node_modules/@babel/plugin-transform-modules-commonjs'),
      require.resolve('../mobile-app/node_modules/@babel/plugin-transform-react-jsx')],
  }).code;
  const module = {exports: {}};
  vm.runInNewContext(code, {module, exports: module.exports,
    require: id => {if (Object.hasOwn(dependencies, id)) return dependencies[id]; throw Error(`Unmocked mobile dependency: ${id}`);},
    setTimeout, clearTimeout, AbortController, FormData, TextDecoder, Uint8Array, console,
    ...globals,
  }, {filename: full});
  return module.exports;
};
