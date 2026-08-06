/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 */

import { ILoader, File, FormatFile } from '../../types/file.js'
import { ResolvedConfig } from '../../types/config.js'
import { EMLLibError, ErrorType } from '../../types/errors.js'
import utils from './utils.js'

const V = {
  forge: {
    name: 'Forge',
    mavenUrl: 'https://maven.minecraftforge.net',
    group: 'net.minecraftforge',
    artifact: 'forge',
    promotionsUrl: 'https://files.minecraftforge.net/maven/net/minecraftforge/forge/promotions_slim.json'
  },
  neoforge: {
    name: 'NeoForge',
    mavenUrl: 'https://maven.neoforged.net/releases',
    group: 'net.neoforged',
    artifact: 'neoforge',
    promotionsUrl: null
  }
}

class Loader {
  /**
   * Get the loader information based on the configuration. If the Minecraft version (via the
   * `minecraft` or the `profile.minecraft` property) is not specified, it will fetch the loader
   * info from the EML AdminTool. If the Minecraft version is specified, it will return the loader
   * info based on the version and loader type specified in the configuration.
   * @param config The resolved configuration.
   * @returns The loader information to update the `config.minecraft` property with.
   */
  async updateMinecraftConfig(config: ResolvedConfig): Promise<ResolvedConfig['minecraft']> {
    if (!config.minecraft.version && config.url) {
      try {
        const headers: HeadersInit = config.profile.token ? { Authorization: `Bearer ${config.profile.token}` } : {}
        const req = await fetch(`${config.url}/api/loader/${config.profile.slug ?? ''}`, { headers })

        if (!req.ok) {
          const errorText = await req.text()
          throw new EMLLibError(ErrorType.FETCH_ERROR, `Failed to fetch loader info: HTTP ${req.status} ${errorText}`)
        }
        const data: ILoader = await req.json()

        return {
          version: data.minecraftVersion,
          loader: {
            loader: data.type.toLowerCase() as 'vanilla' | 'forge' | 'neoforge' | 'fabric' | 'quilt',
            version: data.loaderVersion ?? data.minecraftVersion
          },
          modpackUrl: config.url ? `${config.url}/api/files-updater/${config.profile.slug ?? ''}` : config.minecraft.modpackUrl!,
          args: config.minecraft.args
        }
      } catch (err: unknown) {
        if (err instanceof EMLLibError) throw err
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Failed to fetch loader info: ${err instanceof Error ? err.message : err}`)
      }
    }

    if (config.minecraft.loader?.loader === 'vanilla') {
      return {
        version: config.minecraft.version ?? 'latest_release',
        loader: {
          loader: 'vanilla',
          version: config.minecraft.version ?? 'latest_release'
        },
        modpackUrl: config.minecraft.modpackUrl,
        args: config.minecraft.args
      }
    }

    return {
      version: config.minecraft.version!,
      loader: {
        loader: config.minecraft.loader!.loader,
        version: config.minecraft.loader!.version
      },
      modpackUrl: config.minecraft.modpackUrl,
      args: config.minecraft.args
    }
  }

  async getInstaller(config: ResolvedConfig): Promise<FormatFile | undefined> {
    const loader = config.minecraft?.loader
    const minecraftVersion = config.minecraft?.version!

    if (loader?.loader !== 'forge' && loader?.loader !== 'neoforge') return

    const v = V[loader.loader]
    let use = 'installer'
    let ext = 'jar'

    try {
      if (loader.loader === 'forge') {
        const metaUrl = `https://files.minecraftforge.net/net/minecraftforge/forge/${loader.version}/meta.json`
        const req = await fetch(metaUrl)

        if (!req.ok) {
          const errorText = await req.text()
          throw new EMLLibError(ErrorType.FETCH_ERROR, `Failed to fetch Forge meta: HTTP ${req.status} ${errorText}`)
        }
        const data: any = await req.json()

        const meta = data.classifiers
        use = this.getFormat(meta)
        ext = Object.keys(meta[use])[0]
      }

      // TODO change file path/name
      const name = `${v.artifact}-${loader.version}-installer.${ext}`
      const path = `versions/`
      const url = `${v.mavenUrl}/${v.group.replace(/\./g, '/')}/${v.artifact}/${loader.version}/${v.artifact}-${loader.version}-${use}.${ext}`
      const size = await utils.getRemoteFileSize(url, `Failed to fetch ${v.name} artifact size`)
      const sha1 = await utils.getRemoteFileSha1(url, `Failed to fetch ${v.name} artifact SHA1`)
      const type = 'OTHER' as const
      const format = this.getTypedFormat(use)

      return { name, path, url, size, sha1, type, format }
    } catch (err) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.FETCH_ERROR, `Failed to fetch ${v.name} meta: ${err instanceof Error ? err.message : err}`)
    }
  }

  private getFormat(forgeMeta: any) {
    if (forgeMeta.installer) return 'installer'
    else if (forgeMeta.client) return 'client'
    return 'universal'
  }

  private getTypedFormat(format: string) {
    switch (format) {
      case 'installer':
        return 'INSTALLER' as const
      case 'client':
        return 'CLIENT' as const
      default:
        return 'UNIVERSAL' as const
    }
  }
}

export default new Loader()

