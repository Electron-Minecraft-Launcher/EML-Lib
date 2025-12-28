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

    if (!this.installProfile.processors || this.installProfile.processors.length === 0 || files.patched) {
      this.emit('patch_end', { amount: i })
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

      await new Promise((resolve) => {
        const patch = spawn(
          `"${this.config.java.absolutePath.replace('${X}', this.manifest.javaVersion?.majorVersion + '' || '8')}"`,
          ['-classpath', [`"${jarExtractPathName}"`, ...classpath].join(path_.delimiter), mainClass, ...args],
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

    this.emit('patch_end', { amount: i })

    return files.files
  }

  private async isPatched() {
    const processors = this.installProfile.processors

    let libraries: string[] = []

    processors?.forEach((processor: any) => {
      if (processor?.sides && !processor.sides.includes('client')) return

      processor.args.forEach((arg: string) => {
        arg = arg.replace('{', '').replace('}', '')
        if (this.installProfile.data[arg]) {
          if (arg === 'BINPATCH') return
          libraries.push(this.installProfile.data[arg].client)
        }
      })
    })

    libraries = [...new Set(libraries)]

    const promises = libraries.map(async (lib) => {
      const libName = utils.getLibraryName(lib.replace('[', '').replace(']', ''))
      const libPath = utils.getLibraryPath(lib.replace('[', '').replace(']', ''))
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
    const patched = result.every((c) => c.patched)
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
    const argType = arg.replace('{', '').replace('}', '')

    const universalMaven = this.installProfile.libraries.find((v: any) => {
      if (this.loader.type === 'FORGE') return v.name.startsWith('net.minecraftforge:forge')
    })

    if (this.installProfile.data[argType]) {
      if (argType === 'BINPATCH') {
        const clientDataName = utils.getLibraryName(this.installProfile.path || universalMaven.name).replace('.jar', '-clientdata.lzma')
        const clientDataExtractPath = utils.getLibraryPath(this.installProfile.path || universalMaven.name, this.config.root, 'libraries')
        return `"${path_.join(clientDataExtractPath, clientDataName).replace('.jar', '-clientdata.lzma')}"`
      }

      return this.installProfile.data[argType].client as string
    }

    return arg
      .replace('{SIDE}', `client`)
      .replace('{ROOT}', `"${this.config.root}}"`)
      .replace('{MINECRAFT_JAR}', `"${path_.join(this.config.root, 'versions', this.manifest.id, `${this.manifest.id}.jar`)}"`)
      .replace('{MINECRAFT_VERSION}', `"${path_.join(this.config.root, 'versions', this.manifest.id, `${this.manifest.id}.json`)}"`)
      .replace('{INSTALLER}', `"${path_.join(this.config.root, 'libraries')}"`)
      .replace('{LIBRARY_DIR}', `"${path_.join(this.config.root, 'libraries')}"`)
  }

  private mapPath(arg: string) {
    if (arg.startsWith('[')) {
      return `"${path_.join(this.config.root, 'libraries', utils.getLibraryPath(arg.replace('[', '').replace(']', '')), utils.getLibraryName(arg.replace('[', '').replace(']', '')))}"`
    }
    return arg
  }
}
