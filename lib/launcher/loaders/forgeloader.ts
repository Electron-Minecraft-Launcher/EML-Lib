/**
 * @license MIT
 * @copyright Copyright (c) 2025, GoldFrite
 */

import { FullConfig } from '../../../types/config'
import { ExtraFile, File, ILoader } from '../../../types/file'
import { Artifact, MinecraftManifest } from '../../../types/manifest'
import AdmZip from 'adm-zip'
import fs from 'node:fs'
import path_ from 'node:path'
import utils from '../../utils/utils'
import EventEmitter from '../../utils/events'
import { FilesManagerEvents } from '../../../types/events'

export default class ForgeLoader extends EventEmitter<FilesManagerEvents> {
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
   * Setup Forge loader.
   * @returns `loaderManifest`: Loader manifest; `installProfile`: Install profile; `libraries`: libraries
   * to download; `files`: all files created by this method or that will be created (including `libraries`)
   */
  async setup() {
    const forgePath = path_.join(this.config.root, this.loader.file.path)
    const minecraftPath = path_.join(this.config.root, 'versions', this.manifest.id)
    const zip = new AdmZip(path_.join(forgePath, this.loader.file.name))
    const jar = new AdmZip(path_.join(minecraftPath, `${this.manifest.id}.jar`))

    if (!fs.existsSync(forgePath)) fs.mkdirSync(forgePath, { recursive: true })

    return this.loader.format !== 'INSTALLER' ? this.extractZip(forgePath, minecraftPath, zip, jar) : await this.extractJar(forgePath, zip)
  }

  private extractZip(forgePath: string, minecraftPath: string, zip: AdmZip, jar: AdmZip) {
    let files: File[] = []
    let i = 0

    jar.deleteFile('META-INF/')

    zip.getEntries().forEach((entry) => {
      if (!entry.isDirectory) jar.addFile(entry.entryName, entry.getData())
      i++
      this.emit('extract_progress', { filename: path_.basename(entry.entryName) })
    })

    jar.writeZip(path_.join(minecraftPath, `${this.manifest.id}.jar`))

    const forgeManifest = { ...this.manifest, id: `forge-${this.loader.loaderVersion}`, libraries: [] }

    files.push({ name: `${forgeManifest.id}.json`, path: this.loader.file!.path, url: '', type: 'OTHER' })
    fs.writeFileSync(path_.join(forgePath, `${forgeManifest.id}.json`), JSON.stringify(forgeManifest, null, 2))

    this.emit('extract_end', { amount: i })

    return { loaderManifest: forgeManifest, installProfile: null, libraries: [], files: files }
  }

  private async extractJar(forgePath: string, zip: AdmZip) {
    let files: File[] = []
    let libraries: ExtraFile[] = []
    let i = 0

    //* Extract install profile
    let installProfile = JSON.parse(zip.getEntry('install_profile.json')?.getData().toString('utf8') + '')
    let forgeManifest: MinecraftManifest

    if (installProfile.install) {
      forgeManifest = installProfile.versionInfo
      installProfile = installProfile.install
    } else {
      forgeManifest = JSON.parse(zip.getEntry(path_.basename(installProfile.json))?.getData().toString('utf8') + '')
    }

    fs.writeFileSync(path_.join(forgePath, `forge-${this.loader.loaderVersion}.json`), JSON.stringify(forgeManifest, null, 2))
    files.push({ name: `forge-${this.loader.loaderVersion}.json`, path: this.loader.file!.path, url: '', type: 'OTHER' })
    i++
    this.emit('extract_progress', { filename: 'install_profile.json' })

    //* Extract universal
    if (installProfile.filePath) {
      const universalName = utils.getLibraryName(installProfile.path)
      const universalPath = utils.getLibraryPath(installProfile.path)
      const universalExtractPath = path_.join(this.config.root, 'libraries', universalPath)
      if (!fs.existsSync(universalExtractPath)) fs.mkdirSync(universalExtractPath, { recursive: true })
      fs.writeFileSync(path_.join(universalExtractPath, universalName), zip.getEntry(installProfile.filePath)!.getData())
      libraries.push({ name: universalName, path: path_.join('libraries', universalPath), url: '', type: 'LIBRARY', extra: 'INSTALL' })
      i++
      this.emit('extract_progress', { filename: installProfile.filePath })
    } else if (installProfile.path) {
      const universalPath = utils.getLibraryPath(installProfile.path)
      const universalExtractPath = path_.join(this.config.root, 'libraries', universalPath)
      if (!fs.existsSync(universalExtractPath)) fs.mkdirSync(universalExtractPath, { recursive: true })
      zip
        .getEntries()
        .filter((entry) => path_.join(entry.entryName).includes(path_.join('maven', universalPath)))
        .forEach((entry) => {
          if (!entry.entryName.endsWith('.jar')) return
          fs.writeFileSync(path_.join(universalExtractPath, path_.basename(entry.entryName)), entry.getData())
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
    }

    if (installProfile.processors && installProfile.processors.length > 0) {
      const universalMaven = installProfile.libraries.find((lib: any) => (lib.name + '').startsWith('net.minecraftforge:forge:'))
      const clientDataName = utils.getLibraryName(installProfile.path || universalMaven.name).replace('.jar', '-clientdata.lzma')
      const clientDataPath = utils.getLibraryPath(installProfile.path || universalMaven.name)
      const clientDataExtractPath = path_.join(this.config.root, 'libraries', clientDataPath)
      const clientData = zip.getEntry('data/client.lzma')!.getData()

      if (!fs.existsSync(clientDataExtractPath)) fs.mkdirSync(clientDataExtractPath, { recursive: true })
      fs.writeFileSync(path_.join(clientDataExtractPath, clientDataName), clientData)
      files.push({ name: clientDataName, path: path_.join('libraries', clientDataPath), url: '', type: 'LIBRARY' })
      i++
      this.emit('extract_progress', { filename: clientDataName })
    }

    //* Get libraries
    libraries.push(...(await this.formatLibraries(forgeManifest.libraries, 'LOADER', installProfile)))
    if (installProfile.libraries) libraries.push(...(await this.formatLibraries(installProfile.libraries, 'INSTALL', installProfile)))

    files.push(...libraries)

    this.emit('extract_end', { amount: i })

    return { loaderManifest: forgeManifest, installProfile: installProfile, libraries: libraries, files: files }
  }

  private async getMirrorUrl(lib: any) {
    const mirrors = lib.url ? [lib.url] : ['https://libraries.minecraft.net', 'https://maven.minecraftforge.net/', 'https://maven.creeperhost.net/']

    for (const mirror of mirrors) {
      const url = `${mirror}${utils.getLibraryPath(lib.name!).replaceAll('\\', '/')}${utils.getLibraryName(lib.name!)}`
      const res1 = await fetch(url)
        .then((res) => (res.headers.get('Content-Length') || 0) as number)
        .catch(() => false as false)

      if (!res1) continue

      const res2 = await fetch(`${url}.sha1`)
        .then((res) => res.text())
        .catch(() => false as false)

      if (!res2) continue

      return { url: url, size: +res1, sha1: res2 }
    }

    return { url: '', size: 0, sha1: '' }
  }

  private async formatLibraries(libs: MinecraftManifest['libraries'], extra: 'INSTALL' | 'LOADER', installProfile: any) {
    let libraries: ExtraFile[] = []

    for (const lib of libs) {
      let type: 'LIBRARY' | 'NATIVE'
      let artifact: Artifact | undefined
      let native: string | undefined

      if (lib.natives) {
        native = lib.natives[utils.getOS_MCCode()]
        if (!native) continue
        type = 'NATIVE'
      } else {
        if (!utils.isLibAllowed(lib) || (!lib.serverreq && !lib.clientreq && !lib.url && !lib.downloads)) continue
        type = 'LIBRARY'
      }

      artifact = lib.downloads?.artifact

      let name: string = ''
      let path: string = ''

      if (artifact) {
        if (artifact.path) {
          name = artifact.path.split('/').pop()!
          path = path_.join('libraries', artifact.path.split('/').slice(0, -1).join('/'), '/')
        } else {
          name = utils.getLibraryName(lib.name!)
          if (type === 'NATIVE') name = name.replace('.jar', `-${native}.jar`)
          path = utils.getLibraryPath(lib.name!, 'libraries')
        }
      } else {
        artifact = await this.getMirrorUrl(lib)
        name = utils.getLibraryName(lib.name!)
        if (type === 'NATIVE') name = name.replace('.jar', `-${native}.jar`)
        path = utils.getLibraryPath(lib.name!, 'libraries')
      }

      libraries.push({
        name: name,
        path: path,
        url: artifact.url,
        sha1: artifact.sha1,
        size: artifact.size,
        type: type,
        extra: extra
      })
    }

    return libraries
  }
}
