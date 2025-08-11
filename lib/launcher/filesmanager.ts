/**
 * @license MIT
 * @copyright Copyright (c) 2024, GoldFrite
 * @copyright Copyright (c) 2019, Pierce Harriz, from [Minecraft Launcher Core](https://github.com/Pierce01/MinecraftLauncher-core)
 */

import { FullConfig } from '../../types/config'
import { EMLLibError, ErrorType } from '../../types/errors'
import { ExtraFile, File, ILoader } from '../../types/file'
import { Artifact, MinecraftManifest, Assets } from '../../types/manifest'
import utils from '../utils/utils'
import path_ from 'path'
import fs from 'fs'
import AdmZip from 'adm-zip'
import EventEmitter from '../utils/events'
import { FilesManagerEvents } from '../../types/events'
import Java from '../java/java'

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
  async getJava() {
    if (this.config.java.install === 'auto') {
      const java = await new Java(this.manifest.id, this.config.serverId).getFiles(this.manifest)
      return { java: java, files: java }
    } else {
      return { java: [], files: [] }
    }
  }

  /**
   * Get modpack files.
   * @returns `modpack`: Modpack files; `files`: all files created by this method or that will be
   * created (including `modpack`).
   */
  async getModpack() {
    if (!this.config.url) return { modpack: [], files: [] }

    const modpack = await fetch(`${this.config.url}/api/files-updater`)
      .then((res) => res.json())
      .then((res) => res.data.files as File[])
      .catch((err) => {
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Failed to fetch modpack files: ${err}`)
      })

    return { modpack: modpack, files: modpack }
  }

  /**
   * Get libraries files.
   * @returns `libraries`: Libraries files; `files`: all files created by this method or that will
   * be created (including `libraries`).
   */
  async getLibraries() {
    let files: File[] = []
    let libraries: ExtraFile[] = []

    if (!fs.existsSync(path_.join(this.config.root, 'versions', this.manifest.id))) {
      fs.mkdirSync(path_.join(this.config.root, 'versions', this.manifest.id), { recursive: true })
    }

    files.push({ name: `${this.manifest.id}.json`, path: path_.join('versions', this.manifest.id, '/'), url: '', type: 'OTHER' })
    fs.writeFileSync(path_.join(this.config.root, 'versions', this.manifest.id, `${this.manifest.id}.json`), JSON.stringify(this.manifest, null, 2))

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
  async getAssets() {
    let files: File[] = []
    let assets: File[] = []

    const res = await fetch(this.manifest.assetIndex.url)
      .then((res) => res.json() as Promise<Assets>)
      .catch((err) => {
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Failed to fetch assets: ${err}`)
      })

    if (!fs.existsSync(path_.join(this.config.root, 'assets', 'indexes'))) {
      fs.mkdirSync(path_.join(this.config.root, 'assets', 'indexes'), { recursive: true })
    }

    files.push({ name: `${this.manifest.assets}.json`, path: path_.join('assets', 'indexes', '/'), url: '', type: 'OTHER' })
    fs.writeFileSync(path_.join(this.config.root, 'assets', 'indexes', `${this.manifest.assets}.json`), JSON.stringify(res, null, 2))

    Object.values(res.objects).forEach((asset) => {
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
  }

  /**
   * Get Log4j files to patch the Log4shell.
   * @returns `log4j`: Log4j files; `files`: all files created by this method or that will be
   * created (including `log4j`).
   * @see [help.minecraft.net](https://help.minecraft.net/hc/en-us/articles/4416199399693-Security-Vulnerability-in-Minecraft-Java-Edition)
   */
  async getLog4j() {
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
  extractNatives(libraries: File[]) {
    const natives = libraries.filter((lib) => lib.type === 'NATIVE')
    const nativesFolder = path_.join(this.config.root, 'bin', 'natives')
    let files: File[] = []

    if (!fs.existsSync(nativesFolder)) {
      fs.mkdirSync(nativesFolder, { recursive: true })
    }

    natives.forEach((native) => {
      if (!fs.existsSync(path_.join(this.config.root, native.path, native.name))) return
      const zip = new AdmZip(path_.join(this.config.root, native.path, native.name))
      zip.getEntries().forEach((entry) => {
        if (!entry.entryName.startsWith('META-INF')) {
          if (entry.isDirectory) {
            fs.mkdirSync(path_.join(nativesFolder, entry.entryName), { recursive: true })
          } else {
            fs.writeFileSync(path_.join(nativesFolder, entry.entryName), zip.readFile(entry)!)
          }

          files.push({
            name: path_.basename(entry.entryName),
            path: path_.join('bin', 'natives', path_.dirname(entry.entryName), '/'),
            url: '',
            sha1: '',
            size: entry.header.size,
            type: entry.isDirectory ? 'FOLDER' : 'NATIVE'
          })
        }
      })

      this.emit('extract_progress', { filename: native.name })
    })

    this.emit('extract_end', { amount: files.length })

    return { files }
  }

  /**
   * Copy assets from the assets folder to the resources folder.
   * @returns `files`: all files created by this method.
   */
  copyAssets() {
    let files: File[] = []

    if (this.manifest.assets === 'legacy' || this.manifest.assets === 'pre-1.6') {
      if (fs.existsSync(path_.join(this.config.root, 'assets', 'legacy'))) {
        this.emit('copy_debug', "The 'assets/legacy' directory is no longer used. You can safely remove it from your server's root directory.")
      }

      const assets = JSON.parse(fs.readFileSync(path_.join(this.config.root, 'assets', 'indexes', `${this.manifest.assets}.json`), 'utf-8')) as Assets

      Object.entries(assets.objects).forEach(([path, { hash, size }]) => {
        const assetLegacyPath = path_.join('resources', path_.dirname(path))
        const assetLegacyName = path_.basename(path)

        if (!fs.existsSync(path_.join(this.config.root, assetLegacyPath))) {
          fs.mkdirSync(path_.join(this.config.root, assetLegacyPath), { recursive: true })
        }

        if (!fs.existsSync(path_.join(assetLegacyPath, assetLegacyName))) {
          fs.copyFileSync(
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
    }

    this.emit('copy_end', { amount: files.length })
    return { files }
  }
}
