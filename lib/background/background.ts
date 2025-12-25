/**
 * @license MIT
 * @copyright Copyright (c) 2025, GoldFrite
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
    const res = await fetch(`${this.url}/background`)
      .then((res) => res.json() as Promise<IBackground>)
      .catch((err) => {
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while fetching backgrounds: ${err}`)
      })

    return res ?? null
  }
}

