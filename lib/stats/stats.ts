import { EMLLibError, ErrorType } from '../../types/errors.js'
import { StatEvent } from '../../types/stats.js'

export default class Stats {
  private readonly url: string
  private readonly events: StatEvent[]
  private token: string | null = null

  /**
   * Send stats about the Launcher to EML AdminTool.
   *
   * **Attention!** This class only works with EML AdminTool. Please do not use it without the it.
   *
   * ---
   *
   * Note for European users:
   *
   * This class is compliant with the [GDPR](https://gdpr-info.eu/), and does not send any
   * personally identifiable information to EML. However, it does send some anonymous usage
   * statistics to help you improve your Launcher.
   *
   * ---
   *
   * @param url The URL of your EML AdminTool website.
   *
   */
  constructor(url: string, events: StatEvent[] = ['STARTUP', 'LOGIN', 'LAUNCH', 'UPDATE', 'DEVTOOLS']) {
    this.url = `${url}/api`
    this.events = events
  }

  private async getStatsToken() {
    try {
      if (this.token) {
        const tokenParts = this.token.split('.')
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]))
          const now = Math.floor(Date.now() / 1000)
          if (payload.exp > now + 10) {
            return this.token
          }
        }
      }

      const req = await fetch(`${this.url}/stats/handshake`)

      if (!req.ok) {
        if (req.status === 429) {
          console.warn('Rate limited while fetching stats token.')
          return null
        }
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while fetching stats token: HTTP ${req.status} ${errorText}`)
      }
      const data: { token: string } = await req.json()
      this.token = data.token
      return this.token
    } catch (err: unknown) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while fetching stats token: ${err instanceof Error ? err.message : err}`)
    }
  }
}
