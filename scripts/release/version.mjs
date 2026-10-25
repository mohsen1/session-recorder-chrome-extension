import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function validateRelease(tag, packageVersion, manifestVersion = packageVersion) {
  const version = tag?.match(/^v((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/)?.[1];
  if (!version || version.split('.').some((part) => Number(part) > 65535) || version === '0.0.0') {
    throw new Error('Use a stable vMAJOR.MINOR.PATCH tag with Chrome version components from 0 to 65535.');
  }
  if (packageVersion !== version || manifestVersion !== version) {
    throw new Error(`Release ${tag} must match package.json and the built manifest version.`);
  }
  return version;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    if (process.env.RELEASE_PRERELEASE !== 'false' || process.env.RELEASE_DRAFT !== 'false') {
      throw new Error('Only a published stable release can be submitted to the Chrome Web Store.');
    }
    const packageVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;
    const manifestVersion = process.argv[2]
      ? JSON.parse(readFileSync(process.argv[2], 'utf8')).version
      : packageVersion;
    console.log(validateRelease(process.env.RELEASE_TAG, packageVersion, manifestVersion));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
