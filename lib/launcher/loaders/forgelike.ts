/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 */

import { FullConfig } from '../../../types/config'
import { ExtraFile, File, ILoader } from '../../../types/file'
import { MinecraftManifest } from '../../../types/manifest'
import AdmZip from 'adm-zip'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path_ from 'node:path'
import utils from '../../utils/utils'
import EventEmitter from '../../utils/events'
import { FilesManagerEvents } from '../../../types/events'

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
  async setup() {
    const loaderPath = path_.join(this.config.root, this.loader.file.path)
    const minecraftPath = path_.join(this.config.root, 'versions', this.manifest.id)
    const zip = new AdmZip(path_.join(loaderPath, this.loader.file.name))
    const jar = new AdmZip(path_.join(minecraftPath, `${this.manifest.id}.jar`))

    if (!existsSync(loaderPath)) {
      await fs.mkdir(loaderPath, { recursive: true })
    }

    return this.loader.format !== 'INSTALLER' ? await this.extractZip(loaderPath, minecraftPath, zip, jar) : await this.extractJar(loaderPath, zip)
  }

  private async extractZip(loaderPath: string, minecraftPath: string, zip: AdmZip, jar: AdmZip) {
    const loaderId = this.loader.type.toLowerCase()

    let files: File[] = []
    let i = 0

    jar.deleteFile('META-INF/')

    zip.getEntries().forEach((entry) => {
      if (!entry.isDirectory) jar.addFile(entry.entryName, entry.getData())
      i++
      this.emit('extract_progress', { filename: path_.basename(entry.entryName) })
    })

    await new Promise<void>((resolve, reject) => {
      jar.writeZip(path_.join(minecraftPath, `${this.manifest.id}.jar`), (err) => {
        if (err) return reject(err)
        resolve()
      })
    })

    const loaderManifest = { ...this.manifest, id: `${loaderId}-${this.loader.loaderVersion}`, libraries: [] }

    files.push({ name: `${loaderManifest.id}.json`, path: this.loader.file!.path, url: '', type: 'OTHER' })
    await fs.writeFile(path_.join(loaderPath, `${loaderManifest.id}.json`), JSON.stringify(loaderManifest, null, 2))

    this.emit('extract_end', { amount: i })

    return { loaderManifest: loaderManifest, installProfile: null, libraries: [], files: files }
  }

  private async extractJar(loaderPath: string, zip: AdmZip) {
    const loaderId = this.loader.type.toLowerCase()

    let files: File[] = []
    let libraries: ExtraFile[] = []
    let i = 0

    //* Extract install profile
    let installProfileEntry = zip.getEntry('install_profile.json')
    let installProfile = JSON.parse(installProfileEntry?.getData().toString('utf8') + '')
    let loaderManifest: MinecraftManifest

    if (installProfile.install) {
      loaderManifest = installProfile.versionInfo
      installProfile = installProfile.install
    } else {
      const jsonEntry = zip.getEntry(path_.basename(installProfile.json))
      loaderManifest = JSON.parse(jsonEntry?.getData().toString('utf8') + '')
    }

    const jsonName = `${loaderId}-${this.loader.loaderVersion}.json`
    
    await fs.writeFile(path_.join(loaderPath, jsonName), JSON.stringify(loaderManifest, null, 2))
    files.push({ name: jsonName, path: this.loader.file!.path, url: '', type: 'OTHER' })

    i++
    this.emit('extract_progress', { filename: 'install_profile.json' })

    //* Extract universal
    if (installProfile.filePath) {
      const universalName = utils.getLibraryName(installProfile.path)
      const universalPath = utils.getLibraryPath(installProfile.path)
      const universalExtractPath = path_.join(this.config.root, 'libraries', universalPath)

      if (!existsSync(universalExtractPath)) await fs.mkdir(universalExtractPath, { recursive: true })

      const zipEntry = zip.getEntry(installProfile.filePath)
      await fs.writeFile(path_.join(universalExtractPath, universalName), zipEntry!.getData())

      libraries.push({ name: universalName, path: path_.join('libraries', universalPath), url: '', type: 'LIBRARY', extra: 'INSTALL' })
      i++
      this.emit('extract_progress', { filename: installProfile.filePath })
    } else if (installProfile.path) {
      const universalPath = utils.getLibraryPath(installProfile.path)
      const universalExtractPath = path_.join(this.config.root, 'libraries', universalPath)

      if (!existsSync(universalExtractPath)) await fs.mkdir(universalExtractPath, { recursive: true })

      const entriesToExtract = zip
        .getEntries()
        .filter((entry) => path_.join(entry.entryName).includes(path_.join('maven', universalPath)) && entry.entryName.endsWith('.jar'))

      const promises = entriesToExtract.map(async (entry) => {
        if (!entry.entryName.endsWith('.jar')) return
        await fs.writeFile(path_.join(universalExtractPath, path_.basename(entry.entryName)), entry.getData())
        libraries.push({
          name: path_.basename(entry.entryName),
          path: path_.join('libraries', universalPath),
          url: '',
          type: 'LIBRARY',
          extra: 'INSTALL'
        })
        i++
        this.emit('extract_progress', { filename: path_.basename(entry.entryName) })
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
      const clientDataEntry = zip.getEntry('data/client.lzma')

      if (clientDataEntry) {
        if (!existsSync(clientDataExtractPath)) await fs.mkdir(clientDataExtractPath, { recursive: true })
        await fs.writeFile(path_.join(clientDataExtractPath, clientDataName), clientDataEntry.getData())
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

    //* Get libraries
    const [libsLoader, libsInstall] = await Promise.all([
      this.formatLibraries(loaderManifest.libraries, 'LOADER', installProfile),
      installProfile.libraries ? this.formatLibraries(installProfile.libraries, 'INSTALL', installProfile) : Promise.resolve([])
    ])

    libraries.push(...libsLoader)
    libraries.push(...libsInstall)
    files.push(...libraries)

    this.emit('extract_end', { amount: i })

    return { loaderManifest: loaderManifest, installProfile: installProfile, libraries: libraries, files: files }
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
}
