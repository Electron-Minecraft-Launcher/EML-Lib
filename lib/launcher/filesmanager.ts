/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 * @copyright Copyright (c) 2019, Pierce Harriz, from [Minecraft Launcher Core](https://github.com/Pierce01/MinecraftLauncher-core)
 */

import { FullConfig } from '../../types/config.js'
import { EMLLibError, ErrorType } from '../../types/errors.js'
import { ExtraFile, File, ILoader } from '../../types/file.js'
import { Artifact, MinecraftManifest, Assets } from '../../types/manifest.js'
import utils from '../utils/utils.js'
import path_ from 'node:path'
import fs from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { existsSync } from 'node:fs'
import yauzl from 'yauzl'
import EventEmitter from '../utils/events.js'
import { FilesManagerEvents } from '../../types/events.js'
import Java from '../java/java.js'

export default class FilesManager extends EventEmitter<FilesManagerEvents> {
  private config: FullConfig
  private manifest: MinecraftManifest
  private loader: ILoader

  constructor(config: FullConfig, manifest: MinecraftManifest, loader: ILoader) {
    super()
    this.config = config
    this.manifest = manifest
    this.loader = loader
  }

  /**
   * Get Java files.
   * @returns `java`: Java files; `files`: all files created by the method or that will be created
   * (including `java`).
   */
  async getJava(): Promise<{ java: File[]; files: File[] }> {
    const java = await new Java(this.manifest.id, this.config.root).getFiles(this.manifest)
    if (this.config.java.install === 'auto') {
      return { java: java, files: java }
    } else {
      return { java: [], files: java }
    }
  }

  /**
   * Get modpack files.
   * @returns `modpack`: Modpack files; `files`: all files created by this method or that will be
   * created (including `modpack`).
   */
  async getModpack(): Promise<{ modpack: File[]; files: File[] }> {
    if (!this.config.url) return { modpack: [], files: [] }

    try {
      const slug = this.config.profile ? this.config.profile.slug : ''
      const req = await fetch(`${this.config.url}/api/files-updater/${slug}`)

      if (!req.ok) {
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Failed to fetch modpack files: HTTP ${req.status} ${errorText}`)
      }
      const data = await req.json()
      const modpack = this.mapFiles(data.files as File[])

      return { modpack: modpack, files: modpack }
    } catch (err: unknown) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.FETCH_ERROR, `Failed to fetch modpack files: ${err instanceof Error ? err.message : err}`)
    }
  }

  /**
   * Get libraries files.
   * @returns `libraries`: Libraries files; `files`: all files created by this method or that will
   * be created (including `libraries`).
   */
  async getLibraries(): Promise<{ libraries: ExtraFile[]; files: File[] }> {
    let files: File[] = []
    let libraries: ExtraFile[] = []

    if (!existsSync(path_.join(this.config.root, 'versions', this.manifest.id))) {
      await fs.mkdir(path_.join(this.config.root, 'versions', this.manifest.id), { recursive: true })
    }

    files.push({ name: `${this.manifest.id}.json`, path: path_.join('versions', this.manifest.id, '/'), url: '', type: 'OTHER' })
    await fs.writeFile(path_.join(this.config.root, 'versions', this.manifest.id, `${this.manifest.id}.json`), JSON.stringify(this.manifest, null, 2))

    this.manifest.libraries.forEach((lib) => {
      let type: 'LIBRARY' | 'NATIVE'
      let artifact: Artifact | undefined

      if (lib.natives) {
        type = 'NATIVE'
        const classifiers = lib.downloads.classifiers as any
        const native = lib.natives[utils.getOS_MCCode()]
        if (!native) return
        artifact = classifiers ? (classifiers[native.replace('${arch}', utils.getArch())] as unknown as Artifact | undefined) : undefined
      } else {
        if (!utils.isLibAllowed(lib)) return
        type = 'LIBRARY'
        artifact = lib.downloads.artifact
      }

      let name: string
      let path: string

      if (artifact) {
        if (artifact.path) {
          name = path_.basename(artifact.path)
          path = path_.join('libraries', path_.dirname(artifact.path), '/')
        } else {
          name = utils.getLibraryName(lib.name!)
          path = utils.getLibraryPath(lib.name!, 'libraries')
        }

        libraries.push({
          name: name,
          path: path,
          url: artifact.url,
          sha1: artifact.sha1,
          size: artifact.size,
          type: type,
          extra: 'MINECRAFT'
        })
      }
    })

    libraries.push({
      name: `${this.manifest.id}.jar`,
      path: path_.join('versions', this.manifest.id, '/'),
      url: this.manifest.downloads.client.url,
      sha1: this.manifest.downloads.client.sha1,
      size: this.manifest.downloads.client.size,
      type: 'LIBRARY',
      extra: 'MINECRAFT'
    })

    if (this.loader.file) {
      libraries.push({ ...this.loader.file, extra: 'LOADER' })
    }

    files.push(...libraries)

    return { libraries, files }
  }

  /**
   * Get assets files.
   * @returns `assets`: Assets files; `files`: all files created by this method or that will be
   * created (including `assets`).
   */
  async getAssets(): Promise<{ assets: File[]; files: File[] }> {
    try {
      let files: File[] = []
      let assets: File[] = []

      const req = await fetch(this.manifest.assetIndex.url)

      if (!req.ok) {
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Failed to fetch assets index: HTTP ${req.status} ${errorText}`)
      }

      const data = (await req.json()) as Assets

      if (!existsSync(path_.join(this.config.root, 'assets', 'indexes'))) {
        await fs.mkdir(path_.join(this.config.root, 'assets', 'indexes'), { recursive: true })
      }

      files.push({ name: `${this.manifest.assets}.json`, path: path_.join('assets', 'indexes', '/'), url: '', type: 'OTHER' })
      await fs.writeFile(path_.join(this.config.root, 'assets', 'indexes', `${this.manifest.assets}.json`), JSON.stringify(data, null, 2))

      Object.values(data.objects).forEach((asset) => {
        assets.push({
          name: asset.hash,
          path: path_.join('assets', 'objects', asset.hash.substring(0, 2), '/'),
          url: `https://resources.download.minecraft.net/${asset.hash.substring(0, 2)}/${asset.hash}`,
          sha1: asset.hash,
          size: asset.size,
          type: 'ASSET'
        })
      })

      files.push(...assets)

      return { assets, files }
    } catch (err: unknown) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.FETCH_ERROR, `Failed to fetch assets index: ${err instanceof Error ? err.message : err}`)
    }
  }

  /**
   * Get authlib-injector file.
   * @returns `injector`: The injector file object; `files`: array containing the injector.
   */
  async getInjector(): Promise<{ injector: File[]; files: File[] }> {
    if (this.config.account.meta.type !== 'yggdrasil') return { injector: [], files: [] }

    const url = 'https://github.com/yushijinhun/authlib-injector/releases/download/v1.2.7/authlib-injector-1.2.7.jar'

    let size: number
    try {
      const req = await fetch(url, { method: 'HEAD' })

      if (!req.ok) {
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Failed to fetch authlib-injector file info: HTTP ${req.status} ${errorText}`)
      }

      size = Number(req.headers.get('content-length')) || 0
    } catch (err: unknown) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.FETCH_ERROR, `Failed to fetch authlib-injector file info: ${err instanceof Error ? err.message : err}`)
    }

    const injector: File[] = [
      {
        name: 'authlib-injector.jar',
        path: 'libraries/',
        url: url,
        sha1: '',
        size: size,
        type: 'LIBRARY'
      }
    ]

    return { injector: injector, files: injector }
  }

  /**
   * Get Log4j files to patch the Log4shell.
   * @returns `log4j`: Log4j files; `files`: all files created by this method or that will be
   * created (including `log4j`).
   * @see [help.minecraft.net](https://help.minecraft.net/hc/en-us/articles/4416199399693-Security-Vulnerability-in-Minecraft-Java-Edition)
   */
  async getLog4j(): Promise<{ log4j: File[]; files: File[] }> {
    let log4j: File[] = []
    if (+this.manifest.id.split('.')[1] <= 16 && +this.manifest.id.split('.')[1] >= 12) {
      log4j.push({
        name: 'log4j2_112-116.xml',
        path: '',
        url: 'https://launcher.mojang.com/v1/objects/02937d122c86ce73319ef9975b58896fc1b491d1/log4j2_112-116.xml',
        sha1: '02937d122c86ce73319ef9975b58896fc1b491d1',
        size: 4096,
        type: 'CONFIG'
      })
    } else if (+this.manifest.id.split('.')[1] <= 11 && +this.manifest.id.split('.')[1] >= 7) {
      log4j.push({
        name: 'log4j2_17-111.xml',
        path: '',
        url: 'https://launcher.mojang.com/v1/objects/4bb89a97a66f350bc9f73b3ca8509632682aea2e/log4j2_17-111.xml',
        sha1: '4bb89a97a66f350bc9f73b3ca8509632682aea2e',
        size: 4096,
        type: 'CONFIG'
      })
    }

    return { log4j: log4j, files: log4j }
  }

  /**
   * Extract natives from libraries.
   * @param libraries Libraries to extract natives from.
   * @returns `files`: all files created by this method.
   */
  async extractNatives(libraries: File[]): Promise<{ files: File[] }> {
    const natives = libraries.filter((lib) => lib.type === 'NATIVE')
    const nativesFolder = path_.resolve(this.config.root, 'bin', this.manifest.id)
    let files: File[] = []

    if (!existsSync(nativesFolder)) {
      await fs.mkdir(nativesFolder, { recursive: true })
    }

    const promises = natives.map((native) => {
      return new Promise<void>((resolve, reject) => {
        const zipPath = path_.join(this.config.root, native.path, native.name)
        if (!existsSync(zipPath)) return resolve()

        yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
          if (err || !zipfile) {
            return reject(new EMLLibError(ErrorType.FILE_ERROR, `Failed to open ${native.name}`))
          }

          zipfile.readEntry()
          zipfile.on('entry', (entry: yauzl.Entry) => {
            if (entry.fileName.startsWith('META-INF')) {
              return zipfile.readEntry()
            }

            const entryName = entry.fileName.replace(/\\/g, '/').replace(/^\/+/, '')
            const entryPath = path_.resolve(nativesFolder, entryName)
            const relative = path_.relative(nativesFolder, entryPath)
            const isSafe = relative && !relative.startsWith('..') && !path_.isAbsolute(relative)

            if (!isSafe || !entryName) {
              console.warn(`[Security] Skipped unsafe native extraction: ${entry.fileName}`)
              return zipfile.readEntry()
            }

            const tmpFile = {
              name: path_.basename(entryName),
              path: path_.join('bin', this.manifest.id, path_.dirname(entryName), '/'),
              url: '',
              sha1: '',
              size: entry.uncompressedSize
            }

            if (entry.fileName.endsWith('/')) {
              files.push({ ...tmpFile, type: 'FOLDER' })
              fs.mkdir(entryPath, { recursive: true })
                .then(() => zipfile.readEntry())
                .catch(reject)
            } else {
              fs.mkdir(path_.dirname(entryPath), { recursive: true })
                .then(() => {
                  zipfile.openReadStream(entry, (err, readStream) => {
                    if (err || !readStream) {
                      return reject(new EMLLibError(ErrorType.FILE_ERROR, `Failed to open read stream for ${entry.fileName}`))
                    }

                    const writeStream = createWriteStream(entryPath)
                    readStream.pipe(writeStream)

                    writeStream.on('close', () => {
                      files.push({ ...tmpFile, type: 'NATIVE' })
                      zipfile.readEntry()
                    })
                    writeStream.on('error', reject)
                    readStream.on('error', reject)
                  })
                })
                .catch(reject)
            }
          })

          zipfile.on('end', () => {
            this.emit('extract_progress', { filename: native.name })
            resolve()
          })
          zipfile.on('error', reject)
        })
      })
    })

    await Promise.all(promises)

    this.emit('extract_end', { amount: files.length })

    return { files }
  }

  /**
   * Copy assets from the assets folder to the resources folder.
   * @returns `files`: all files created by this method.
   */
  async copyAssets(): Promise<{ files: File[] }> {
    let files: File[] = []

    if (this.manifest.assets === 'legacy' || this.manifest.assets === 'pre-1.6') {
      if (existsSync(path_.join(this.config.root, 'assets', 'legacy'))) {
        this.emit('copy_debug', "The 'assets/legacy' directory is no longer used. You can safely remove it from your server's root directory.")
      }

      const assetsContent = await fs.readFile(path_.join(this.config.root, 'assets', 'indexes', `${this.manifest.assets}.json`), 'utf-8')
      const assets = JSON.parse(assetsContent) as Assets

      const promises = Object.entries(assets.objects).map(async ([path, { hash, size }]) => {
        const assetLegacyPath = path_.join('resources', path_.dirname(path))
        const assetLegacyName = path_.basename(path)

        if (!existsSync(path_.join(this.config.root, assetLegacyPath))) {
          await fs.mkdir(path_.join(this.config.root, assetLegacyPath), { recursive: true })
        }

        if (!existsSync(path_.join(this.config.root, assetLegacyPath, assetLegacyName))) {
          await fs.copyFile(
            path_.join(this.config.root, 'assets', 'objects', hash.substring(0, 2), hash),
            path_.join(this.config.root, assetLegacyPath, assetLegacyName)
          )
        }

        files.push({
          name: assetLegacyName,
          path: assetLegacyPath,
          url: '',
          sha1: hash,
          size: size,
          type: 'ASSET'
        })

        this.emit('copy_progress', { filename: hash, dest: path_.join(assetLegacyPath, assetLegacyName) })
      })

      await Promise.all(promises)
    }

    this.emit('copy_end', { amount: files.length })
    return { files }
  }

  private mapFiles(files: File[]) {
    const slug = utils.sanitizeSlug(this.config.profile ? this.config.profile.slug : '')
    if (this.config.storage === 'shared') {
      return files.map((file) => {
        return {
          ...file,
          path: path_.join(slug, file.path)
        }
      })
    }
    return files
  }
}

