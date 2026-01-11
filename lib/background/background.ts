/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 */

import { EMLLibError, ErrorType } from '../../types/errors'
import { IBackground } from '../../types/background'

/**
 * Manage the background of the Launcher.
 *
 * **Attention!** This class only works with the EML AdminTool. Please do not use it without the AdminTool.
 */
export default class Background {
  private readonly url: string

  /**
   * @param url The URL of your EML AdminTool website.
   */
  constructor(url: string) {
    this.url = `${url}/api`
  }

  /**
   * Get the current background from the EML AdminTool.
   * @returns The current Background object, or `null` if no background is set.
   */
  async getBackground() {
    try {
      const req = await fetch(`${this.url}/background`)
      
      if (!req.ok) {
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while fetching background: HTTP ${req.status} ${errorText}`)
      }
      const data: IBackground | null = await req.json()

      return data ?? null
    } catch (err: unknown) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while fetching background: ${err instanceof Error ? err.message : err}`)
    }
  }
}
