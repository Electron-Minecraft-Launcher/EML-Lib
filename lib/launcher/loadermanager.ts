/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 */

import { ResolvedConfig } from '../../types/config.js'
import { FileManagerEvents, PatcherEvents } from '../../types/events.js'
import { ExtraFile, File, FormatFile } from '../../types/file.js'
import { MinecraftManifest } from '../../types/manifest.js'
import EventEmitter from '../utils/events.js'
import Patcher from './patcher.js'
import ForgeLikeLoader from './forgelike.js'
import { EMLLibError, ErrorType } from '../../types/errors.js'

export default class LoaderManager extends EventEmitter<FileManagerEvents & PatcherEvents> {
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

  async extract(): Promise<{ libraries: ExtraFile[], files: File[] }> {
    const loader = this.config.minecraft.loader
    if (!loader || !this.loaderManifest || !this.installProfile || !this.installer || (loader.loader !== 'forge' && loader.loader !== 'neoforge')) {
      return { libraries: [], files: [] }
    }

    const forgeLikeLoader = new ForgeLikeLoader(this.config, this.minecraftManifest, this.loaderManifest, this.installProfile, this.installer)

    try {
      if (this.installer.format !== 'INSTALLER') {
        return await forgeLikeLoader.extractZip()
      } else {
        return await forgeLikeLoader.extractJar()
      }
    } catch (err: unknown) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.FILE_ERROR, `Failed to extract loader: ${err instanceof Error ? err.message : err}`)
    }
  }

  /**
   * Patch the loader.
   * @returns `files`: all files created by the method.
   */
  async patchLoader(): Promise<{ files: File[] }> {
    const loader = this.config.minecraft.loader

    if (!loader || !this.loaderManifest || !this.installProfile || (loader.loader !== 'forge' && loader.loader !== 'neoforge')) {
      return { files: [] }
    }

    const patcher = new Patcher(this.config, this.minecraftManifest, this.loaderManifest, this.installProfile)
    patcher.forwardEvents(this)
    return { files: await patcher.patch() }
  }
}

