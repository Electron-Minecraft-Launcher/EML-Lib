/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 */

import { MinecraftManifest } from './../../types/manifest.js'
import { EMLLibError, ErrorType } from '../../types/errors.js'
import { JAVA_RUNTIME_URL, MINECRAFT_MANIFEST_URL } from './consts.js'
import { FormatFile, ILoader } from '../../types/file.js'
import { ResolvedConfig } from '../../types/config.js'
import { existsSync } from 'node:fs'
import path_ from 'node:path'
import utils from './utils.js'

type JavaVersion =
  'java-runtime-alpha' | 'java-runtime-beta' | 'java-runtime-delta' | 'java-runtime-gamma' | 'java-runtime-gamma-snapshot' | 'jre-legacy'

class Manifest {
  /**
   * Get the manifest of the Minecraft version.
   * @param config The resolved configuration.
   * @returns The manifest of the Minecraft version.
   */
  async getMinecraftManifest(config: ResolvedConfig): Promise<MinecraftManifest> {
    let minecraftVersion = config.minecraft.version!
    if (!minecraftVersion) {
      throw new EMLLibError(ErrorType.MINECRAFT_ERROR, 'Minecraft version is not specified in the configuration')
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
   * Get the install profile of the Forge or NeoForge loader.
   * @param config The resolved configuration.
   * @param installer The installer file of the Forge or NeoForge loader to get the install profile from.
   * @returns The install profile of the Forge or NeoForge loader, or `null` if the loader is not Forge or NeoForge.
   */
  async getInstallProfile(config: ResolvedConfig, installer?: FormatFile): Promise<any> {
    const loader = config.minecraft.loader

    if (loader?.loader !== 'forge' && loader?.loader !== 'neoforge') return null

    if (!installer) throw new EMLLibError(ErrorType.CONFIG_ERROR, 'Installer is not specified in the configuration for Forge/NeoForge loader')

    const installerPath = path_.join(config.root, installer.path, installer.name)

    if (!existsSync(installerPath)) throw new EMLLibError(ErrorType.FILE_ERROR, `Installer file not found at ${installerPath}`)

    const { zipfile, entries } = await utils.openZip(installerPath)

    try {
      const installProfileEntry = entries.find((e) => e.fileName === 'install_profile.json')
      if (!installProfileEntry) throw new EMLLibError(ErrorType.FILE_ERROR, 'install_profile.json not found in loader installer')

      const installProfileBuf = await utils.readEntryData(zipfile, installProfileEntry)

      return JSON.parse(installProfileBuf.toString('utf8'))
    } catch (err) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.FILE_ERROR, `Failed to read install profile: ${err instanceof Error ? err.message : err}`)
    } finally {
      zipfile.close()
    }
  }

  /**
   * Get the manifest of the modded loader (Forge, NeoForge, Fabric, or Quilt).
   * @param config The resolved configuration.
   * @param installProfile The install profile of the modded loader.
   * @param installer The installer file of the modded loader.
   * @returns The manifest of the modded loader, or `null` if the loader is not modded.
   */
  async getLoaderManifests(config: ResolvedConfig, installProfile?: any, installer?: FormatFile): Promise<MinecraftManifest | null> {
    const loader = config.minecraft.loader
    const minecraftVersion = config.minecraft.version!

    if (!loader || loader.loader === 'vanilla') {
      return null
    }

    if (loader.loader === 'forge' || loader.loader === 'neoforge') {
      if (!installProfile || !installer) {
        throw new EMLLibError(ErrorType.CONFIG_ERROR, 'Install profile or installer is missing for Forge/NeoForge loader')
      }

      const installerPath = path_.join(config.root, installer.path, installer.name)
      if (!existsSync(installerPath)) {
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Installer file not found at ${installerPath}`)
      }

      let loaderManifest: MinecraftManifest
      if (installProfile.install) {
        loaderManifest = installProfile.versionInfo
        installProfile = installProfile.install
      } else {
        const { zipfile, entries } = await utils.openZip(installerPath)
        try {
          const baseName = path_.basename(installProfile.json)
          const jsonEntry = entries.find((e) => e.fileName === baseName)
          if (!jsonEntry) throw new EMLLibError(ErrorType.FILE_ERROR, `Loader manifest ${baseName} not found in installer`)
          const manifestBuf = await utils.readEntryData(zipfile, jsonEntry!)
          loaderManifest = JSON.parse(manifestBuf.toString('utf8'))
        } catch (err) {
          if (err instanceof EMLLibError) throw err
          throw new EMLLibError(ErrorType.FILE_ERROR, `Failed to read loader manifest from installer: ${err instanceof Error ? err.message : err}`)
        } finally {
          zipfile.close()
        }
      }

      // if (!loader.isCustom) {
      //   await fs.writeFile(jsonPath, JSON.stringify(loaderManifest, null, 2))
      // }

      return loaderManifest
    } else if (loader.loader === 'fabric' || loader.loader === 'quilt') {
      // if (loader.isCustom && existsSync(jsonPath)) {
      //   return { loaderManifest: JSON.parse(await fs.readFile(jsonPath, 'utf-8')), installProfile: null }
      // }
      let loaderManifest: any

      try {
        const url = this.getFabricLikeLoaderManifestUrl(loader.loader, minecraftVersion, loader.version)
        const req = await fetch(url)
        if (!req.ok) {
          const errorText = await req.text()
          throw new EMLLibError(ErrorType.FETCH_ERROR, `Failed to fetch loader manifest: HTTP ${req.status} ${errorText}`)
        }
        loaderManifest = await req.json()
      } catch (err: unknown) {
        if (err instanceof EMLLibError) throw err
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Failed to fetch loader manifest: ${err instanceof Error ? err.message : err}`)
      }

      return loaderManifest
    }

    return null
  }

  /**
   * Get the manifest of the Java version.
   * @param javaVersion The version of Java you want to get the manifest for.
   * @param jreV The major version of Java Runtime Environment (JRE) you want to get the manifest
   * for (fallback if `javaVersion` is not found).
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

  private async getMinecraftManifestUrl(minecraftVersion?: string) {
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

  private async getJavaManifestUrl(javaVersion: JavaVersion, jreV: string) {
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

  private getFabricLikeLoaderManifestUrl(loaderType: 'fabric' | 'quilt', minecraftVersion: string, loaderVersion: string) {
    let metaConfig: { name: string; url: string; apiVersion: string }
    if (loaderType === 'quilt') {
      metaConfig = { name: 'Quilt', url: 'https://meta.quiltmc.org', apiVersion: 'v3' }
    } else {
      metaConfig = { name: 'Fabric', url: 'https://meta.fabricmc.net', apiVersion: 'v2' }
    }
    return `${metaConfig.url}/${metaConfig.apiVersion}/versions/loader/${minecraftVersion}/${loaderVersion}/profile/json`
  }
}

export default new Manifest()

