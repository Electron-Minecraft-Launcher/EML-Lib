/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 */

import { FullConfig } from '../../../types/config'
import { ExtraFile, File, ILoader } from '../../../types/file'
import { MinecraftManifest } from '../../../types/manifest'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path_ from 'node:path'
import utils from '../../utils/utils'
import EventEmitter from '../../utils/events'
import { FilesManagerEvents } from '../../../types/events'
import { EMLLibError, ErrorType } from '../../../types/errors'

export default class FabricLikeLoader extends EventEmitter<FilesManagerEvents> {
  private readonly config: FullConfig
  private readonly manifest: MinecraftManifest
  private readonly loader: ILoader
  private readonly metaConfig: { name: string; url: string; apiVersion: string }

  constructor(config: FullConfig, manifest: MinecraftManifest, loader: ILoader) {
    super()
    this.config = config
    this.manifest = manifest
    this.loader = loader

    if (this.loader.type === 'QUILT') {
      this.metaConfig = { name: 'Quilt', url: 'https://meta.quiltmc.org', apiVersion: 'v3' }
    } else {
      this.metaConfig = { name: 'Fabric', url: 'https://meta.fabricmc.net', apiVersion: 'v2' }
    }
  }

  /**
   * Setup Fabric or Quilt loader.
   * @returns `loaderManifest`: Loader manifest; `installProfile`: null (Fabric n'en a pas); `libraries`: libraries
   * to download; `files`: all files created by this method or that will be created (including `libraries`)
   */
  async setup() {
    const loaderId = this.loader.type.toLowerCase()
    const versionPath = path_.join(this.config.root, 'versions', `${loaderId}-${this.loader.loaderVersion}`)
    const jsonName = `${this.loader.minecraftVersion}-${loaderId}-${this.loader.loaderVersion}.json`
    const jsonPath = path_.join(versionPath, jsonName)

    if (!existsSync(versionPath)) {
      await fs.mkdir(versionPath, { recursive: true })
    }

    const url = `${this.metaConfig.url}/${this.metaConfig.apiVersion}/versions/loader/${this.manifest.id}/${this.loader.loaderVersion}/profile/json`
    let loaderManifest: any

    try {
      const req = await fetch(url)
      if (!req.ok) {
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Failed to fetch ${this.metaConfig.name} loader manifest: HTTP ${req.status} ${errorText}`)
      }
      loaderManifest = await req.json()
    } catch (err: unknown) {
      if (existsSync(jsonPath)) {
        const content = await fs.readFile(jsonPath, 'utf-8')
        loaderManifest = JSON.parse(content)
      } else {
        if (err instanceof EMLLibError) throw err
        throw new EMLLibError(
          ErrorType.FETCH_ERROR,
          `Failed to fetch ${this.metaConfig.name} loader manifest: ${err instanceof Error ? err.message : err}`
        )
      }
    }

    const files: File[] = []

    loaderManifest.id = `${this.loader.minecraftVersion}-${loaderId}-${this.loader.loaderVersion}`

    await fs.writeFile(jsonPath, JSON.stringify(loaderManifest, null, 2))
    files.push({
      name: jsonName,
      path: path_.relative(this.config.root, versionPath),
      url: url,
      type: 'OTHER'
    })

    const libraries = await this.formatLibraries(loaderManifest.libraries)
    files.push(...libraries)

    return {
      loaderManifest: loaderManifest,
      installProfile: null,
      libraries: libraries,
      files: files
    }
  }

  private async formatLibraries(libs: any[]) {
    const promises = libs.map(async (lib) => {
      const name = utils.getLibraryName(lib.name)
      const path = utils.getLibraryPath(lib.name, 'libraries')
      const defaultBaseUrl = this.loader.type === 'QUILT' ? 'https://maven.quiltmc.org/repository/release/' : 'https://maven.fabricmc.net/'
      const baseUrl = lib.url ?? defaultBaseUrl
      const url = `${baseUrl}${utils.getLibraryPath(lib.name).replaceAll('\\', '/')}${name}`

      let size = 0
      let sha1 = ''

      try {
        const sizeReq = await fetch(url, { method: 'HEAD' })
        size = parseInt(sizeReq.headers.get('Content-Length') ?? '0', 10)

        const sha1Req = await fetch(`${url}.sha1`)
        if (sha1Req.ok) {
          sha1 = await sha1Req.text()
        }
      } catch (e) {
        console.warn(`Failed to fetch metadata for ${name}, downloading blindly.`)
      }

      return {
        name: name,
        path: path,
        url: url,
        sha1: sha1,
        size: size,
        type: 'LIBRARY',
        extra: 'LOADER'
      } as ExtraFile
    })

    return await Promise.all(promises)
  }
}
