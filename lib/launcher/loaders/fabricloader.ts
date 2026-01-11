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

export default class FabricLoader extends EventEmitter<FilesManagerEvents> {
  private readonly config: FullConfig
  private readonly manifest: MinecraftManifest
  private readonly loader: ILoader

  constructor(config: FullConfig, manifest: MinecraftManifest, loader: ILoader) {
    super()
    this.config = config
    this.manifest = manifest
    this.loader = loader
  }

  /**
   * Setup Fabric loader.
   * @returns `loaderManifest`: Loader manifest; `installProfile`: null (Fabric n'en a pas); `libraries`: libraries
   * to download; `files`: all files created by this method or that will be created (including `libraries`)
   */
  async setup() {
    const versionPath = path_.join(this.config.root, 'versions', `fabric-${this.loader.loaderVersion}`)
    const jsonPath = path_.join(versionPath, `${this.loader.minecraftVersion}-fabric-${this.loader.loaderVersion}.json`)

    if (!existsSync(versionPath)) {
      await fs.mkdir(versionPath, { recursive: true })
    }

    const url = `https://meta.fabricmc.net/v2/versions/loader/${this.manifest.id}/${this.loader.loaderVersion}/profile/json`
    let fabricManifest: any

    try {
      const req = await fetch(url)
      if (!req.ok) {
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Failed to fetch Fabric loader manifest: HTTP ${req.status} ${errorText}`)
      }
      fabricManifest = await req.json()
    } catch (err: unknown) {
      if (existsSync(jsonPath)) {
        const content = await fs.readFile(jsonPath, 'utf-8')
        fabricManifest = JSON.parse(content)
      } else {
        if (err instanceof EMLLibError) throw err
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Failed to fetch Fabric loader manifest: ${err instanceof Error ? err.message : err}`)
      }
    }

    const files: File[] = []

    fabricManifest.id = `${this.loader.minecraftVersion}-fabric-${this.loader.loaderVersion}`

    await fs.writeFile(jsonPath, JSON.stringify(fabricManifest, null, 2))
    files.push({
      name: `${this.loader.minecraftVersion}-fabric-${this.loader.loaderVersion}.json`,
      path: path_.relative(this.config.root, versionPath),
      url: url,
      type: 'OTHER'
    })

    const libraries = await this.formatLibraries(fabricManifest.libraries)
    files.push(...libraries)

    return {
      loaderManifest: fabricManifest,
      installProfile: null,
      libraries: libraries,
      files: files
    }
  }

  private async formatLibraries(libs: any[]): Promise<ExtraFile[]> {
    const promises = libs.map(async (lib) => {
      const name = utils.getLibraryName(lib.name)
      const path = utils.getLibraryPath(lib.name, 'libraries')
      const baseUrl = lib.url ?? 'https://maven.fabricmc.net/'
      const url = `${baseUrl}${utils.getLibraryPath(lib.name).replaceAll('\\', '/')}${name}`

      const sizeReq = await fetch(url, { method: 'HEAD' })
      const size = parseInt(sizeReq.headers.get('Content-Length') ?? '0', 10)

      const sha1Req = await fetch(`${url}.sha1`)
      if (!sha1Req.ok) {
        const errorText = await sha1Req.text()
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Failed to fetch SHA1 for library ${name}: HTTP ${sha1Req.status} ${errorText}`)
      }
      const sha1 = await sha1Req.text()

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
