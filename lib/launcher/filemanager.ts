/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 * @copyright Copyright (c) 2019, Pierce Harriz, from [Minecraft Launcher Core](https://github.com/Pierce01/MinecraftLauncher-core)
 */

import { ResolvedConfig } from '../../types/config.js'
import { EMLLibError, ErrorType } from '../../types/errors.js'
import { ExtraFile, File, FormatFile } from '../../types/file.js'
import { Artifact, MinecraftManifest, Assets } from '../../types/manifest.js'
import utils from '../utils/utils.js'
import path_ from 'node:path'
import fs from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { existsSync } from 'node:fs'
import yauzl from 'yauzl'
import EventEmitter from '../utils/events.js'
import { FileManagerEvents } from '../../types/events.js'
import Java from '../java/java.js'

export default class FileManager extends EventEmitter<FileManagerEvents> {
  private readonly config: ResolvedConfig
  private readonly minecraftManifest: MinecraftManifest
  private readonly loaderManifest: MinecraftManifest | null
  private readonly installProfile: any
  private readonly installer?: FormatFile

  private patches: Record<string, Artifact | null> = {}

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
    this.patches = await this.getPatchedManifest()

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

    for (const lib of this.minecraftManifest.libraries) {
      let type: 'LIBRARY' | 'NATIVE'
      let artifact: Artifact | undefined

      if (lib.natives) {
        type = 'NATIVE'
        artifact = await this.patchNative(lib)
        if (!artifact) continue
        // if (artifact.path && artifact.path.includes('/3.3.1/')) type = 'LIBRARY'
      } else {
        if (!utils.isLibAllowed(lib)) continue
        type = 'LIBRARY'
        artifact = await this.patchLibrary(lib)
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
    }

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

  /**
   * Get assets files.
   * @returns `assets`: Assets files; `files`: all files created by this method or that will be
   * created (including `assets`).
   */
  async getAssets(): Promise<{ assets: File[]; files: File[] }> {
    try {
      const url = this.loaderManifest?.assetIndex?.url ?? this.minecraftManifest.assetIndex.url
      const req = await fetch(url)

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
          url: asset.url ?? `https://resources.download.minecraft.net/${asset.hash.substring(0, 2)}/${asset.hash}`,
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
   * Get loader libraries files.
   * @returns `libraries`: Loader libraries files; `files`: all files created by this method or
   * that will be created (including `libraries`).
   */
  async getLoaderLibraries(): Promise<{ libraries: ExtraFile[]; files: File[] }> {
    this.patches = await this.getPatchedManifest()

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

    if (this.installProfile?.libraries) {
      libraries.push(...(await this.formatLibraries(this.installProfile.libraries, 'INSTALL')))
    }

    files.push(...libraries)

    return { libraries, files }
  }

  /**
   * Get authlib-injector file.
   * @returns `injector`: The injector file object; `files`: array containing the injector.
   */
  async getInjector(): Promise<{ injector: File[]; files: File[] }> {
    if (this.config.account.meta.type !== 'yggdrasil') return { injector: [], files: [] }

    const url = 'https://cdn.emlproject.com/authlib-injector/authlib-injector-1.2.8.jar'

    const injector: File[] = [
      {
        name: 'authlib-injector-1.2.8.jar',
        path: 'libraries/moe/yushi/authlibinjector/',
        url: 'https://cdn.emlproject.com/authlib-injector/authlib-injector-1.2.8.jar',
        sha1: '0e0e66d8a4f91a26f33b9c09f5cdffce4a11f0b8',
        size: 349681,
        type: 'LIBRARY'
      }
    ]

    return { injector: injector, files: injector }
  }

  /**
   * Get logging and patch Log4Shell.
   * @returns `logging`: logging files; `files`: all files created by this method or that will be
   * created (including `log4j`).
   */
  async getLogging(): Promise<{ logging: File[]; files: File[] }> {
    const logFile = this.minecraftManifest.logging?.client?.file
    if (!logFile) return { logging: [], files: [] }

    const logging = [
      {
        name: logFile.id,
        path: '',
        url: logFile.url,
        sha1: logFile.sha1,
        size: logFile.size,
        type: 'CONFIG' as const
      }
    ]

    return { logging, files: logging }
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
    const os = utils.getOS_MCCode()

    const promises = libs.map(async (lib) => {
      let artifact = lib.downloads?.artifact
      let native: string | undefined

      let name = utils.getLibraryName(lib.name!)
      let path = utils.getLibraryPath(lib.name!, 'libraries')
      let url = ''
      let sha1 = ''
      let size = 0
      let type: 'LIBRARY' | 'NATIVE' = 'LIBRARY'

      if (loader.loader.toLocaleLowerCase() === 'forge' || loader.loader.toLocaleLowerCase() === 'neoforge') {
        if (lib.natives) {
          type = 'NATIVE'
          native = lib.natives[os]
          if (!native) return null
          const patch = this.checkPatch(lib.name!, 'NATIVE', native)
          if (patch === null) return null
          if (patch !== undefined) artifact = patch
          if (artifact && !artifact.path) name = name.replace('.jar', `-${native}.jar`)
        } else {
          if (!utils.isLibAllowed(lib) || (!lib.serverreq && !lib.clientreq && !lib.url && !lib.downloads)) return null
          const patch = this.checkPatch(lib.name!, 'LIBRARY')
          if (patch === null) return null
          if (patch !== undefined) artifact = patch
        }
      }

      if (artifact) {
        if (artifact.path) {
          name = artifact.path.split('/').pop()!
          path = path_.join('libraries', artifact.path.split('/').slice(0, -1).join('/'), '/')
        }
        url = artifact.url || (lib.url ? (lib.url.endsWith('/') ? lib.url : lib.url + '/') + (artifact.path || '') : '')
        sha1 = artifact.sha1
        size = artifact.size
      } else {
        const info = await this.getLibInfo(lib)
        if (!info) return null
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
    const nameStr = lib.name || ''
    if (nameStr.startsWith('net.minecraftforge:forge:') || nameStr.startsWith('net.neoforged:neoforge:')) {
      return { url: '', size: 0, sha1: '' }
    }

    const loader = this.config.minecraft.loader!

    if (lib.url && (lib.url.endsWith('.jar') || lib.url.endsWith('.zip') || lib.url.endsWith('.lzma'))) {
      try {
        const [size, sha1] = await Promise.all([
          lib.size ?? utils.getRemoteFileSize(lib.url, `Failed to get size for ${lib.name}`),
          lib.sha1 ?? utils.getRemoteFileSha1(lib.url, `Failed to get SHA1 for ${lib.name}`)
        ])
        return { url: lib.url, size, sha1 }
      } catch (err) {
        throw err as Error | EMLLibError
      }
    }

    let mirrors: (string | undefined)[]

    const mirrorUrl = lib.url ? (lib.url.endsWith('/') ? lib.url.slice(0, -1) : lib.url) : undefined
    if (loader.loader === 'forge') {
      mirrors = [
        mirrorUrl,
        'https://libraries.minecraft.net',
        'https://maven.minecraftforge.net',
        'https://files.minecraftforge.net/maven',
        'https://maven.creeperhost.net'
      ]
    } else if (loader.loader === 'neoforge') {
      mirrors = [mirrorUrl, 'https://libraries.minecraft.net', 'https://maven.neoforged.net/releases', 'https://repo1.maven.org/maven2']
    } else if (loader.loader === 'fabric') {
      mirrors = [mirrorUrl, 'https://maven.fabricmc.net']
    } else if (loader.loader === 'quilt') {
      mirrors = [mirrorUrl, 'https://maven.quiltmc.org/repository/release']
    } else {
      mirrors = ['https://libraries.minecraft.net']
    }

    let lastError: Error | null = null
    for (const mirror of mirrors) {
      if (!mirror) continue
      const url = `${mirror}/${utils.getLibraryPath(lib.name!).replaceAll('\\', '/')}${utils.getLibraryName(lib.name!)}`
      try {
        const [size, sha1] = await Promise.all([
          lib.size ?? utils.getRemoteFileSize(url, `Failed to get size for ${lib.name}`),
          lib.sha1 ?? lib.checksums?.[0] ?? utils.getRemoteFileSha1(url, `Failed to get SHA1 for ${lib.name}`)
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

  private async getPatchedManifest() {
    if (this.patches.credits) return this.patches

    try {
      const req = await fetch('https://cdn.emlproject.com/patches/patches.json')

      if (!req.ok) {
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Failed to fetch patched manifest: HTTP ${req.status} ${errorText}`)
      }
      const data = await req.json()

      return data as Record<string, Artifact | null>
    } catch (err: unknown) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.FETCH_ERROR, `Failed to fetch modpack files: ${err instanceof Error ? err.message : err}`)
    }
  }

  private async patchNative(lib: MinecraftManifest['libraries'][number]) {
    const os = utils.getOS_MCCode()
    const classifiers = lib.downloads?.classifiers as any
    const native = lib.natives ? lib.natives[os] : undefined

    let artifact = native && classifiers ? (classifiers[native.replace('${arch}', utils.getArch())] as unknown as Artifact | undefined) : undefined
    const libNameOrPath = lib.name || artifact?.path

    if (libNameOrPath && native) {
      const patch = this.checkPatch(libNameOrPath, 'NATIVE', native)
      if (patch === null) return undefined
      if (patch !== undefined) return patch
    }

    return artifact
  }

  private async patchLibrary(lib: MinecraftManifest['libraries'][number]) {
    let artifact = lib.downloads?.artifact
    const libNameOrPath = lib.name || artifact?.path

    if (libNameOrPath) {
      const patch = this.checkPatch(libNameOrPath, 'LIBRARY')
      if (patch === null) return undefined
      if (patch !== undefined) return patch
    }

    return artifact
  }

  private checkPatch(libNameOrPath: string, type: 'LIBRARY' | 'NATIVE', nativeSuffix?: string): Artifact | null | undefined {
    const os = utils.getOS_MCCode()
    const arch = process.arch
    const { group, name, version } = utils.getPartsFromNameOrPath(libNameOrPath)
    console.log(group, name, version)
    let key =
      type === 'NATIVE'
        ? `${os}:${arch}:${group}:${name}:${version.replace(/-nightly-[^:]+/, '-nightly-*')}:${nativeSuffix}`
        : `${os}:${arch}:${group}:${name}:${version.replace(/-nightly-[^:]+/, '-nightly-*')}`

    if (key in this.patches) return this.patches[key]

    return undefined
  }
}

