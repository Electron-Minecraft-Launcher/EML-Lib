/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 */

import { ILoader, File } from '../../types/file.js'
import { ResolvedConfig } from '../../types/config.js'
import { EMLLibError, ErrorType } from '../../types/errors.js'
import utils from '../utils/utils.js'
import type { File as File_ } from '../../types/file.js'

const V = {
  FORGE: {
    name: 'Forge',
    mavenUrl: 'https://maven.minecraftforge.net',
    group: 'net.minecraftforge',
    artifact: 'forge',
    promotionsUrl: 'https://files.minecraftforge.net/maven/net/minecraftforge/forge/promotions_slim.json'
  },
  NEOFORGE: {
    name: 'NeoForge',
    mavenUrl: 'https://maven.neoforged.net/releases',
    group: 'net.neoforged',
    artifact: 'neoforge',
    promotionsUrl: null
  }
}

class Loaders {
  /**
   * Get the loader information based on the configuration. If the Minecraft version is not specified,
   * it will fetch the loader info from the EML AdminTool. If the Minecraft version is specified, it
   * will return the loader info based on the version and loader type specified in the configuration.
   * @param config The resolved configuration.
   * @returns The loader information.
   */
  async getLoader(config: ResolvedConfig): Promise<ILoader> {
    if (!config.minecraft.version && !config.url) {
      return { type: 'VANILLA', minecraftVersion: 'latest_release', loaderVersion: 'latest_release' } as ILoader
    } else if (!config.minecraft.version && config.url) {
      try {
        const req = await fetch(`${config.url}/api/loader/${config.slug ?? ''}`)

        if (!req.ok) {
          const errorText = await req.text()
          throw new EMLLibError(ErrorType.FETCH_ERROR, `Failed to fetch loader info: HTTP ${req.status} ${errorText}`)
        }
        const data: ILoader = await req.json()

        return data
      } catch (err: unknown) {
        if (err instanceof EMLLibError) throw err
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Failed to fetch loader info: ${err instanceof Error ? err.message : err}`)
      }
    } else {
      if (config.minecraft.loader?.loader === 'vanilla') {
        return {
          type: 'VANILLA',
          minecraftVersion: config.minecraft.version ?? 'latest_release',
          loaderVersion: config.minecraft.loader.version ?? config.minecraft.version ?? 'latest_release'
        } as ILoader
      }
      if (config.minecraft.loader?.loader === 'forge') {
        const forge = await this.getForgeLikeFile('FORGE', config.minecraft.loader.version)
        return {
          type: 'FORGE',
          minecraftVersion: config.minecraft.version!,
          loaderVersion: config.minecraft.loader.version,
          format: forge.format,
          file: forge.file,
          updatedAt: new Date()
        } as ILoader
      }
      if (config.minecraft.loader?.loader === 'neoforge') {
        const neoforge = await this.getForgeLikeFile('NEOFORGE', config.minecraft.loader.version)
        return {
          type: 'NEOFORGE',
          minecraftVersion: config.minecraft.version!,
          loaderVersion: config.minecraft.loader.version,
          format: neoforge.format,
          file: neoforge.file,
          updatedAt: new Date()
        } as ILoader
      }
      if (config.minecraft.loader?.loader === 'fabric') {
        return {
          type: 'FABRIC',
          minecraftVersion: config.minecraft.version!,
          loaderVersion: config.minecraft.loader.version!,
          format: 'CLIENT'
        } as ILoader
      }
      if (config.minecraft.loader?.loader === 'quilt') {
        return {
          type: 'QUILT',
          minecraftVersion: config.minecraft.version!,
          loaderVersion: config.minecraft.loader.version!,
          format: 'CLIENT'
        } as ILoader
      }
      throw new EMLLibError(ErrorType.CONFIG_ERROR, 'Invalid loader type')
    }
  }

  private async getForgeLikeFile(loader: 'FORGE' | 'NEOFORGE', loaderVersion: string) {
    const v = V[loader]
    let format = 'installer'
    let ext = 'jar'

    if (loader === 'FORGE') {
      const metaUrl = `https://files.minecraftforge.net/net/minecraftforge/forge/${loaderVersion}/meta.json`
      const req = await fetch(metaUrl)

      if (!req.ok) {
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Failed to fetch Forge meta: HTTP ${req.status} ${errorText}`)
      }
      const data: any = await req.json()

      const meta = data.classifiers
      format = this.getFormat(meta)
      ext = Object.keys(meta[format])[0]
    }

    const url = `${v.mavenUrl}/${v.group.replace(/\./g, '/')}/${v.artifact}/${loaderVersion}/${v.artifact}-${loaderVersion}-${format.toLowerCase()}.${ext}`
    const name = `${v.artifact}-${loaderVersion}.${ext}`
    const path = `versions/${v.artifact}-${loaderVersion}/`
    const size = await utils.getRemoteFileSize(url, 'Failed to fetch ForgeLike artifact size')
    const sha1 = await utils.getRemoteFileSha1(`${url}.sha1`, 'Failed to fetch ForgeLike artifact SHA1')
    const type = 'OTHER' as const

    return {
      format: this.getTypedFormat(format),
      file: { name, path, url, size, sha1, type }
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

export default new Loaders()

