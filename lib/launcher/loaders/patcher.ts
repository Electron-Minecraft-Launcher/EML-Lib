/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 */

import AdmZip from 'adm-zip'
import { FullConfig } from '../../../types/config'
import { ILoader, File } from '../../../types/file'
import { MinecraftManifest } from '../../../types/manifest'
import utils from '../../utils/utils'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path_ from 'node:path'
import { spawn } from 'node:child_process'
import EventEmitter from '../../utils/events'
import { PatcherEvents } from '../../../types/events'

export default class Patcher extends EventEmitter<PatcherEvents> {
  private readonly config: FullConfig
  private readonly manifest: MinecraftManifest
  private readonly loader: ILoader
  private readonly installProfile: any

  constructor(config: FullConfig, manifest: MinecraftManifest, loader: ILoader, installProfile: any) {
    super()
    this.config = config
    this.manifest = manifest
    this.loader = loader
    this.installProfile = installProfile
  }

  async patch() {
    const files = await this.isPatched()
    let i = 0

    if (files.patched) {
      this.emit('patch_end', { amount: i })
      return files.files
    }

    if (!this.installProfile.processors || this.installProfile.processors.length === 0) {
      this.emit('patch_end', { amount: 0 })
      return files.files
    }

    const processors = this.installProfile.processors

    for (const processor of processors) {
      if (processor?.sides && !processor.sides.includes('client')) continue

      const jarExtractPathName = path_.join(this.config.root, 'libraries', utils.getLibraryPath(processor.jar), utils.getLibraryName(processor.jar))
      const args = (processor.args as string[]).map((arg) => this.mapPath(this.mapArg(arg)))
      const classpath = (processor.classpath as string[]).map(
        (cp) => `"${path_.join(this.config.root, 'libraries', utils.getLibraryPath(cp), utils.getLibraryName(cp))}"`
      )
      const mainClass = this.getJarMain(jarExtractPathName)!

      if (!mainClass) {
        console.warn(`[Patcher] Could not find Main-Class for processor ${processor.jar}`)
        continue
      }

      await new Promise((resolve) => {
        // console.debug(args.join(', '))
        const patch = spawn(
          `"${this.config.java.absolutePath.replace('${X}', this.manifest.javaVersion?.majorVersion + '' || '8')}"`,
          ['-Xmx2G', '-classpath', [`"${jarExtractPathName}"`, ...classpath].join(path_.delimiter), mainClass, ...args],
          { shell: true }
        )

        patch.stdout.on('data', (data: Buffer) => this.emit('patch_debug', data.toString('utf8').replace(/\n$/, '')))
        patch.stderr.on('data', (data: Buffer) => this.emit('patch_debug', data.toString('utf8').replace(/\n$/, '')))
        patch.on('close', (code) => {
          this.emit('patch_progress', { filename: utils.getLibraryName(processor.jar) })
          i++
          resolve(code)
        })
      })
    }

    const resultAfterPatch = await this.isPatched()
    this.emit('patch_end', { amount: i })

    return resultAfterPatch.files
  }

  private async isPatched() {
    const processors = this.installProfile.processors

    let libraries: string[] = []

    processors?.forEach((processor: any) => {
      if (processor?.sides && !processor.sides.includes('client')) return

      processor.args.forEach((arg: string) => {
        arg = arg.replace(/[{}]/g, '')
        if (this.installProfile.data[arg]) {
          if (arg === 'BINPATCH') return

          const entry = this.installProfile.data[arg]
          const libPath = entry.client ?? entry.path ?? (typeof entry === 'string' ? entry : null)

          if (libPath) libraries.push(libPath)
        }
      })
    })

    libraries = [...new Set(libraries)]

    const promises = libraries.map(async (lib) => {
      const cleanLib = lib.replace('[', '').replace(']', '')
      const libName = utils.getLibraryName(cleanLib)
      const libPath = utils.getLibraryPath(cleanLib)
      const libExtractPath = path_.join(this.config.root, 'libraries', libPath)
      const fileObj = { name: libName, path: path_.join('libraries', libPath), url: '', type: 'LIBRARY' }

      try {
        await fs.access(path_.join(libExtractPath, libName))
        return { patched: true, file: fileObj }
      } catch {
        return { patched: false, file: fileObj }
      }
    })

    const result = await Promise.all(promises)
    const patched = result.length > 0 && result.every((c) => c.patched)
    const files = result.map((c) => c.file as File)

    return { patched, files }
  }

  private getJarMain(jarPath: string) {
    if (!existsSync(jarPath)) return null
    const manifest = new AdmZip(jarPath).getEntry('META-INF/MANIFEST.MF')?.getData()
    if (!manifest) return null
    return manifest.toString('utf8').split('Main-Class: ')[1].split('\r\n')[0]
  }

  private mapArg(arg: string) {
    const argType = arg.replace(/[{}]/g, '')

    const universalMaven = this.installProfile.libraries.find((v: any) => {
      if (this.loader.type === 'FORGE') return v.name.startsWith('net.minecraftforge:forge')
      if (this.loader.type === 'NEOFORGE') return v.name.startsWith('net.neoforged:neoforge')
    })

    if (this.installProfile.data[argType]) {
      if (argType === 'BINPATCH') {
        const clientDataName = utils.getLibraryName(this.installProfile.path ?? universalMaven.name).replace(/\.jar$/, '-clientdata.lzma')
        const clientDataExtractPath = utils.getLibraryPath(this.installProfile.path ?? universalMaven.name, this.config.root, 'libraries')
        return `"${path_.join(clientDataExtractPath, clientDataName)}"`
      }

      const entry = this.installProfile.data[argType]
      const val = entry.client ?? entry.path ?? (typeof entry === 'string' ? entry : arg)
      return val
    }

    const mappedArg = arg
      .replace('{SIDE}', `client`)
      .replace(/{ROOT}(.*?)/, `"${this.config.root}$1"`)
      .replace('{MINECRAFT_JAR}', `"${path_.join(this.config.root, 'versions', this.manifest.id, `${this.manifest.id}.jar`)}"`)
      .replace('{MINECRAFT_VERSION}', `"${path_.join(this.config.root, 'versions', this.manifest.id, `${this.manifest.id}.json`)}"`)
      .replace('{INSTALLER}', `"${path_.join(this.config.root, 'libraries')}"`)
      .replace('{LIBRARY_DIR}', `"${path_.join(this.config.root, 'libraries')}"`)

    return mappedArg
  }

  private mapPath(arg: string) {
    if (arg.startsWith('[')) {
      const result = `"${path_.join(
        this.config.root,
        'libraries',
        utils.getLibraryPath(arg.replace(/[\[\]]/g, '')),
        utils.getLibraryName(arg.replace(/[\[\]]/g, ''))
      )}"`
      // console.log('    MAPPED:', result)
      return result
    }
    // console.log('NOT MAPPED:', arg)
    return arg
  }
}
