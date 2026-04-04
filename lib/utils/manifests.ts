/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 */

import { MinecraftManifest } from './../../types/manifest.js'
import { EMLLibError, ErrorType } from '../../types/errors.js'
import { JAVA_RUNTIME_URL, MINECRAFT_MANIFEST_URL } from './consts.js'
import { ILoader } from '../../types/file.js'
import { ResolvedConfig } from '../../types/config.js'

type JavaVersion =
  | 'java-runtime-alpha'
  | 'java-runtime-beta'
  | 'java-runtime-delta'
  | 'java-runtime-gamma'
  | 'java-runtime-gamma-snapshot'
  | 'jre-legacy'

class Manifests {
  /**
   * Get the manifest of the Minecraft version.
   * @param config The resolved configuration.
   * @param loader The loader information from `Loaders.getLoader()`.
   * @returns The manifest of the Minecraft version.
   */
  async getMinecraftManifest(config: ResolvedConfig, loader?: ILoader): Promise<MinecraftManifest> {
    let minecraftVersion = config.minecraft.version ?? loader?.minecraftVersion
    if (!minecraftVersion) {
      throw new EMLLibError(ErrorType.MINECRAFT_ERROR, 'Minecraft version is not specified in the configuration or loader information')
    }

    try {
      const manifestUrl = await this.getMinecraftManifestUrl(minecraftVersion)
      const req = await fetch(manifestUrl)

      if (!req.ok) {
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Failed to fetch Minecraft manifest: HTTP ${req.status} ${errorText}`)
      }
      const data: MinecraftManifest = await req.json()

      return data
    } catch (err: unknown) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.FETCH_ERROR, `Failed to fetch Minecraft manifest: ${err instanceof Error ? err.message : err}`)
    }
  }

  /**
   * Get the manifest of the Java version.
   * @param javaVersion The version of Java you want to get the manifest for.
   * @param jreV The major version of Java Runtime Environment (JRE) you want to get the manifest for (fallback if `javaVersion` is not found).
   * @returns The manifest of the Java version.
   */
  async getJavaManifest(javaVersion: JavaVersion, jreV: string): Promise<{ files: any }> {
    try {
      const url = await this.getJavaManifestUrl(javaVersion, jreV)

      const req = await fetch(url)

      if (!req.ok) {
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Failed to fetch Java manifest: HTTP ${req.status} ${errorText}`)
      }
      const data: { files: any } = await req.json()

      return data
    } catch (err: unknown) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.FETCH_ERROR, `Failed to fetch Java manifest: ${err instanceof Error ? err.message : err}`)
    }
  }

  private async getMinecraftManifestUrl(minecraftVersion?: string): Promise<string> {
    try {
      const req = await fetch(MINECRAFT_MANIFEST_URL)

      if (!req.ok) {
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Failed to fetch Minecraft version manifest: HTTP ${req.status} ${errorText}`)
      }
      const data = await req.json()

      minecraftVersion =
        minecraftVersion === 'latest_release'
          ? data.latest.release
          : minecraftVersion === 'latest_snapshot'
            ? data.latest.snapshot
            : minecraftVersion || 'latest_release'

      if (!data.versions.find((version: any) => version.id === minecraftVersion)) {
        throw new EMLLibError(ErrorType.MINECRAFT_ERROR, `Minecraft version ${minecraftVersion} not found in manifest`)
      }

      return data.versions.find((version: any) => version.id === minecraftVersion).url as string
    } catch (err: unknown) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.FETCH_ERROR, `Failed to fetch Minecraft version manifest: ${err instanceof Error ? err.message : err}`)
    }
  }

  private async getJavaManifestUrl(javaVersion: JavaVersion, jreV: string): Promise<string> {
    const archMapping = {
      win32: { x64: 'windows-x64', ia32: 'windows-x86', arm64: 'windows-arm64' },
      darwin: { x64: 'mac-os', arm64: 'mac-os-arm64' },
      linux: { x64: 'linux', ia32: 'linux-i386' }
    } as any

    const arch = process.arch
    const platform = process.platform

    if (platform !== 'win32' && platform !== 'darwin' && platform !== 'linux') {
      throw new EMLLibError(ErrorType.UNKNOWN_OS, `Unsupported platform: ${platform}`)
    }

    if (
      (platform === 'win32' && arch !== 'x64' && arch !== 'ia32' && arch !== 'arm64') ||
      (platform === 'darwin' && arch !== 'x64' && arch !== 'arm64') ||
      (platform === 'linux' && arch !== 'x64' && arch !== 'ia32')
    ) {
      throw new EMLLibError(ErrorType.UNKNOWN_OS, `Unsupported architecture: ${arch}`)
    }

    try {
      const req = await fetch(JAVA_RUNTIME_URL)

      if (!req.ok) {
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Failed to fetch Java manifest: HTTP ${req.status} ${errorText}`)
      }
      const data = await req.json()

      let archKey = archMapping[platform][arch]
      if (platform === 'darwin' && arch === 'arm64') {
        const arm64Entries = data[archKey]?.[javaVersion]
        if (!arm64Entries || arm64Entries.length === 0) {
          archKey = 'mac-os'
        }
      }

      if (data[archKey][javaVersion][0]?.manifest) {
        return data[archKey][javaVersion][0].manifest.url as string
      }

      const fallbackJavaVersion = Object.keys(data[archKey]).find((version) => data[archKey][version][0]?.version.name.split('.')[0] === jreV)

      if (fallbackJavaVersion) {
        return data[archKey][fallbackJavaVersion][0].manifest.url as string
      }

      throw new EMLLibError(ErrorType.JAVA_ERROR, `Java version ${javaVersion} not found in manifest`)
    } catch (err: unknown) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.FETCH_ERROR, `Failed to fetch Java manifest: ${err instanceof Error ? err.message : err}`)
    }
  }
}

export default new Manifests()

