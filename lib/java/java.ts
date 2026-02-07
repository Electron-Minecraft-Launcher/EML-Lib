/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 */

import { DownloaderEvents, JavaEvents } from '../../types/events'
import EventEmitter from '../utils/events'
import manifests from '../utils/manifests'
import { File } from '../../types/file'
import path_ from 'node:path'
import Downloader from '../utils/downloader'
import utils from '../utils/utils'
import { spawn } from 'node:child_process'
import { EMLLibError, ErrorType } from '../../types/errors'
import { MinecraftManifest } from '../../types/manifest'

/**
 * Download Java for Minecraft.
 *
 * You should not use this class if you launch Minecraft with `java.install: 'auto'` in
 * the configuration.
 */
export default class Java extends EventEmitter<DownloaderEvents & JavaEvents> {
  private readonly minecraftVersion: string | null
  private readonly serverId: string
  private readonly url?: string

  /**
   * @param minecraftVersion The version of Minecraft you want to install Java for. Set to
   * `null` to get the version from the EML AdminTool. Set to `latest_release` to get the latest
   * release version of Minecraft. Set to `latest_snapshot` to get the latest snapshot version of
   * Minecraft.
   * @param serverId Your Minecraft server ID (e.g. `'minecraft'`). This will be used to
   * create the server folder (e.g. `.minecraft`). Java will be installed in the `runtime/jre-X`
   * folder, where `X` is the major version of Java. If you don't want to install Java in the
   * game folder, you must install Java by yourself.
   * @param url The URL of the EML AdminTool website, to get the version from the EML AdminTool.
   */
  constructor(minecraftVersion: string | null, serverId: string, url?: string) {
    super()
    this.minecraftVersion = minecraftVersion
    this.serverId = serverId
    this.url = url
  }

  /**
   * Get the files of the Java version to download.
   *
   * **You should not use this method directly. Use `Java.download()` instead.**
   * @param manifest The manifest of the Minecraft version. If not provided, the manifest will be fetched.
   * @returns The files of the Java version.
   */
  async getFiles(manifest?: MinecraftManifest) {
    manifest = manifest ?? (await manifests.getMinecraftManifest(this.minecraftVersion, this.url))
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
  async download() {
    const files = await this.getFiles()

    const downloader = new Downloader(utils.getServerFolder(this.serverId))
    downloader.forwardEvents(this)

    await downloader.download(files)
  }

  /**
   * Check if Java is correctly installed.
   * @param absolutePath [Optional: default is `path.join(utils.getServerFolder(this.serverId), 'runtime',
   * 'jre-${X}', 'bin', 'java')`] Absolute path to the Java executable. You can use `${X}` to replace it
   * with the major version of Java.
   * @param majorVersion [Optional: default is `8`] Major version of Java to check.
   * @returns The version and architecture of Java.
   */
  async check(
    absolutePath: string = path_.join(utils.getServerFolder(this.serverId), 'runtime', 'jre-${X}', 'bin', 'java'),
    majorVersion: number = 8
  ) {
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
