/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 */

import { ResolvedConfig } from '../../types/config.js'
import { ExtraFile, File, FormatFile } from '../../types/file.js'
import { MinecraftManifest } from '../../types/manifest.js'
import yazl from 'yazl'
import { createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path_ from 'node:path'
import utils from '../utils/utils.js'
import EventEmitter from '../utils/events.js'
import { FilesManagerEvents } from '../../types/events.js'

export default class ForgeLikeLoader extends EventEmitter<FilesManagerEvents> {
  private readonly config: ResolvedConfig
  private readonly minecraftManifest: MinecraftManifest
  private readonly loaderManifest: MinecraftManifest
  private readonly installProfile: any
  private readonly installer: FormatFile

  constructor(
    config: ResolvedConfig,
    minecraftManifest: MinecraftManifest,
    loaderManifest: MinecraftManifest,
    installProfile: any,
    installer: FormatFile
  ) {
    super()
    this.config = config
    this.minecraftManifest = minecraftManifest
    this.loaderManifest = loaderManifest
    this.installProfile = installProfile
    this.installer = installer
  }

  async extractZip(): Promise<{ libraries: ExtraFile[]; files: File[] }> {
    const forgeZipPath = path_.join(this.config.root, this.installer.path, this.installer.name)
    const vanillaJarPath = path_.join(this.config.root, 'versions', this.minecraftManifest.id, `${this.minecraftManifest.id}.jar`)
    const patchedJarPath = path_.join(this.config.root, 'versions', `${this.minecraftManifest.id}-patched.jar`)

    let i = 0

    const { zipfile: vanillaZip, entries: vanillaEntries } = await utils.openZip(vanillaJarPath)
    const { zipfile: forgeZip, entries: forgeEntries } = await utils.openZip(forgeZipPath)

    try {
      const yazlZip = new yazl.ZipFile()
      const writeStream = createWriteStream(patchedJarPath)
      const forgeFileNames = new Set(forgeEntries.map((e) => e.fileName))

      yazlZip.outputStream.pipe(writeStream)

      for (const entry of vanillaEntries) {
        if (entry.fileName.startsWith('META-INF/') || entry.fileName.endsWith('/') || forgeFileNames.has(entry.fileName)) continue
        await utils.pipeEntryToYazl(vanillaZip, entry, yazlZip)
      }

      for (const entry of forgeEntries) {
        if (entry.fileName.endsWith('/')) continue
        await utils.pipeEntryToYazl(forgeZip, entry, yazlZip)
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

      this.emit('extract_end', { amount: i })

      return { libraries: [], files: [] }
    } finally {
      vanillaZip.close()
      forgeZip.close()
    }
  }

  async extractJar(): Promise<{ libraries: ExtraFile[]; files: File[] }> {
    const forgeZipPath = path_.join(this.config.root, this.installer.path, this.installer.name)

    let files: File[] = []
    let libraries: ExtraFile[] = []
    let i = 0

    const { zipfile, entries } = await utils.openZip(forgeZipPath)

    try {
      if (this.installProfile.filePath) {
        const universalName = utils.getLibraryName(this.installProfile.path)
        const universalPath = utils.getLibraryPath(this.installProfile.path)
        const universalExtractPath = path_.join(this.config.root, 'libraries', universalPath)

        if (!existsSync(universalExtractPath)) await fs.mkdir(universalExtractPath, { recursive: true })

        const universalEntry = entries.find((e) => e.fileName === this.installProfile.filePath)
        if (universalEntry) {
          await utils.extractEntryToFile(zipfile, universalEntry, path_.join(universalExtractPath, universalName))
          libraries.push({
            name: universalName,
            path: path_.join('libraries', universalPath),
            url: '',
            type: 'LIBRARY',
            extra: 'LOADER'
          })
          this.emit('extract_progress', { filename: this.installProfile.filePath })
        }
      } else if (this.installProfile.path) {
        const universalPath = utils.getLibraryPath(this.installProfile.path)
        const universalExtractPath = path_.join(this.config.root, 'libraries', universalPath)

        if (!existsSync(universalExtractPath)) await fs.mkdir(universalExtractPath, { recursive: true })

        const mavenPath = path_.join('maven', universalPath).replace(/\\/g, '/')
        const entriesToExtract = entries.filter(
          (e) => e.fileName.includes(mavenPath) && (e.fileName.endsWith('.jar') || e.fileName.endsWith('.lzma'))
        )

        const promises = entriesToExtract.map(async (entry) => {
          await utils.extractEntryToFile(zipfile, entry, path_.join(universalExtractPath, path_.basename(entry.fileName)))
          const isLzma = entry.fileName.endsWith('.lzma')
          libraries.push({
            name: path_.basename(entry.fileName),
            path: path_.join('libraries', universalPath),
            url: '',
            type: 'LIBRARY',
            extra: isLzma ? 'INSTALL' : 'LOADER'
          })
          i++
          this.emit('extract_progress', { filename: path_.basename(entry.fileName) })
        })

        await Promise.all(promises)
      }

      if (this.installProfile.processors && this.installProfile.processors.length > 0) {
        const universalMaven = this.installProfile.libraries.find(
          (lib: any) => (lib.name + '').startsWith('net.minecraftforge:forge:') || (lib.name + '').startsWith('net.neoforged:neoforge:')
        )

        const targetName = this.installProfile.path ?? universalMaven?.name

        const clientDataName = utils.getLibraryName(targetName).replace('.jar', '-clientdata.lzma')
        const clientDataPath = utils.getLibraryPath(targetName)
        const clientDataExtractPath = path_.join(this.config.root, 'libraries', clientDataPath)

        const clientDataEntry = entries.find((e) => e.fileName === 'data/client.lzma')

        if (clientDataEntry) {
          if (!existsSync(clientDataExtractPath)) await fs.mkdir(clientDataExtractPath, { recursive: true })
          await utils.extractEntryToFile(zipfile, clientDataEntry, path_.join(clientDataExtractPath, clientDataName))
          files.push({
            name: clientDataName,
            path: path_.join('libraries', clientDataPath),
            url: '',
            type: 'OTHER'
          })
          i++
          this.emit('extract_progress', { filename: clientDataName })
        }
      }

      if (this.installProfile.data?.PATCHED) {
        const entry = this.installProfile.data.PATCHED
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

      files.push(...libraries)

      this.emit('extract_end', { amount: i })

      return { libraries, files }
    } finally {
      zipfile.close()
    }
  }
}

