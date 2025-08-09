/**
 * @license MIT
 * @copyright Copyright (c) 2024, GoldFrite
 */

import { CleanerEvents, DownloaderEvents, FilesManagerEvents, JavaEvents, LauncherEvents, PatcherEvents } from '../../types/events'
import EventEmitter from '../utils/events'
import manifests from '../utils/manifests'
import utils from '../utils/utils'
import { Config, FullConfig } from './../../types/config'
import path_ from 'path'
import FilesManager from './filesmanager'
import Downloader from '../utils/downloader'
import Cleaner from '../utils/cleaner'
import Java from '../java/java'
import LoaderManager from './loadermanager'
import ArgumentsManager from './argumentsmanager'
import { spawn } from 'child_process'

/**
 * Launch Minecraft.
 * @workInProgress
 */
export default class Launcher extends EventEmitter<LauncherEvents & DownloaderEvents & CleanerEvents & FilesManagerEvents & JavaEvents & PatcherEvents> {
  private config: FullConfig

  /**
   * @param config The configuration of the Launcher.
   */
  constructor(config: Config) {
    super()

    config.cleaning = {
      clean: config.cleaning?.clean === true,
      ignored: config.cleaning?.ignored || [
        'runtime/',
        'crash-reports/',
        'logs/',
        'resourcepacks/',
        'resources/',
        'saves/',
        'shaderpacks/',
        'options.txt',
        'optionsof.txt'
      ]
    }
    config.minecraft = {
      version: config.minecraft?.version ? config.minecraft?.version : config.url ? null : 'latest_release',
      args: config.minecraft?.args || []
    }
    config.java = {
      install: config.java?.install || 'auto',
      absolutePath: config.java?.absolutePath
        ? config.java.absolutePath
        : config.java?.relativePath
          ? path_.join(utils.getServerFolder(config.serverId), config.java.relativePath, '/')
          : path_.join(utils.getServerFolder(config.serverId), 'runtime', 'jre-${X}', 'bin', 'java'),
      args: config.java?.args || []
    }
    config.window = {
      width: config.window?.width || 854,
      height: config.window?.height || 480,
      fullscreen: config.window?.fullscreen || false
    }
    config.memory = {
      min: config.memory?.min || 512,
      max: config.memory?.max && config.memory.max > (config.memory.min || 512) ? config.memory.max : 1023
    }

    this.config = { ...(config as FullConfig), root: utils.getServerFolder(config.serverId) }
  }

  /**
   * Launch Minecraft.
   *
   * This method will patch the [Log4j vulnerability](https://help.minecraft.net/hc/en-us/articles/4416199399693-Security-Vulnerability-in-Minecraft-Java-Edition).
   */
  async launch() {
    //* Init launch
    const manifest = await manifests.getMinecraftManifest(this.config.minecraft.version, this.config.url)
    const loader = await manifests.getLoaderInfo(this.config.minecraft.version, this.config.url)
    this.config.minecraft.version = manifest.id

    const filesManager = new FilesManager(this.config, manifest, loader)
    const loaderManager = new LoaderManager(this.config, manifest, loader)
    const argumentsManager = new ArgumentsManager(this.config, manifest)
    const downloader = new Downloader(this.config.root)
    const cleaner = new Cleaner(this.config.root)
    const java = new Java(manifest.id, this.config.serverId)

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
    const log4jFiles = await filesManager.getLog4j()

    const javaFilesToDownload = downloader.getFilesToDownload(javaFiles.java)
    const modpackFilesToDownload = downloader.getFilesToDownload(modpackFiles.modpack)
    const librariesFilesToDownload = downloader.getFilesToDownload(librariesFiles.libraries)
    const assetsFilesToDownload = downloader.getFilesToDownload(assetsFiles.assets)
    const log4jFilesToDownload = downloader.getFilesToDownload(log4jFiles.log4j)
    const filesToDownload = [
      ...javaFilesToDownload,
      ...modpackFilesToDownload,
      ...librariesFilesToDownload,
      ...assetsFilesToDownload,
      ...log4jFilesToDownload
    ]

    //* Download
    this.emit('launch_download', { total: { amount: filesToDownload.length, size: filesToDownload.reduce((acc, file) => acc + file.size!, 0) } })

    await downloader.download(javaFilesToDownload, true)
    await downloader.download(modpackFilesToDownload, true)
    await downloader.download(librariesFilesToDownload, true)
    await downloader.download(assetsFilesToDownload, true)
    await downloader.download(log4jFilesToDownload, true)

    //* Install loader
    this.emit('launch_install_loader', loader)

    await new Promise((resolve) => setTimeout(resolve, 1000)) // Avoid "Error: ADM-ZIP: Invalid or unsupported zip format. No END header found" error
    const loaderFiles = await loaderManager.setupLoader()
    await downloader.download(loaderFiles.libraries)

    //* Extract natives
    this.emit('launch_extract_natives')

    const extractedNatives = filesManager.extractNatives([...librariesFiles.libraries, ...loaderFiles.libraries])

    //* Copy assets
    this.emit('launch_copy_assets')

    const copiedAssets = filesManager.copyAssets()

    //* Check Java
    this.emit('launch_check_java')

    const javaInfo = java.check(this.config.java.absolutePath, manifest.javaVersion?.majorVersion || 8)

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
      ...log4jFiles.files,
      ...extractedNatives.files,
      ...copiedAssets.files,
      ...loaderFiles.files,
      ...patchedFiles.files
    ]
    cleaner.clean(files, this.config.cleaning.ignored, !this.config.cleaning.clean)

    //* Launch
    this.emit('launch_launch', { version: manifest.id, type: loader.type, loaderVersion: loader.loaderVersion })

    const args = argumentsManager.getArgs([...loaderFiles.libraries, ...librariesFiles.libraries], loader, loaderFiles.loaderManifest)

    const blindArgs = args.map((arg, i) => (i === args.findIndex((p) => p === '--accessToken') + 1 ? '**********' : arg))
    this.emit('launch_debug', `Launching Minecraft with args: ${args.join(' ')}`)

    this.run(this.config.java.absolutePath.replace('${X}', manifest.javaVersion?.majorVersion.toString() || '8'), args)
  }

  private async run(javaPath: string, args: string[]) {
    const minecraft = spawn(javaPath, args, { cwd: this.config.root, detached: true })
    minecraft.stdout.on('data', (data: Buffer) => this.emit('launch_data', data.toString('utf8').replace(/\n$/, '')))
    minecraft.stderr.on('data', (data: Buffer) => this.emit('launch_data', data.toString('utf8').replace(/\n$/, '')))
    minecraft.on('close', (code) => this.emit('launch_close', code || 0))
  }
}
