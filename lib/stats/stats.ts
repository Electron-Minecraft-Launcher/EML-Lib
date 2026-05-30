import { AuthEvents, BootstrapEvents, LauncherEvents } from '../../index.js'
import { EMLLibError, ErrorType } from '../../types/errors.js'
import { IStatProvider, StatEvent } from '../../types/stats.js'
import EventEmitter from '../utils/events.js'
import utils from '../utils/utils.js'

export default class Stats {
  private readonly url: string
  private readonly events: StatEvent[]
  private token: string | null = null
  private initialized = false

  /**
   * Send stats about the Launcher to EML AdminTool. Ensure to initialize this class only **once**
   * in your Launcher. Don't forget to call the `initialize` method.
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
   * @param events [Optional: defaults to all events] The events to track. Note that if you want to
   * track the `STARTUP` event, you should initialize this class as soon as possible in your code,
   * so that it can send the `STARTUP` event as soon as possible after the Launcher is started.
   */
  constructor(url: string, events: StatEvent[] = ['STARTUP', 'LOGIN', 'LAUNCH', 'BOOTSTRAP']) {
    this.url = `${url}/api`
    this.events = events
  }

  /**
   * Initialize the stats system. This method should be called as soon as possible in your code,
   * and only once. It is recommended to call it before any other code, so that the `STARTUP` event
   * can be sent as soon as possible after the Launcher is started.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('Stats system is already initialized. Skipping.')
      return
    }
    this.initialized = true
    if (this.events.includes('STARTUP')) {
      this.sendStat('STARTUP', {
        os: utils.getOS(),
        arch: utils.getArch()
      })
    }
  }

  /**
   * Attach a stat provider to send stats from it to EML AdminTool.
   * @param provider The stat provider to attach. It can be an `*Auth` provider, the `Launcher` or
   * the `Bootstrap`.
   */
  attach(provider: IStatProvider): void {
    if (!this.initialized) {
      throw new EMLLibError(ErrorType.INVALID_OPERATION, 'Stats system is not initialized. Please call initialize() before attaching providers.')
    }

    switch (provider.statType) {
      case 'AUTH_MICROSOFT':
      case 'AUTH_YGGDRASIL':
      case 'AUTH_AZURIOM':
      case 'AUTH_CRACK':
        if (this.events.includes('LOGIN')) {
          const p = provider as IStatProvider & EventEmitter<AuthEvents>
          const type = provider.statType.split('_')[1]
          p.on('auth_success', ({ name }) => this.sendStat('LOGIN', { type }))
        }
        break
      case 'LAUNCHER':
        if (this.events.includes('LAUNCH')) {
          const p = provider as IStatProvider & EventEmitter<LauncherEvents>
          p.on('launch_launch', (config) =>
            this.sendStat('LAUNCH', {
              os: utils.getOS(),
              arch: utils.getArch(),
              java: config.java.version,
              loader: config.minecraft.loader?.loader ?? 'vanilla',
              version: config.minecraft.version ?? 'unknown',
              profile: config.slug ?? null,
              minRam: config.memory.min ?? null,
              maxRam: config.memory.max ?? null
            })
          )
        }
        break
      case 'BOOTSTRAP':
        if (this.events.includes('BOOTSTRAP')) {
          const p = provider as IStatProvider & EventEmitter<BootstrapEvents>
          p.on('bootstrap_update', ({ current, latest }) =>
            this.sendStat('BOOTSTRAP', {
              os: utils.getOS(),
              current: current,
              latest: latest
            })
          )
        }
        break
      default:
        break
    }
  }

  private async getStatsToken() {
    try {
      if (this.token) {
        const tokenParts = this.token.split('.')
        if (tokenParts.length === 3) {
          const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString('utf-8'))
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
      const error = err instanceof EMLLibError ? err : new EMLLibError(ErrorType.FETCH_ERROR, `Error while fetching stats token: ${err instanceof Error ? err.message : err}`)
      console.error(error)
      return null
    }
  }

  private async sendStat(event: StatEvent, data?: Record<string, any>) {
    try {
      const token = await this.getStatsToken()
      if (!token) {
        console.warn('No stats token available, skipping stat event:', event)
        return
      }

      const e = event.toLowerCase()

      const req = await fetch(`${this.url}/stats/${e}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data)
      })

      if (!req.ok) {
        if (req.status === 429) {
          console.warn('Rate limited while sending stat event:', event)
          return
        }
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while sending stat event: HTTP ${req.status} ${errorText}`)
      }
    } catch (err: unknown) {
      const error = err instanceof EMLLibError ? err : new EMLLibError(ErrorType.FETCH_ERROR, `Error while sending stat event: ${err instanceof Error ? err.message : err}`)
      console.error(error)
    }
  }
}
