import path from 'path';
import { promises as fs } from 'fs';

import semver from 'semver';
import chalk from 'chalk';
import { PluginPackage } from './types';

export async function checkForConflicts(modFolder: string) {
  await fs.mkdir(modFolder, { recursive: true });
  const dependencies: {
    [packageName: string]: { [dependent: string]: string }[];
  } = {};

  await Promise.all(
    (
      await fs.readdir(path.resolve(modFolder))
    ).map(async (modDir) => {
      if (modDir === '.cache') return;
      if (!(await fs.lstat(path.join(modFolder, modDir))).isDirectory()) return;
      const modPackagePath = path.join(modFolder, modDir, 'package.json');
      try {
        await fs.access(modPackagePath);
      } catch {
        return;
      }
      const modMetadata = JSON.parse(
        await fs.readFile(modPackagePath, 'utf-8')
      ) as PluginPackage;
      Object.entries(modMetadata.dependencies).forEach(
        ([packageName, version]) => {
          dependencies[packageName] = dependencies[packageName] || [];
          dependencies[packageName].push({ [modMetadata.name]: version });
        }
      );
      return;
    })
  );

  let hadConflict = false;
  const conflictingPackages: {
    [dependent: string]: { [dependency: string]: string };
  } = {};
  // Show some warnings for incompatible plugins.
  Object.entries(dependencies).forEach(([packageName, versions]) => {
    // Find if any have different major versions
    const majorVersions = versions.reduce((prev: number[], next) => {
      const versionObj = semver.coerce(Object.values(next)[0]);
      const majorVersion = !versionObj
        ? 0
        : versionObj.major === 0
        ? versionObj.minor
        : versionObj.major;
      if (prev.includes(majorVersion)) {
        return prev;
      }
      return prev.concat(majorVersion);
    }, []);

    const hasConflict = majorVersions.length > 1;

    if (hasConflict) {
      conflictingPackages[packageName] = {};
      hadConflict = true;
      console.warn(
        chalk.yellowBright(
          chalk.bold(`Conflicting versions for mod "${packageName}":`)
        )
      );
      versions.forEach((item) => {
        const [name, version] = Object.entries(item)[0];
        conflictingPackages[packageName][name] = version;
        console.warn(chalk.yellow(`  ${name}: ${version}`));
      });
      console.warn('');
    }
  });
  if (hadConflict) {
    console.warn(
      chalk.yellowBright(
        'To resolve this warning, make sure all of your mods use the same major version of their packages. Learn more about versioning packages here: https://docs.npmjs.com/about-semantic-versioning'
      )
    );
  }
  return conflictingPackages;
}
