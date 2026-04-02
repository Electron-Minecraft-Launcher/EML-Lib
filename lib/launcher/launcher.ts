/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 */

import { CleanerEvents, DownloaderEvents, FilesManagerEvents, JavaEvents, LauncherEvents, PatcherEvents } from '../../types/events.js'
import EventEmitter from '../utils/events.js'
import manifests from '../utils/manifests.js'
import utils from '../utils/utils.js'
import { Config, ResolvedConfig } from './../../types/config.js'
import path_ from 'node:path'
import FilesManager from './filesmanager.js'
import Downloader from '../utils/downloader.js'
import Cleaner from '../utils/cleaner.js'
import Java from '../java/java.js'
import LoaderManager from './loadermanager.js'
import ArgumentsManager from './argumentsmanager.js'
import { spawn } from 'node:child_process'
import { EMLLibError, ErrorType } from '../../types/errors.js'

export default class Launcher extends EventEmitter<
  LauncherEvents & DownloaderEvents & CleanerEvents & FilesManagerEvents & JavaEvents & PatcherEvents
> {
  /**
   * The configuration of the launcher.
   */
  readonly config: ResolvedConfig

  /**
   * Launch Minecraft.
   * @param config The configuration of the Launcher.
   * 
   * _Need help? Try our [config generator](https://emlproject.pages.dev/resources/config-generator/)!_
   */
  constructor(config: Config) {
    super()

    let tmpConfig: Config & { slug?: string } = { ...config, slug: undefined }
    tmpConfig.minecraft = this.setMinecraft(tmpConfig)
    tmpConfig.slug = this.setSlug(tmpConfig)
    tmpConfig.url = this.setUrl(tmpConfig)
    tmpConfig.storage = this.setStorage(tmpConfig)
    tmpConfig.root = this.setRoot(tmpConfig)
    tmpConfig.cleaning = this.setCleaning(tmpConfig)
    tmpConfig.account = this.setAccount(tmpConfig)
    tmpConfig.java = this.setJava(tmpConfig)
    tmpConfig.window = this.setWindow(tmpConfig)
    tmpConfig.memory = this.setMemory(tmpConfig)

    this.config = {
      url: tmpConfig.url,
      slug: tmpConfig.slug,
      storage: tmpConfig.storage!,
      root: tmpConfig.root!,
      minecraft: tmpConfig.minecraft!,
      cleaning: tmpConfig.cleaning!,
      account: tmpConfig.account,
      java: tmpConfig.java!,
      window: tmpConfig.window!,
      memory: tmpConfig.memory!
    } as ResolvedConfig
  }

  /**
   * Launch Minecraft.
   *
   * _This method will patch the [Log4j vulnerability](https://help.minecraft.net/hc/en-us/articles/4416199399693-Security-Vulnerability-in-Minecraft-Java-Edition)._
   */
  async launch(): Promise<void> {
    //* Init launch
    const manifest = await manifests.getMinecraftManifest(this.config.minecraft.version, this.config.url, this.config.slug)
    const loader = await manifests.getLoaderInfo(this.config.minecraft.version, this.config.url, this.config.slug)
    this.config.minecraft.version = manifest.id

    const filesManager = new FilesManager(this.config, manifest, loader)
    const loaderManager = new LoaderManager(this.config, manifest, loader)
    const argumentsManager = new ArgumentsManager(this.config, manifest)
    const downloader = new Downloader(this.config.root)
    const cleaner = new Cleaner(this.config.root)
    const java = new Java(manifest.id, this.config.root)

    filesManager.forwardEvents(this)
    loaderManager.forwardEvents(this)
    downloader.forwardEvents(this)
    cleaner.forwardEvents(this)
    java.forwardEvents(this)

    //* Compute download
    this.emit('launch_compute_download')

    const javaFiles = await filesManager.getJava()
    const modpackFiles = await filesManager.getModpack()
    const librariesFiles = await filesManager.getLibraries()
    const assetsFiles = await filesManager.getAssets()
    const injectorFiles = await filesManager.getInjector()
    const log4jFiles = await filesManager.getLog4j()

    const javaFilesToDownload = await downloader.getFilesToDownload(javaFiles.java)
    const modpackFilesToDownload = await downloader.getFilesToDownload(modpackFiles.modpack)
    const librariesFilesToDownload = await downloader.getFilesToDownload(librariesFiles.libraries)
    const assetsFilesToDownload = await downloader.getFilesToDownload(assetsFiles.assets)
    const injectorFilesToDownload = await downloader.getFilesToDownload(injectorFiles.injector)
    const log4jFilesToDownload = await downloader.getFilesToDownload(log4jFiles.log4j)
    const filesToDownload = [
      ...javaFilesToDownload,
      ...modpackFilesToDownload,
      ...librariesFilesToDownload,
      ...assetsFilesToDownload,
      ...injectorFilesToDownload,
      ...log4jFilesToDownload
    ]

    //* Download
    this.emit('launch_download', { total: { amount: filesToDownload.length, size: filesToDownload.reduce((acc, file) => acc + file.size!, 0) } })

    await downloader.download(javaFilesToDownload, true)
    await downloader.download(modpackFilesToDownload, true)
    await downloader.download(librariesFilesToDownload, true)
    await downloader.download(assetsFilesToDownload, true)
    await downloader.download(injectorFilesToDownload, true)
    await downloader.download(log4jFilesToDownload, true)

    //* Install loader
    this.emit('launch_install_loader', loader)

    const loaderFiles = await loaderManager.setupLoader()
    await downloader.download(loaderFiles.libraries)

    //* Extract natives
    this.emit('launch_extract_natives')

    const extractedNatives = await filesManager.extractNatives([...librariesFiles.libraries, ...loaderFiles.libraries])

    //* Copy assets
    this.emit('launch_copy_assets')

    const copiedAssets = await filesManager.copyAssets()

    //* Check Java
    this.emit('launch_check_java')

    await java.check(this.config.java.absolutePath, manifest.javaVersion?.majorVersion ?? 8)

    //* Path loader
    this.emit('launch_patch_loader')

    const patchedFiles = await loaderManager.patchLoader(loaderFiles.installProfile)

    //* Clean
    this.emit('launch_clean')

    const files = [
      ...javaFiles.files,
      ...modpackFiles.files,
      ...librariesFiles.files,
      ...assetsFiles.files,
      ...injectorFiles.files,
      ...log4jFiles.files,
      ...extractedNatives.files,
      ...copiedAssets.files,
      ...loaderFiles.files,
      ...patchedFiles.files
    ]
    await cleaner.clean(files, this.config.cleaning.ignored, !this.config.cleaning.enabled)

    //* Launch
    this.emit('launch_launch', { version: manifest.id, type: loader.type, loaderVersion: loader.loaderVersion })

    const customAuth =
      this.config.account.meta.type === 'yggdrasil' && injectorFiles.injector[0]
        ? {
            injectorPath: injectorFiles.injector[0].path + injectorFiles.injector[0].name,
            authServerUrl: this.config.account.meta.url!
          }
        : undefined
    const args = argumentsManager.getArgs([...loaderFiles.libraries, ...librariesFiles.libraries], loader, loaderFiles.loaderManifest, customAuth)

    const blindArgs = args.map((arg, i) => (i === args.findIndex((p) => p === '--accessToken') + 1 ? '**********' : arg))
    this.emit('launch_debug', `Launching Minecraft with args: ${blindArgs.join(' ')}`)

    await this.run(this.config.java.absolutePath.replace('${X}', manifest.javaVersion?.majorVersion.toString() ?? '8'), args)
  }

  private setMinecraft(config: Config) {
    let version: string | undefined = undefined
    let loader: { loader: 'vanilla' | 'forge' | 'neoforge' | 'fabric' | 'quilt'; version: string } | undefined = undefined
    let modpackUrl: string | undefined = undefined
    let args: string[] = []

    const isValidProfile = config.profile?.slug && config.profile.slug !== '' && config.profile.slug === utils.sanitizeSlug(config.profile.slug)

    if (isValidProfile && config.profile && config.profile.minecraft?.version) {
      version = config.profile.minecraft.version
      if (!config.profile.minecraft?.loader) {
        loader = { loader: 'vanilla', version: version }
      } else if (config.profile.minecraft.loader.loader === 'vanilla') {
        loader = { loader: 'vanilla', version: version }
      } else if (config.profile.minecraft.loader.version) {
        loader = { loader: config.profile.minecraft.loader.loader, version: config.profile.minecraft.loader.version }
      } else {
        throw new EMLLibError(ErrorType.CONFIG_ERROR, `You must provide a loader version in the config when using a loader different from vanilla.`)
      }
      if (config.profile.minecraft?.modpackUrl) {
        modpackUrl = config.profile.minecraft.modpackUrl
      }
    } else if (config.minecraft?.version) {
      if (config.profile && !isValidProfile) {
        console.warn('Warning: Invalid profile. Launching with Minecraft config.')
      }
      version = config.minecraft.version
      if (!config.minecraft?.loader) {
        loader = { loader: 'vanilla', version: version }
      } else if (config.minecraft.loader.loader === 'vanilla') {
        loader = { loader: 'vanilla', version: version }
      } else if (config.minecraft.loader.version) {
        loader = { loader: config.minecraft.loader.loader, version: config.minecraft.loader.version }
      } else {
        throw new EMLLibError(ErrorType.CONFIG_ERROR, `You must provide a loader version in the config when using a loader different from vanilla.`)
      }
      if (config.minecraft?.modpackUrl) {
        modpackUrl = config.minecraft.modpackUrl
      }
    } else if (!config.url) {
      if (config.profile && !isValidProfile) {
        console.warn('Warning: Invalid profile. Launching with latest Minecraft version.')
      }
      version = 'latest_release'
      loader = { loader: 'vanilla', version: version }
    } else {
      if (config.profile && !isValidProfile) {
        console.warn('Warning: Invalid profile. Launching with EML AdminTool default profile.')
      }
    }

    if (config.profile && isValidProfile && config.profile?.minecraft?.args) {
      args = config.profile.minecraft.args
    } else if (config.minecraft?.args) {
      args = config.minecraft.args
    }

    return { version, loader, modpackUrl, args }
  }

  private setSlug(config: Config) {
    if (config.profile?.slug && config.profile.slug !== '' && config.profile.slug === utils.sanitizeSlug(config.profile.slug)) {
      return config.profile.slug
    }
    return undefined
  }

  private setUrl(config: Config) {
    if (config.minecraft?.version) {
      return undefined
    }
    if (config.url) {
      return config.url
    }
    return undefined
  }

  private setStorage(config: Config) {
    if (config.storage === 'shared') {
      return 'shared'
    }
    if (config.storage === 'isolated') {
      return 'isolated'
    }
    if (config.storageMode === 'shared') {
      return 'shared' // backwards compatibility
    }
    return 'isolated'
  }

  private setRoot(config: Config) {
    if (!config.root && !config.serverId) {
      throw new EMLLibError(ErrorType.CONFIG_ERROR, 'You must provide a root in the config to set the game folder.')
    }
    if (!config.root) {
      config.root = config.serverId // backwards compatibility
    }
    return utils.getRootFolder(config as Config & { root: string })
  }

  private setCleaning(config: Config) {
    const DEFAULT_IGNORED = ['crash-reports/', 'logs/', 'resourcepacks/', 'resources/', 'saves/', 'shaderpacks/', 'options.txt', 'optionsof.txt']
    let enabled = true
    let ignored: string[] = DEFAULT_IGNORED

    if (config.cleaning?.enabled !== undefined) {
      enabled = config.cleaning.enabled
    } else if (config.cleaning?.clean !== undefined) {
      enabled = config.cleaning.clean // backwards compatibility
    } else {
      enabled = true
    }

    if (config.storage === 'shared' && enabled) {
      console.warn(
        'Warning: You are using shared storage mode with cleaning enabled. This may cause issues as the launcher will delete shared assets and libraries when launching different profiles. It is recommended to disable cleaning when using shared storage mode.'
      )
    }

    if (config.cleaning?.ignored) {
      ignored = config.cleaning.ignored
    }

    return { enabled, ignored }
  }

  private setAccount(config: Config) {
    if (config.account?.meta.type === 'crack') {
      console.warn(
        'Warning: You are using a cracked account (offline mode). This authentication method is not secure and is not recommended. Use it only for testing purposes.'
      )
    }

    return config.account
  }

  private setJava(config: Config) {
    let install: 'auto' | 'manual' = 'auto'
    let absolutePath: string
    let args: string[] = []

    if (config.java?.install === 'manual') {
      install = 'manual'
      if (config.java.absolutePath) {
        absolutePath = config.java.absolutePath
      } else if (config.java.relativePath) {
        absolutePath = path_.join(config.root!, config.java.relativePath)
      } else {
        absolutePath = 'java'
      }
    } else {
      install = 'auto'
      absolutePath = path_.join(config.root!, 'runtime', 'jre-${X}', 'bin', 'java')
    }

    if (config.java?.args) {
      args = config.java.args
    }

    return { install, absolutePath, args }
  }

  private setWindow(config: Config) {
    let width = 854
    let height = 480
    let fullscreen = false

    if (config.window?.width && config.window.width > 100) {
      width = config.window.width
    }

    if (config.window?.height && config.window.height > 100) {
      height = config.window.height
    }

    if (config.window?.fullscreen) {
      fullscreen = config.window.fullscreen
    }

    return { width, height, fullscreen }
  }

  private setMemory(config: Config) {
    let min = 512
    let max = 1023

    if (config.memory?.min && config.memory.min > 128) {
      min = config.memory.min
    }

    if (config.memory?.max && config.memory.max > min) {
      max = config.memory.max
    }

    return { min, max }
  }

  private async run(javaPath: string, args: string[]) {
    return new Promise<void>((resolve, reject) => {
      const minecraft = spawn(javaPath, args, { cwd: this.config.root, detached: true })
      minecraft.unref()
      minecraft.stdout.on('data', (data: Buffer) => this.emit('launch_data', data.toString('utf8').replace(/\n$/, '')))
      minecraft.stderr.on('data', (data: Buffer) => this.emit('launch_data', data.toString('utf8').replace(/\n$/, '')))
      minecraft.on('error', reject)
      minecraft.on('close', (code) => {
        this.emit('launch_close', code ?? -1)
        resolve()
      })
    })
  }
}

