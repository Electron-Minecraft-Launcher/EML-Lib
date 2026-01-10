/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 */

import { FullConfig } from '../../../types/config'
import { FilesManagerEvents } from '../../../types/events'
import { ILoader } from '../../../types/file'
import { MinecraftManifest } from '../../../types/manifest'
import EventEmitter from '../../utils/events'

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
}

