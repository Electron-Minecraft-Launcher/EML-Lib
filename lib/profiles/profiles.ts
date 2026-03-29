/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 */

import { EMLLibError, ErrorType } from '../../types/errors.js'
import { IProfile } from '../../types/profile.js'

export default class Profile {
  private readonly url: string

  /**
   * Get the profiles from the EML AdminTool.
   *
   * **Attention!** This class only works with EML AdminTool. Please do not use it without the it.
   * @param url The URL of your EML AdminTool website.
   */
  constructor(url: string) {
    this.url = `${url}/api`
  }

  /**
   * Get the profiles from the EML AdminTool.
   * @returns The list of Profile objects.
   */
  async getProfiles(): Promise<IProfile[]> {
    try {
      const req = await fetch(`${this.url}/profiles`)

      if (!req.ok) {
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while fetching profiles: HTTP ${req.status} ${errorText}`)
      }
      const data: { profiles: IProfile[] } = await req.json()

      return data.profiles ?? []
    } catch (err: unknown) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while fetching profiles: ${err instanceof Error ? err.message : err}`)
    }
  }
}

