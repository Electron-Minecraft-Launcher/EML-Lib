/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 */

import { Account } from '../../types/account.js'
import { EMLLibError, ErrorType } from '../../types/errors.js'
import { IMaintenance } from '../../types/maintenance.js'

export default class Maintenance {
  private readonly url: string
  private readonly account?: Account

  /**
   * Manage the Maintenance of the launcher.
   *
   * **Attention!** This class only works with EML AdminTool. Please do not use it without the it.
   *
   * @param url The URL of your EML AdminTool website.
   * @param account The account to use for authentication, in order to potentially bypass
   * maintenance.
   */
  constructor(url: string, account: Account) {
    this.url = `${url}/api`
    this.account = account
  }

  /**
   * Get the current maintenance status from the EML AdminTool.
   *
   * @returns `null` if there is no maintenance, otherwise it will return the maintenance status.
   * You can check the `startTime` and `endTime` properties to see if the maintenance is active.
   */
  async getMaintenance(): Promise<IMaintenance | null> {
    try {
      const headers: HeadersInit = this.account ? { pseudo: this.account.name } : {}
      const req = await fetch(`${this.url}/maintenance`, { headers })

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




