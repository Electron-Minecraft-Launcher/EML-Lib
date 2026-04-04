/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 */

import { DownloaderEvents, JavaEvents } from '../../types/events.js'
import EventEmitter from '../utils/events.js'
import manifests from '../utils/manifests.js'
import { File } from '../../types/file.js'
import path_ from 'node:path'
import Downloader from '../utils/downloader.js'
import utils from '../utils/utils.js'
import { spawn } from 'node:child_process'
import { EMLLibError, ErrorType } from '../../types/errors.js'
import { MinecraftManifest } from '../../types/manifest.js'
import { ResolvedConfig } from '../../types/config.js'

type JavaConfig = {
  /**
   * [Optional] The URL of your EML AdminTool instance. This endpoint provides the modpack manifest, loader information, and server settings.
   *
   * **Attention!** This property is ignored if a Minecraft version is explicitly defined (either in {@link minecraft `minecraft.version`}). If neither a URL nor a version is provided, the launcher defaults to the latest Vanilla release.
   */
  url?: string
  /**
   * [Optional: default is `{ version: undefined }`]
   * Minecraft configuration.
   */
  minecraft: {
    /**
     * [Optional] The Minecraft version to install (e.g., `'1.20.1'`). Use `'latest_release'` or `'latest_snapshot'` for the most recent versions.
     *
     * **Attention!** Providing this value forces the launcher into to ignore the {@link url `url`} property.
     *
     * @see [List of Minecraft versions](https://emlproject.pages.dev/resources/minecraft-versions/)
     */
    version?: string
  }
  /**
   * The name of the root game directory (e.g., `'minecraft'`). The launcher will automatically prefix this with a dot (e.g., `'.minecraft'`) under Windows.
   */
  root: string
}

export default class Java extends EventEmitter<DownloaderEvents & JavaEvents> {
  private readonly url?: string
  private readonly root: string
  private readonly minecraftVersion?: string

  /**
   * Download Java for Minecraft.
   *
   * You should not use this class if you launch Minecraft with `java.install: 'auto'` in
   * the configuration.
   * @param config The Java configuration.
   */
  constructor(config: JavaConfig)

  /**
   * Download Java for Minecraft.
   *
   * You should not use this class if you launch Minecraft with `java.install: 'auto'` in
   * the configuration.
   * @param minecraftVersion The version of Minecraft you want to install Java for. Set to
   * `null` to get the version from the EML AdminTool. Set to `latest_release` to get the latest
   * release version of Minecraft. Set to `latest_snapshot` to get the latest snapshot version of
   * Minecraft.
   * @param root The name of the game folder, **without the dot** (e.g. `'minecraft'`). This will
   * be used to create the server folder (e.g. `.minecraft`). Java will be installed in the
   * `runtime/jre-X` folder, where `X` is the major version of Java. If you don't want to install
   * Java in the game folder, you must install Java by yourself.
   * @param url The URL of the EML AdminTool website, to get the version from the EML AdminTool.
   * @deprecated The constructor with separate parameters is deprecated. Please use the constructor
   * with a `JavaConfig` object instead.
   */
  constructor(minecraftVersion: string | null, root: string, url?: string)

  constructor(arg1: string | null | JavaConfig, arg2?: string, arg3?: string) {
    super()
    if (typeof arg1 === 'object' && arg1 !== null) {
      this.minecraftVersion = arg1.minecraft.version
      this.root = arg1.root
      this.url = arg1.url
    } else {
      this.minecraftVersion = arg1 ?? undefined
      this.root = arg2 as string
      this.url = arg3
    }
  }

  /**
   * Get the files of the Java version to download.
   *
   * **You should not use this method directly. Use `Java.download()` instead.**
   * @param manifest The manifest of the Minecraft version. If not provided, the manifest will be fetched.
   * @returns The files of the Java version.
   */
  async getFiles(manifest?: MinecraftManifest): Promise<File[]> {
    manifest =
      manifest ??
      (await manifests.getMinecraftManifest({ minecraft: { version: this.minecraftVersion ?? undefined }, url: this.url } as ResolvedConfig))
    const jreVersion = (manifest.javaVersion?.component ?? 'jre-legacy') as
      | 'java-runtime-alpha'
      | 'java-runtime-beta'
      | 'java-runtime-delta'
      | 'java-runtime-gamma'
      | 'java-runtime-gamma-snapshot'
      | 'jre-legacy'
    const jreV = manifest.javaVersion?.majorVersion.toString() ?? '8'

    const jreManifest = await manifests.getJavaManifest(jreVersion, jreV)

    let files: File[] = []

    Object.entries(jreManifest.files).forEach((file: [string, any]) => {
      const normalizedPath = this.normalizeJavaPath(file[0], jreV)
      if (!normalizedPath) return

      if (file[1].type === 'directory') {
        files.push({
          name: path_.basename(file[0]),
          path: normalizedPath,
          url: '',
          type: 'FOLDER'
        })
      } else if (file[1].downloads) {
        files.push({
          name: path_.basename(file[0]),
          path: normalizedPath,
          url: file[1].downloads.raw.url,
          size: file[1].downloads.raw.size,
          sha1: file[1].downloads.raw.sha1,
          type: 'JAVA',
          executable: file[1].executable === true
        })
      }
    })

    return files
  }

  /**
   * Download Java for the Minecraft version.
   */
  async download(): Promise<void> {
    const files = await this.getFiles()

    const downloader = new Downloader(utils.getServerFolder(this.root))
    downloader.forwardEvents(this)

    await downloader.download(files)
  }

  /**
   * Check if Java is correctly installed.
   * @param absolutePath [Optional: default is `path.join(utils.getServerFolder(this.root), 'runtime',
   * 'jre-${X}', 'bin', 'java')`] Absolute path to the Java executable. You can use `${X}` to replace it
   * with the major version of Java.
   * @param majorVersion [Optional: default is `8`] Major version of Java to check.
   * @returns The version and architecture of Java.
   */
  async check(
    absolutePath: string = path_.join(utils.getServerFolder(this.root), 'runtime', 'jre-${X}', 'bin', 'java'),
    majorVersion: number = 8
  ): Promise<{ version: string; arch: '64-bit' | '32-bit' }> {
    return new Promise((resolve, reject) => {
      const javaExec = absolutePath.replace('${X}', majorVersion + '')
      const process = spawn(javaExec, ['-version'])
      let output = ''

      process.stdout.on('data', (data) => {
        output += data.toString()
      })
      process.stderr.on('data', (data) => {
        output += data.toString()
      })
      process.on('error', (err) => {
        reject(new EMLLibError(ErrorType.JAVA_ERROR, `Java is not correctly installed: ${err.message}`))
      })
      process.on('close', (code) => {
        if (code !== 0 && output.length === 0) {
          reject(new EMLLibError(ErrorType.JAVA_ERROR, `Java exited with code ${code}`))
          return
        }

        const versionMatch = output.match(/"(.*?)"/)
        const version = versionMatch ? versionMatch.pop() : majorVersion + ''
        const arch = output.includes('64-Bit') ? '64-bit' : '32-bit'
        const res = { version: version!, arch: arch as '64-bit' | '32-bit' }

        this.emit('java_info', res)
        resolve(res)
      })
    }) as Promise<{
      version: string
      arch: '64-bit' | '32-bit'
    }>
  }

  private normalizeJavaPath(filePath: string, jreV: string) {
    if (filePath.endsWith('.bundle')) return null
    if (filePath.includes('.bundle/')) {
      const homeIndex = filePath.indexOf('.bundle/Contents/Home/')
      if (homeIndex === -1) return null

      const relativePath = filePath.slice(homeIndex + '.bundle/Contents/Home/'.length)
      return path_.join('runtime', `jre-${jreV}`, path_.dirname(relativePath), '/')
    }

    return path_.join('runtime', `jre-${jreV}`, path_.dirname(filePath), '/')
  }
}



