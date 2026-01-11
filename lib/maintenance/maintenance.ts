/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 */

import { EMLLibError, ErrorType } from '../../types/errors'
import { IMaintenance } from '../../types/maintenance'

/**
 * Manage the Maintenance of the Launcher.
 *
 * **Attention!** This class only works with the EML AdminTool. Please do not use it without the AdminTool.
 */
export default class Maintenance {
  private readonly url: string

  /**
   * @param url The URL of your EML AdminTool website.
   */
  constructor(url: string) {
    this.url = `${url}/api`
  }

  /**
   * Get the current Maintenance status from the EML AdminTool.
   * @returns `null` if there is no maintenance, otherwise it will return the maintenance status.
   * You can check the `startTime` and `endTime` properties to see if the maintenance is active.
   */
  async getMaintenance() {
    try {
      const req = await fetch(`${this.url}/maintenance`)

      if (!req.ok) {
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while fetching maintenance status: HTTP ${req.status} ${errorText}`)
      }
      const data: IMaintenance = await req.json()

      if (data.startTime) return data
      else return null
    } catch (err: unknown) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while fetching maintenance status: ${err instanceof Error ? err.message : err}`)
    }
  }
}
