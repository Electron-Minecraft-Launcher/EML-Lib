/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 */

import { IStatProvider, StatProvider } from '../../types/stats.js'
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
import loaders from '../utils/loaders.js'

export default class Launcher
  extends EventEmitter<LauncherEvents & DownloaderEvents & CleanerEvents & FilesManagerEvents & JavaEvents & PatcherEvents>
  implements IStatProvider
{
  readonly statType: StatProvider = 'LAUNCHER'
  /**
   * The configuration of the launcher.
   */
  readonly config: ResolvedConfig
  private launchArgs_: string[] = []
  private launcherLogs_: string[] = []

  /**
   * Launch Minecraft.
   * @param config The configuration of the launcher.
   *
   * _Need help? Try our [config generator](https://emlproject.com/resources/config-generator/)!_
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

  get launchArgs() {
    return this.launchArgs_
  }

  get launcherLogs() {
    return this.launcherLogs_
  }

  /**
   * Launch Minecraft.
   *
   * _This method will patch the [Log4j vulnerability](https://help.minecraft.net/hc/en-us/articles/4416199399693-Security-Vulnerability-in-Minecraft-Java-Edition)._
   */
  async launch(): Promise<void> {
    //* Init launch
    const loader = await loaders.getLoader(this.config)
    const manifest = await manifests.getMinecraftManifest(this.config, loader)
    this.config.minecraft.version = manifest.id

    const filesManager = new FilesManager(this.config, manifest, loader)
    const loaderManager = new LoaderManager(this.config, manifest, loader)
    const argumentsManager = new ArgumentsManager(this.config, manifest)
    const downloader = new Downloader(this.config.root)
    const cleaner = new Cleaner(this.config.root)
    const java = new Java(this.config)

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
    const javaInfo = await java.check(this.config.java.absolutePath, manifest.javaVersion?.majorVersion ?? 8)

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
    this.emit('launch_launch', { ...this.config, java: { ...this.config.java, version: javaInfo.version } })

    const customAuth = argumentsManager.getCustomArgs(injectorFiles)
    const args = argumentsManager.getArgs([...loaderFiles.libraries, ...librariesFiles.libraries], loader, loaderFiles.loaderManifest, customAuth)
    const blindArgs = args.map((arg, i) => (i === args.findIndex((p) => p === '--accessToken') + 1 ? '**********' : arg))
    this.emit('launch_debug', `Launching Minecraft with args: ${blindArgs.join(' ')}`)

    await this.run(this.config.java.absolutePath.replace('${X}', manifest.javaVersion?.majorVersion.toString() ?? '8'), args)
  }

  // @ts-ignore
  protected emit(eventName: any, ...args: any[]) {
    
    const eventNameStr = String(eventName)

    if (eventNameStr === 'launch_data' || eventNameStr.endsWith('_progress')) {
      // @ts-ignore
      return super.emit(eventName, ...args)
    }

    const time = new Date().toTimeString().split(' ')[0]
    let level = 'INFO'

    if (eventNameStr.includes('error') || eventNameStr.includes('fail')) level = 'ERROR'
    else if (eventNameStr.includes('debug')) level = 'DEBUG'

    let message = this.formatEventMessage(eventNameStr, args)

    if (args[0] instanceof Error) {
      level = 'ERROR'
      message += `\n${args[0].stack || args[0].message}`
    } else if (args[0]?.message instanceof Error) {
      level = 'ERROR'
      message += `\n${args[0].message.stack || args[0].message.message}`
    }

    this.launcherLogs_.push(`[${time}] [${level}]: ${message}`)

    if (this.launcherLogs_.length > 500) {
      this.launcherLogs_.shift()
    }

    return super.emit(eventName, ...args)
  }

  private formatEventMessage(eventName: string, args: any[]): string {
    const arg = args[0]

    switch (eventName) {
      // --- Events WITHOUT arguments ---
      case 'launch_compute_download':
        return `Computing required files...`
      case 'launch_copy_assets':
        return `Copying game assets...`
      case 'launch_extract_natives':
        return `Extracting native libraries...`
      case 'launch_patch_loader':
        return `Applying loader patches...`
      case 'launch_check_java':
        return `Checking Java installation...`
      case 'launch_clean':
        return `Cleaning files...`

      // --- Events WITH arguments ---
      case 'launch_download':
        return `Preparing download of ${arg?.total?.amount ?? 0} files.`
      case 'launch_install_loader':
        return `Installing ${arg?.type} ${arg?.loaderVersion || ''} for Minecraft ${arg?.minecraftVersion}.`
      case 'launch_launch':
        return `Launching Minecraft process...`
      case 'launch_crash':
        return `The process crashed with code ${arg?.code}.`
      case 'launch_debug':
        return 'Launching Minecraft with args: see below.'

      // Downloader / FilesManager / Cleaner
      case 'download_end':
        return `Download completed (${arg?.downloaded?.amount ?? 0} files).`
      case 'extract_end':
        return `Extraction of ${arg?.amount ?? 0} archives completed.`
      case 'copy_end':
        return `Copy of ${arg?.amount ?? 0} assets completed.`
      case 'clean_end':
        return `Cleanup completed (${arg?.amount ?? 0} files deleted).`

      // Java
      case 'java_info':
        return `Java environment detected: v${arg?.version} (${arg?.arch}).`

      // Auth
      case 'auth_success':
      case 'refresh_success':
      case 'validate_success':
        return `Valid session for player ${arg?.name}.`

      default:
        if (args.length === 0) return ''
        return args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
    }
  }

  protected warn(message: string) {
    const time = new Date().toTimeString().split(' ')[0]
    const logLine = `[${time}] [WARN]: ${message}`
    console.warn(message)
    this.launcherLogs_.push(logLine)
  }

  private setMinecraft(config: Config) {
    const isValidProfile = !!(config.profile?.slug && config.profile.slug !== '' && config.profile.slug === utils.sanitizeSlug(config.profile.slug))

    const profileMc = isValidProfile && config.profile?.minecraft?.version ? config.profile.minecraft : null
    const rootMc = config.minecraft?.version ? config.minecraft : null
    const activeMcSource = profileMc || rootMc

    if (config.profile && !isValidProfile) {
      let reason = config.url ? 'EML AdminTool default profile' : 'latest Minecraft version'
      if (rootMc) reason = 'Minecraft config'
      this.warn(`Warning: Invalid profile. Launching with ${reason}.`)
    }

    if (!activeMcSource) {
      const version = config.url ? undefined : 'latest_release'
      return {
        version,
        loader: version ? { loader: 'vanilla' as const, version } : undefined,
        modpackUrl: undefined,
        args: config.minecraft?.args || []
      }
    }

    const version = activeMcSource.version!
    let loader: { loader: 'vanilla' | 'forge' | 'neoforge' | 'fabric' | 'quilt'; version: string }

    const loaderCfg = activeMcSource.loader
    if (!loaderCfg || loaderCfg.loader === 'vanilla') {
      loader = { loader: 'vanilla', version }
    } else {
      if (!loaderCfg.version) {
        throw new EMLLibError(ErrorType.CONFIG_ERROR, `You must provide a loader version in the config when using a loader different from vanilla.`)
      }
      loader = { loader: loaderCfg.loader, version: loaderCfg.version }
    }

    const args = isValidProfile && config.profile?.minecraft?.args ? config.profile.minecraft.args : config.minecraft?.args || []

    return {
      version,
      loader,
      modpackUrl: activeMcSource.modpackUrl,
      args
    }
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
    return utils.getRootFolder(config as ResolvedConfig)
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
      this.warn(
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
      this.warn(
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
    this.launchArgs_ = args

    return new Promise<void>((resolve, reject) => {
      const minecraft = spawn(javaPath, args, { cwd: this.config.root, detached: true })

      minecraft.stdout.on('data', (data: Buffer) => this.emit('launch_data', data.toString('utf8').replace(/\n$/, '')))
      minecraft.stderr.on('data', (data: Buffer) => this.emit('launch_data', data.toString('utf8').replace(/\n$/, '')))
      minecraft.on('error', reject)
      minecraft.on('exit', (code) => {
        const exitCode = code ?? -1
        this.emit('launch_close', exitCode)
        if (exitCode !== 0) {
          this.emit('launch_crash', {
            code: exitCode,
            date: new Date().toISOString(),
            javaPath: javaPath,
            logsPath: path_.join(this.config.root, 'logs', 'latest.log'),
            crashReportsDir: path_.join(this.config.root, 'crash-reports')
          })
        }
        resolve()
      })
    })
  }
}
