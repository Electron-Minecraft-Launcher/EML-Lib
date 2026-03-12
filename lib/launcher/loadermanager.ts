/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 */

import { FullConfig } from '../../types/config.js'
import { FilesManagerEvents, PatcherEvents } from '../../types/events.js'
import { ExtraFile, File, ILoader } from '../../types/file.js'
import { MinecraftManifest } from '../../types/manifest.js'
import EventEmitter from '../utils/events.js'
import Patcher from './loaders/patcher.js'
import ForgeLikeLoader from './loaders/forgelike.js'
import FabricLikeLoader from './loaders/fabriclike.js'

export default class LoaderManager extends EventEmitter<FilesManagerEvents & PatcherEvents> {
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
   * Setup the loader.
   * @returns `loaderManifest`: Loader manifest; `installProfile`: Install profile; `libraries`: libraries
   * files; `files`: all files created by the method or that will be created (including `libraries`).
   */
  async setupLoader(): Promise<{
    loaderManifest: MinecraftManifest | null
    installProfile: any
    libraries: ExtraFile[]
    files: File[]
  }> {
    let setup = { loaderManifest: null as null | MinecraftManifest, installProfile: null as any, libraries: [] as ExtraFile[], files: [] as File[] }

    if (this.loader.type === 'FORGE' || this.loader.type === 'NEOFORGE') {
      const forgeLikeLoader = new ForgeLikeLoader(this.config, this.manifest, this.loader)
      forgeLikeLoader.forwardEvents(this)
      setup = await forgeLikeLoader.setup()
    } else if (this.loader.type === 'FABRIC' || this.loader.type === 'QUILT') {
      const fabricLikeLoader = new FabricLikeLoader(this.config, this.manifest, this.loader)
      fabricLikeLoader.forwardEvents(this)
      setup = await fabricLikeLoader.setup()
    }

    return setup
  }

  /**
   * Patch the loader.
   * @param installProfile The install profile from `LoaderManager.setupLoader()`.
   * @returns `files`: all files created by the method.
   */
  async patchLoader(installProfile: any): Promise<{ files: File[] }> {
    if ((this.loader.type === 'FORGE' || this.loader.type === 'NEOFORGE') && installProfile) {
      const patcher = new Patcher(this.config, this.manifest, this.loader, installProfile)
      patcher.forwardEvents(this)
      return { files: await patcher.patch() }
    }

    return { files: [] }
  }
}

