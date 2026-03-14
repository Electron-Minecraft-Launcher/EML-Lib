/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 */

import { FullConfig } from '../../../types/config.js'
import { ExtraFile, File, ILoader } from '../../../types/file.js'
import { MinecraftManifest } from '../../../types/manifest.js'
import yauzl from 'yauzl'
import yazl from 'yazl'
import { createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path_ from 'node:path'
import utils from '../../utils/utils.js'
import EventEmitter from '../../utils/events.js'
import { FilesManagerEvents } from '../../../types/events.js'
import { EMLLibError, ErrorType } from '../../../types/errors.js'

export default class ForgeLikeLoader extends EventEmitter<FilesManagerEvents> {
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
   * Setup Forge or NeoForge loader.
   * @returns `loaderManifest`: Loader manifest; `installProfile`: Install profile; `libraries`: libraries
   * to download; `files`: all files created by this method or that will be created (including `libraries`)
   */
  async setup(): Promise<{
    loaderManifest: MinecraftManifest | null
    installProfile: any
    libraries: ExtraFile[]
    files: File[]
  }> {
    try {
      const loaderPath = path_.join(this.config.root, this.loader.file.path)
      const minecraftPath = path_.join(this.config.root, 'versions', this.manifest.id)

      if (!existsSync(loaderPath)) {
        await fs.mkdir(loaderPath, { recursive: true })
      }

      return this.loader.format !== 'INSTALLER' ? await this.extractZip(loaderPath, minecraftPath) : await this.extractJar(loaderPath)
    } catch (err) {
      throw new EMLLibError(ErrorType.FILE_ERROR, `Failed to setup ForgeLike loader: ${err instanceof Error ? err.message : err}`)
    }
  }

  private async extractZip(loaderPath: string, minecraftPath: string) {
    const loaderId = this.loader.type.toLowerCase()
    const forgeZipPath = path_.join(loaderPath, this.loader.file.name)
    const vanillaJarPath = path_.join(minecraftPath, `${this.manifest.id}.jar`)
    const patchedJarPath = path_.join(minecraftPath, `${this.manifest.id}-patched.jar`)

    let files: File[] = []
    let i = 0

    const { zipfile: vanillaZip, entries: vanillaEntries } = await this.openZip(vanillaJarPath)
    const { zipfile: forgeZip, entries: forgeEntries } = await this.openZip(forgeZipPath)

    try {
      const yazlZip = new yazl.ZipFile()
      const writeStream = createWriteStream(patchedJarPath)
      const forgeFileNames = new Set(forgeEntries.map((e) => e.fileName))

      yazlZip.outputStream.pipe(writeStream)

      for (const entry of vanillaEntries) {
        if (entry.fileName.startsWith('META-INF/')) continue
        if (entry.fileName.endsWith('/')) continue
        if (forgeFileNames.has(entry.fileName)) continue
        await this.pipeEntryToYazl(vanillaZip, entry, yazlZip)
      }

      for (const entry of forgeEntries) {
        if (entry.fileName.endsWith('/')) continue
        await this.pipeEntryToYazl(forgeZip, entry, yazlZip)
        i++
        this.emit('extract_progress', { filename: path_.basename(entry.fileName) })
      }

      yazlZip.end()

      await new Promise<void>((resolve, reject) => {
        writeStream.on('close', resolve)
        writeStream.on('error', reject)
      })

      await fs.unlink(vanillaJarPath)
      await fs.rename(patchedJarPath, vanillaJarPath)

      const loaderManifest = { ...this.manifest, id: `${loaderId}-${this.loader.loaderVersion}`, libraries: [] }

      files.push({ name: `${loaderManifest.id}.json`, path: this.loader.file!.path, url: '', type: 'OTHER' })
      await fs.writeFile(path_.join(loaderPath, `${loaderManifest.id}.json`), JSON.stringify(loaderManifest, null, 2))

      this.emit('extract_end', { amount: i })

      return { loaderManifest, installProfile: null, libraries: [], files }
    } finally {
      vanillaZip.close()
      forgeZip.close()
    }
  }

  private async extractJar(loaderPath: string) {
    const loaderId = this.loader.type.toLowerCase()
    const forgeZipPath = path_.join(loaderPath, this.loader.file.name)

    let files: File[] = []
    let libraries: ExtraFile[] = []
    let i = 0

    const { zipfile, entries } = await this.openZip(forgeZipPath)

    try {
      const installProfileEntry = entries.find((e) => e.fileName === 'install_profile.json')
      if (!installProfileEntry) throw new Error('install_profile.json not found in loader installer')

      const installProfileBuf = await this.readEntryData(zipfile, installProfileEntry)
      let installProfile = JSON.parse(installProfileBuf.toString('utf8'))
      let loaderManifest: MinecraftManifest

      if (installProfile.install) {
        loaderManifest = installProfile.versionInfo
        installProfile = installProfile.install
      } else {
        const jsonEntryName = path_.basename(installProfile.json)
        const jsonEntry = entries.find((e) => e.fileName === jsonEntryName)
        if (!jsonEntry) throw new Error(`${jsonEntryName} not found in loader installer`)
        const manifestBuf = await this.readEntryData(zipfile, jsonEntry)
        loaderManifest = JSON.parse(manifestBuf.toString('utf8'))
      }

      const jsonName = `${loaderId}-${this.loader.loaderVersion}.json`
      await fs.writeFile(path_.join(loaderPath, jsonName), JSON.stringify(loaderManifest, null, 2))
      files.push({ name: jsonName, path: this.loader.file!.path, url: '', type: 'OTHER' })

      i++
      this.emit('extract_progress', { filename: 'install_profile.json' })

      if (installProfile.filePath) {
        const universalName = utils.getLibraryName(installProfile.path)
        const universalPath = utils.getLibraryPath(installProfile.path)
        const universalExtractPath = path_.join(this.config.root, 'libraries', universalPath)

        if (!existsSync(universalExtractPath)) await fs.mkdir(universalExtractPath, { recursive: true })

        const universalEntry = entries.find((e) => e.fileName === installProfile.filePath)
        if (universalEntry) {
          await this.extractEntryToFile(zipfile, universalEntry, path_.join(universalExtractPath, universalName))
          libraries.push({ name: universalName, path: path_.join('libraries', universalPath), url: '', type: 'LIBRARY', extra: 'INSTALL' })
          i++
          this.emit('extract_progress', { filename: installProfile.filePath })
        }
      } else if (installProfile.path) {
        const universalPath = utils.getLibraryPath(installProfile.path)
        const universalExtractPath = path_.join(this.config.root, 'libraries', universalPath)

        if (!existsSync(universalExtractPath)) await fs.mkdir(universalExtractPath, { recursive: true })

        const mavenPath = path_.join('maven', universalPath).replace(/\\/g, '/')
        const entriesToExtract = entries.filter((e) => e.fileName.includes(mavenPath) && e.fileName.endsWith('.jar'))

        const promises = entriesToExtract.map(async (entry) => {
          await this.extractEntryToFile(zipfile, entry, path_.join(universalExtractPath, path_.basename(entry.fileName)))
          libraries.push({
            name: path_.basename(entry.fileName),
            path: path_.join('libraries', universalPath),
            url: '',
            type: 'LIBRARY',
            extra: 'INSTALL'
          })
          i++
          this.emit('extract_progress', { filename: path_.basename(entry.fileName) })
        })

        await Promise.all(promises)
      }

      if (installProfile.processors && installProfile.processors.length > 0) {
        const universalMaven = installProfile.libraries.find(
          (lib: any) => (lib.name + '').startsWith('net.minecraftforge:forge:') || (lib.name + '').startsWith('net.neoforged:neoforge:')
        )

        const clientDataName = utils.getLibraryName(installProfile.path ?? universalMaven.name).replace('.jar', '-clientdata.lzma')
        const clientDataPath = utils.getLibraryPath(installProfile.path ?? universalMaven.name)
        const clientDataExtractPath = path_.join(this.config.root, 'libraries', clientDataPath)

        const clientDataEntry = entries.find((e) => e.fileName === 'data/client.lzma')

        if (clientDataEntry) {
          if (!existsSync(clientDataExtractPath)) await fs.mkdir(clientDataExtractPath, { recursive: true })
          await this.extractEntryToFile(zipfile, clientDataEntry, path_.join(clientDataExtractPath, clientDataName))
          files.push({ name: clientDataName, path: path_.join('libraries', clientDataPath), url: '', type: 'LIBRARY' })
          i++
          this.emit('extract_progress', { filename: clientDataName })
        }
      }

      if (installProfile.data?.PATCHED) {
        const entry = installProfile.data.PATCHED
        const rawValue = entry.client || entry.path || (typeof entry === 'string' ? entry : '')

        if (rawValue && rawValue.startsWith('[')) {
          const cleanLib = rawValue.replace('[', '').replace(']', '')
          const patchName = utils.getLibraryName(cleanLib)
          const patchPath = utils.getLibraryPath(cleanLib)

          libraries.push({
            name: patchName,
            path: path_.join('libraries', patchPath),
            url: '',
            sha1: '',
            size: 0,
            type: 'LIBRARY',
            extra: 'INSTALL'
          })
        }
      }

      const [libsLoader, libsInstall] = await Promise.all([
        this.formatLibraries(loaderManifest.libraries, 'LOADER', installProfile),
        installProfile.libraries ? this.formatLibraries(installProfile.libraries, 'INSTALL', installProfile) : Promise.resolve([])
      ])

      libraries.push(...libsLoader)
      libraries.push(...libsInstall)
      files.push(...libraries)

      this.emit('extract_end', { amount: i })

      return { loaderManifest, installProfile, libraries, files }
    } finally {
      zipfile.close()
    }
  }

  private async getMirrorUrl(lib: any) {
    const mirrors = lib.url
      ? [lib.url]
      : [
          'https://libraries.minecraft.net',
          'https://maven.minecraftforge.net/',
          'https://maven.neoforged.net/releases/',
          'https://maven.creeperhost.net/'
        ]

    for (const mirror of mirrors) {
      const url = `${mirror}${utils.getLibraryPath(lib.name!).replaceAll('\\', '/')}${utils.getLibraryName(lib.name!)}`
      try {
        const sizeReq = await fetch(url, { method: 'HEAD' })
        if (!sizeReq.ok) continue
        const size = parseInt(sizeReq.headers.get('Content-Length') ?? '0', 10)
        const sha1Req = await fetch(`${url}.sha1`)
        if (!sha1Req.ok) continue
        const sha1 = await sha1Req.text()
        return { url: url, size: size, sha1: sha1 }
      } catch {
        continue
      }
    }
    return { url: '', size: 0, sha1: '' }
  }

  private async formatLibraries(libs: MinecraftManifest['libraries'], extra: 'INSTALL' | 'LOADER', installProfile: any) {
    const promises = libs.map(async (lib) => {
      let type: 'LIBRARY' | 'NATIVE' = 'LIBRARY'
      let native: string | undefined

      if (lib.natives) {
        native = lib.natives[utils.getOS_MCCode()]
        if (!native) return null
        type = 'NATIVE'
      } else {
        if (!utils.isLibAllowed(lib) || (!lib.serverreq && !lib.clientreq && !lib.url && !lib.downloads)) return null
      }

      let artifact = lib.downloads?.artifact
      let name = ''
      let path = ''
      let url = ''
      let sha1 = ''
      let size = 0

      if (artifact) {
        if (artifact.path) {
          name = artifact.path.split('/').pop()!
          path = path_.join('libraries', artifact.path.split('/').slice(0, -1).join('/'), '/')
        } else {
          name = utils.getLibraryName(lib.name!)
          if (type === 'NATIVE') name = name.replace('.jar', `-${native}.jar`)
          path = utils.getLibraryPath(lib.name!, 'libraries')
        }
        url = artifact.url
        sha1 = artifact.sha1
        size = artifact.size
      } else {
        const mirror = await this.getMirrorUrl(lib)
        name = utils.getLibraryName(lib.name!)
        if (type === 'NATIVE') name = name.replace('.jar', `-${native}.jar`)
        path = utils.getLibraryPath(lib.name!, 'libraries')
        url = mirror.url
        sha1 = mirror.sha1
        size = mirror.size
      }

      return { name, path, url, sha1, size, type, extra } as ExtraFile
    })

    const results = await Promise.all(promises)
    return results.filter((lib): lib is ExtraFile => lib !== null)
  }

  private openZip(zipPath: string): Promise<{ zipfile: yauzl.ZipFile; entries: yauzl.Entry[] }> {
    return new Promise((resolve, reject) => {
      yauzl.open(zipPath, { lazyEntries: false, autoClose: false }, (err, zipfile) => {
        if (err || !zipfile) {
          return reject(err ?? new EMLLibError(ErrorType.FILE_ERROR, `Failed to open ${zipPath}`))
        }
        const entries: yauzl.Entry[] = []
        zipfile.on('entry', (entry) => entries.push(entry))
        zipfile.on('end', () => resolve({ zipfile, entries }))
        zipfile.on('error', reject)
      })
    })
  }

  private readEntryData(zipfile: yauzl.ZipFile, entry: yauzl.Entry): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zipfile.openReadStream(entry, (err, readStream) => {
        if (err || !readStream) {
          return reject(err ?? new EMLLibError(ErrorType.FILE_ERROR, `Failed to open read stream for ${entry.fileName}`))
        }
        const chunks: Buffer[] = []
        readStream.on('data', (chunk) => chunks.push(chunk))
        readStream.on('end', () => resolve(Buffer.concat(chunks)))
        readStream.on('error', reject)
      })
    })
  }

  private extractEntryToFile(zipfile: yauzl.ZipFile, entry: yauzl.Entry, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      zipfile.openReadStream(entry, (err, readStream) => {
        if (err || !readStream) {
          return reject(err ?? new EMLLibError(ErrorType.FILE_ERROR, `Failed to open read stream for ${entry.fileName}`))
        }
        const writeStream = createWriteStream(destPath)
        readStream.pipe(writeStream)

        writeStream.on('close', resolve)
        writeStream.on('error', reject)
        readStream.on('error', reject)
      })
    })
  }

  private pipeEntryToYazl(sourceZip: yauzl.ZipFile, entry: yauzl.Entry, destZip: yazl.ZipFile): Promise<void> {
    return new Promise((resolve, reject) => {
      sourceZip.openReadStream(entry, (err, readStream) => {
        if (err || !readStream) {
          return reject(err ?? new EMLLibError(ErrorType.FILE_ERROR, `Failed to open read stream for ${entry.fileName}`))
        }
        destZip.addReadStream(readStream, entry.fileName)
        readStream.on('end', resolve)
        readStream.on('error', reject)
      })
    })
  }
}

