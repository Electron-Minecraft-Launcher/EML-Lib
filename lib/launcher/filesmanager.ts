/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 * @copyright Copyright (c) 2019, Pierce Harriz, from [Minecraft Launcher Core](https://github.com/Pierce01/MinecraftLauncher-core)
 */

import { ResolvedConfig } from '../../types/config.js'
import { EMLLibError, ErrorType } from '../../types/errors.js'
import { ExtraFile, File, FormatFile, ILoader } from '../../types/file.js'
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
  private readonly config: ResolvedConfig
  private readonly minecraftManifest: MinecraftManifest
  private readonly loaderManifest: MinecraftManifest | null
  private readonly installProfile: any
  private readonly installer?: FormatFile

  constructor(
    config: ResolvedConfig,
    minecraftManifest: MinecraftManifest,
    loaderManifest: MinecraftManifest | null,
    installProfile: any,
    installer?: FormatFile
  ) {
    super()
    this.config = config
    this.minecraftManifest = minecraftManifest
    this.loaderManifest = loaderManifest
    this.installProfile = installProfile
    this.installer = installer
  }

  /**
   * Get Java files.
   * @returns `java`: Java files; `files`: all files created by the method or that will be created
   * (including `java`).
   */
  async getJava(): Promise<{ java: File[]; files: File[] }> {
    const java = await new Java(this.config).getFiles(this.minecraftManifest)
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
    const slug = utils.sanitizeSlug(this.config.storage === 'shared' && this.config.profile.slug ? this.config.profile.slug : '')
    const gameDirectory = path_.join(this.config.root, slug).replaceAll('\\', '/')
    if (!existsSync(gameDirectory)) {
      await fs.mkdir(gameDirectory, { recursive: true })
    }

    if (!this.config.url && !this.config.minecraft.modpackUrl) return { modpack: [], files: [] }

    try {
      const headers: HeadersInit = this.config.profile.token ? { Authorization: `Bearer ${this.config.profile.token}` } : {}
      const url = this.config.url ? `${this.config.url}/api/files-updater/${this.config.profile.slug ?? ''}` : this.config.minecraft.modpackUrl!
      const req = await fetch(url, { headers })

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

    files.push({ name: `${this.minecraftManifest.id}.json`, path: path_.join('versions', this.minecraftManifest.id, '/'), url: '', type: 'OTHER' })

    try {
      if (!existsSync(path_.join(this.config.root, 'versions', this.minecraftManifest.id))) {
        await fs.mkdir(path_.join(this.config.root, 'versions', this.minecraftManifest.id), { recursive: true })
      }

      await fs.writeFile(
        path_.join(this.config.root, 'versions', this.minecraftManifest.id, `${this.minecraftManifest.id}.json`),
        JSON.stringify(this.minecraftManifest, null, 2)
      )
    } catch (err) {
      throw new EMLLibError(ErrorType.FETCH_ERROR, `Failed to write Minecraft manifest: ${err instanceof Error ? err.message : err}`)
    }

    this.minecraftManifest.libraries.forEach((lib) => {
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
      name: `${this.minecraftManifest.id}.jar`,
      path: path_.join('versions', this.minecraftManifest.id, '/'),
      url: this.minecraftManifest.downloads.client.url,
      sha1: this.minecraftManifest.downloads.client.sha1,
      size: this.minecraftManifest.downloads.client.size,
      type: 'LIBRARY',
      extra: 'MINECRAFT'
    })

    files.push(...libraries)

    return { libraries, files }
  }

  // TODO handle custom assetIndex.json by reading the minecraftManifest and loaderManifest -> loaderManifest can override the minecraftManifest assetIndex.json
  /**
   * Get assets files.
   * @returns `assets`: Assets files; `files`: all files created by this method or that will be
   * created (including `assets`).
   */
  async getAssets(): Promise<{ assets: File[]; files: File[] }> {
    try {
      const req = await fetch(this.minecraftManifest.assetIndex.url)

      if (!req.ok) {
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Failed to fetch assets index: HTTP ${req.status} ${errorText}`)
      }

      const data = (await req.json()) as Assets

      let files: File[] = []
      let assets: File[] = []

      files.push({ name: `${this.minecraftManifest.assets}.json`, path: path_.join('assets', 'indexes', '/'), url: '', type: 'OTHER' })

      try {
        if (!existsSync(path_.join(this.config.root, 'assets', 'indexes'))) {
          await fs.mkdir(path_.join(this.config.root, 'assets', 'indexes'), { recursive: true })
        }

        await fs.writeFile(path_.join(this.config.root, 'assets', 'indexes', `${this.minecraftManifest.assets}.json`), JSON.stringify(data, null, 2))
      } catch (err) {
        throw new EMLLibError(ErrorType.FILE_ERROR, `Failed to write assets index: ${err instanceof Error ? err.message : err}`)
      }

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

  async getLoaderLibraries(): Promise<{ libraries: ExtraFile[]; files: File[] }> {
    const loader = this.config.minecraft.loader

    if (!this.loaderManifest || !loader) return { libraries: [], files: [] }

    let files: File[] = []
    let libraries: ExtraFile[] = []

    files.push({ name: `${this.loaderManifest.id}.json`, path: path_.join('versions', this.loaderManifest.id, '/'), url: '', type: 'OTHER' })

    try {
      if (!existsSync(path_.join(this.config.root, 'versions', this.loaderManifest.id))) {
        await fs.mkdir(path_.join(this.config.root, 'versions', this.loaderManifest.id), { recursive: true })
      }

      await fs.writeFile(
        path_.join(this.config.root, 'versions', this.loaderManifest.id, `${this.loaderManifest.id}.json`),
        JSON.stringify(this.loaderManifest, null, 2)
      )
    } catch (err) {
      throw new EMLLibError(ErrorType.FILE_ERROR, `Failed to write loader manifest: ${err instanceof Error ? err.message : err}`)
    }

    if (this.loaderManifest.libraries) {
      libraries.push(...(await this.formatLibraries(this.loaderManifest.libraries, 'LOADER')))
    }

    // TODO only one 'if'
    if (this.installProfile) {
      if (this.installProfile.libraries) {
        libraries.push(...(await this.formatLibraries(this.installProfile.libraries, 'INSTALL')))
      }

      // if (this.installProfile.filePath) {
      //   const universalName = utils.getLibraryName(this.installProfile.path)
      //   const universalPath = utils.getLibraryPath(this.installProfile.path)
      //   libraries.push({
      //     name: universalName,
      //     path: path_.join('libraries', universalPath),
      //     url: '',
      //     type: 'LIBRARY',
      //     extra: 'INSTALL'
      //   })
      // } else if (this.installProfile.path) {
      //   if (!this.installer) {
      //     throw new EMLLibError(ErrorType.FILE_ERROR, 'Installer file is required to extract libraries from the installer')
      //   }
      //   const universalPath = utils.getLibraryPath(this.installProfile.path)
      //   const mavenPath = path_.join('maven', universalPath).replace(/\\/g, '/')
      //   const installerPath = path_.join(this.config.root, this.installer.path, this.installer.name)

      //   const { zipfile, entries } = await utils.openZip(installerPath)

      //   try {
      //     const entriesToExtract = entries.filter((e) => e.fileName.includes(mavenPath) && e.fileName.endsWith('.jar'))
      //     for (const entry of entriesToExtract) {
      //       libraries.push({
      //         name: path_.basename(entry.fileName),
      //         path: path_.join('libraries', universalPath),
      //         url: '',
      //         type: 'LIBRARY',
      //         extra: 'INSTALL'
      //       })
      //     }
      //   } finally {
      //     zipfile.close()
      //   }
      // }

      // if (this.installProfile.data?.PATCHED) {
      //   const entry = this.installProfile.data.PATCHED
      //   const rawValue = entry.client || entry.path || (typeof entry === 'string' ? entry : '')

      //   if (rawValue && rawValue.startsWith('[')) {
      //     const cleanLib = rawValue.replace('[', '').replace(']', '')
      //     libraries.push({
      //       name: utils.getLibraryName(cleanLib),
      //       path: path_.join('libraries', utils.getLibraryPath(cleanLib)),
      //       url: '',
      //       sha1: '',
      //       size: 0,
      //       type: 'LIBRARY',
      //       extra: 'INSTALL'
      //     })
      //   }
      // }

      // if (this.installProfile.processors && this.installProfile.processors.length > 0) {
      //   const universalMaven = this.installProfile.libraries.find(
      //     (lib: any) => (lib.name + '').startsWith('net.minecraftforge:forge:') || (lib.name + '').startsWith('net.neoforged:neoforge:')
      //   )
      //   const targetName = this.installProfile.path ?? universalMaven?.name

      //   if (targetName) {
      //     files.push({
      //       name: utils.getLibraryName(targetName).replace('.jar', '-clientdata.lzma'),
      //       path: path_.join('libraries', utils.getLibraryPath(targetName)),
      //       url: '',
      //       type: 'LIBRARY'
      //     })
      //   }
      // }
    }

    // I think this is not useful anymore since the installer is downloaded before...
    // // TODO manage loader manifest (cf. getLibraries)
    // if (loader.loader === 'forge' || loader.loader === 'neoforge') {
    //   libraries.push({ ...this.loader.file!, extra: 'INSTALL', type: 'LIBRARY' })
    // }

    files.push(...libraries)

    return { libraries, files }
  }

  /**
   * Get authlib-injector file.
   * @returns `injector`: The injector file object; `files`: array containing the injector.
   */
  async getInjector(): Promise<{ injector: File[]; files: File[] }> {
    if (this.config.account.meta.type !== 'yggdrasil') return { injector: [], files: [] }

    const url = 'https://github.com/yushijinhun/authlib-injector/releases/download/v1.2.7/authlib-injector-1.2.7.jar'
    const size = await utils.getRemoteFileSize(url, 'Failed to get authlib-injector file size')

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
    if (+this.minecraftManifest.id.split('.')[1] <= 16 && +this.minecraftManifest.id.split('.')[1] >= 12) {
      log4j.push({
        name: 'log4j2_112-116.xml',
        path: '',
        url: 'https://launcher.mojang.com/v1/objects/02937d122c86ce73319ef9975b58896fc1b491d1/log4j2_112-116.xml',
        sha1: '02937d122c86ce73319ef9975b58896fc1b491d1',
        size: 4096,
        type: 'CONFIG'
      })
    } else if (+this.minecraftManifest.id.split('.')[1] <= 11 && +this.minecraftManifest.id.split('.')[1] >= 7) {
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
    const nativesFolder = path_.resolve(this.config.root, 'bin', this.minecraftManifest.id)
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
              path: path_.join('bin', this.minecraftManifest.id, path_.dirname(entryName), '/'),
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

    if (this.minecraftManifest.assets === 'legacy' || this.minecraftManifest.assets === 'pre-1.6') {
      if (existsSync(path_.join(this.config.root, 'assets', 'legacy'))) {
        this.emit('copy_debug', "The 'assets/legacy' directory is no longer used. You can safely remove it from your server's root directory.")
      }

      const assetsContent = await fs.readFile(path_.join(this.config.root, 'assets', 'indexes', `${this.minecraftManifest.assets}.json`), 'utf-8')
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
    const slug = utils.sanitizeSlug(this.config.profile.slug ?? '')
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

  private async formatLibraries(libs: MinecraftManifest['libraries'], extra: 'INSTALL' | 'LOADER') {
    const loader = this.config.minecraft.loader!

    const promises = libs.map(async (lib) => {
      let artifact = lib.downloads?.artifact
      let native: string | undefined

      let name = utils.getLibraryName(lib.name!)
      let path = utils.getLibraryPath(lib.name!, 'libraries')
      let url = ''
      let sha1 = ''
      let size = 0
      let type: 'LIBRARY' | 'NATIVE' = 'LIBRARY'

      if (loader.loader === 'forge' || loader.loader === 'neoforge') {
        if (lib.natives) {
          native = lib.natives[utils.getOS_MCCode()]
          if (!native) return null
          if (artifact && !artifact.path) name = name.replace('.jar', `-${native}.jar`)
          type = 'NATIVE'
        } else {
          if (!utils.isLibAllowed(lib) || (!lib.serverreq && !lib.clientreq && !lib.url && !lib.downloads)) return null
        }
      }

      if (artifact) {
        if (artifact.path) {
          name = artifact.path.split('/').pop()!
          path = path_.join('libraries', artifact.path.split('/').slice(0, -1).join('/'), '/')
        }
        url = artifact.url
        sha1 = artifact.sha1
        size = artifact.size
      } else {
        const info = await this.getLibInfo(lib)
        url = info.url
        sha1 = info.sha1
        size = info.size
      }

      return { name, path, url, sha1, size, type, extra } as ExtraFile
    })

    const results = await Promise.all(promises)
    return results.filter((lib): lib is ExtraFile => lib !== null)
  }

  private async getLibInfo(lib: MinecraftManifest['libraries'][number]) {
    const loader = this.config.minecraft.loader!

    let mirrors: string[]

    if (lib.url) {
      mirrors = [lib.url]
    } else if (loader.loader === 'forge') {
      mirrors = ['https://libraries.minecraft.net', 'https://maven.minecraftforge.net', 'https://maven.creeperhost.net']
    } else if (loader.loader === 'neoforge') {
      mirrors = ['https://libraries.minecraft.net', 'https://maven.neoforged.net/releases']
    } else if (loader.loader === 'fabric') {
      mirrors = ['https://maven.fabricmc.net']
    } else if (loader.loader === 'quilt') {
      mirrors = ['https://maven.quiltmc.org/repository/release']
    } else {
      mirrors = ['https://libraries.minecraft.net']
    }

    let lastError: Error | null = null
    for (const mirror of mirrors) {
      const url = `${mirror}/${utils.getLibraryPath(lib.name!).replaceAll('\\', '/')}${utils.getLibraryName(lib.name!)}`
      try {
        const [size, sha1] = await Promise.all([
          lib.size ?? utils.getRemoteFileSize(url, `Failed to get size for ${lib.name}`),
          lib.sha1 ?? utils.getRemoteFileSha1(url, `Failed to get SHA1 for ${lib.name}`)
        ])
        return { url, size, sha1 }
      } catch (err) {
        lastError = err as Error | EMLLibError
      }
    }

    if (lastError) {
      throw lastError
    }

    return { url: '', size: 0, sha1: '' }
  }
}

