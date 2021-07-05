import path from 'path';
import { promises as fs } from 'fs';
import esbuild from 'esbuild';

import { ApiExtension, Base, TestPlugin } from './pluginArchitecture';
import { PluginPackage } from './types';

export async function activatePlugins(
  modFolder: string,
  extraPlugins?: TestPlugin[],
  transformPlugin: (
    plugin: ApiExtension,
    context: { metadata?: PluginPackage; folder?: string }
  ) => Promise<ApiExtension> = async (plugin) => plugin
) {
  try {
    await fs.mkdir(modFolder, { recursive: true });
    await fs.mkdir(path.join(modFolder, '.cache'), { recursive: true });
    const dependencies: {
      [packageName: string]: { [dependent: string]: string }[];
    } = {};
    const plugins = (
      await Promise.all(
        (
          await fs.readdir(path.resolve(modFolder))
        ).map(async (modDir) => {
          if (modDir === '.cache') return null;
          if (!(await fs.lstat(path.join(modFolder, modDir))).isDirectory())
            return null;
          const modPackagePath = path.join(modFolder, modDir, 'package.json');
          try {
            await fs.access(modPackagePath);
          } catch {
            return null;
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

          // Build the mod
          const result = await esbuild.build({
            entryPoints: [
              path.join(modFolder, modDir, modMetadata.main || 'index.ts'),
            ],
            bundle: true,
            format: 'cjs',
            outdir: path.join(
              modFolder,
              `.cache`,
              modMetadata.name,
              modMetadata.version.replace(/\./g, '-')
            ),
          });
          if (result.errors.length > 0 || result.warnings.length > 0) {
            console.warn(`Result building ${modMetadata.name}: `, result);
          }
          await fs.copyFile(
            modPackagePath,
            path.join(
              modFolder,
              `.cache`,
              modMetadata.name,
              modMetadata.version.replace(/\./g, '-'),
              'package.json'
            )
          );
          return {
            modFolder: path.join(modFolder, modDir),
            modMetadata,
            name: modMetadata.name,
            version: modMetadata.version,
            path: path.join(
              modFolder,
              `.cache`,
              modMetadata.name,
              modMetadata.version.replace(/\./g, '-'),
              'index.js'
            ),
          };
        })
      )
    ).filter(Boolean);
    const importedPlugins = (
      await Promise.all(
        plugins.map(async (plugin) => {
          if (!plugin) return null;
          const pluginFunction = (await import(plugin.path)) as TestPlugin;
          return {
            plugin: pluginFunction,
            pluginFolder: plugin.modFolder,
            pluginMetadata: plugin.modMetadata,
          };
        })
      )
    )
      .reduce((prev, next) => {
        if (!next) return prev;
        const { plugin, pluginFolder, pluginMetadata } = next;
        const values = Object.values(plugin).map((value) => {
          value.pluginFolder = pluginFolder;
          value.pluginMetadata = pluginMetadata;
          return value;
        });
        return prev.concat(values);
      }, extraPlugins || [])
      .map((plugin) => {
        plugin.transformPlugin = transformPlugin;
        return plugin;
      });

    const PluginStore = Base.plugin(...importedPlugins);
    const store = new PluginStore();
    await store.applyPlugins();
    // TODO: Calculate the IDs of the plugins. This is the name@version syntax
    store.pluginIds = plugins
      .map((p) => (p ? `${p.name}@${p.version}` : ''))
      .filter(Boolean);
    return store;
  } catch (err) {
    console.error(err);
    const PluginStore = Base.plugin();
    return new PluginStore();
  }
}
