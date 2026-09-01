const fs = require('fs');
const path = require('path');

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-otp-verify',
  'android',
  'src',
  'main',
  'java',
  'com',
  'faizal',
  'OtpVerify',
  'OtpVerifyModule.java'
);

if (!fs.existsSync(target)) {
  process.exit(0);
}

let source = fs.readFileSync(target, 'utf8');
const original = source;

source = source
  .replace(/\nimport com\.google\.android\.gms\.auth\.api\.Auth;/, '')
  .replace(/\nimport com\.google\.android\.gms\.common\.api\.GoogleApiClient;/, '')
  .replace(/\n\s*private GoogleApiClient apiClient;/, '')
  .replace(
    /\n\s*apiClient = new GoogleApiClient\.Builder\(reactContext\)\s*\n\s*\.addApi\(Auth\.GOOGLE_SIGN_IN_API\)\s*\n\s*\.build\(\);/,
    ''
  );

if (source !== original) {
  fs.writeFileSync(target, source);
  console.log('Patched react-native-otp-verify for current Google Play Services.');
}
