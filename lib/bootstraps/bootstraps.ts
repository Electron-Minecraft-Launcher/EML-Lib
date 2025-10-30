/**
 * @license MIT
 * @copyright Copyright (c) 2025, GoldFrite
 */

import Downloader from '../utils/downloader'
import utils from '../utils/utils'
import EventEmitter from '../utils/events'
import path_ from 'node:path'
import { spawnSync } from 'node:child_process'
import { EMLLibError, ErrorType } from '../../types/errors'
import { IBootstraps } from '../../types/bootstraps'
import { File } from '../../types/file'
import { DownloaderEvents } from '../../types/events'

/**
 * Update your Launcher.
 *
 * **Attention!** This class only works with the EML AdminTool. Please do not use it without the AdminTool.
 * @workInProgress
 */
export default class Bootstraps extends EventEmitter<DownloaderEvents> {
  private readonly url: string

  /**
   * @param url The URL of your EML AdminTool website
   */
  constructor(url: string) {
    super()
    this.url = `${url}/api`
  }

  /**
   * Check for updates of your Launcher. This method will return the version of the latest Bootstrap, but it will not download it.
   * @param currentVersion The current version of your Launcher. You can get it with `app.getVersion()`.
   * @returns If an update is available, it will return the Bootstraps object. If not, it will return `null`.
   */
  async checkForUpdate(currentVersion: string): Promise<IBootstraps | null> {
    let res = await fetch(`${this.url}/bootstraps`, { method: 'GET' })
      .then((res) => res.json())
      .catch((err) => {
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while fetching Bootstrap from the EML AdminTool: ${err}`)
      })

    if (res.version === currentVersion || res.version == null || res.version == '' || res[`${utils.getOS()}File`] == null) return null
    else return res as IBootstraps
  }

  /**
   * Download the latest Bootstrap from the EML AdminTool.
   * The downloaded Bootstrap will be saved in the temp folder. The function will return the path to the downloaded Bootstrap.
   * This method does not check for update or runs the update, it will always download the latest version.
   * @param bootstraps The `Bootstraps` object returned by `Bootstraps.checkForUpdate()`.
   * @returns The path to the downloaded Bootstrap.
   */
  async download(bootstraps: IBootstraps): Promise<string> {
    const os = utils.getOS()
    const bootstrap = bootstraps[`${os}File`] as File | undefined

    if (!bootstrap) {
      throw new EMLLibError(ErrorType.FILE_ERROR, 'Not available for this operating system')
    }

    const downloadPath = path_.join(utils.getTempFolder(), bootstrap.path, bootstrap.name)
    const downloader = new Downloader(utils.getTempFolder())

    downloader.forwardEvents(this)

    try {
      await downloader.download([bootstrap])
    } catch (error) {
      throw error
    }

    return downloadPath
  }

  /**
   * Run the downloaded Bootstrap. This method will execute the downloaded Bootstrap.
   * This method does not check for update or download the Bootstrap, it will always run the file at the given path.
   * If the file does not exist or is not executable, an error will be thrown.
   * This method automatically close the Launcher after the Bootstrap is executed.
   * @workInProgress **This method is not tested yet.**
   * @param bootstrapPath The path to the downloaded Bootstrap (returned by `Bootstraps.download()`)
   */
  runUpdate(bootstrapPath: string) {
    const os = utils.getOS()
    const cmd = os === 'win' ? `start ${bootstrapPath}` : os === 'mac' ? `open ${bootstrapPath}` : `chmod +x ${bootstrapPath} && ./${bootstrapPath}`
    const run = spawnSync(cmd)
    if (run.error) throw new EMLLibError(ErrorType.EXEC_ERROR, `Error while executing the Bootstrap: ${run.error}`)
    process.exit()
  }

  /**
   * Check for updates, download and run the Bootstrap if an update is available. This method is a
   * combination of `Bootstraps.checkForUpdate()`, `Bootstraps.download()` and `Bootstraps.runUpdate()`.
   *
   * It allows you to check for updates, download and run the Bootstrap with a single function call, without having
   * to call each function separately. However, this method will not return any value and give you no control
   * over the process. If you need more control, you should use the other methods.
   * @param currentVersion The current version of your Launcher. You can get it with `app.getVersion()`.
   * @workInProgress **This method is not tested yet.**
   */
  async checkDownloadAndRun(currentVersion: string) {
    const bootstraps = await this.checkForUpdate(currentVersion)

    let bootstrapPath: string

    if (bootstraps) {
      try {
        bootstrapPath = await this.download(bootstraps)
      } catch (error) {
        return
      }

      this.runUpdate(bootstrapPath)
    }
  }
}
