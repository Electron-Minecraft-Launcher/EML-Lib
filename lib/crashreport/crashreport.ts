import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import zlib from 'node:zlib'
import { promisify } from 'node:util'
import { EMLLibError, ErrorType } from '../../types/errors.js'
import Launcher from '../launcher/launcher.js'
import { CrashData } from '../../types/crashdata.js'
import utils from '../utils/utils.js'
import { spawn } from 'node:child_process'

const gzip = promisify(zlib.gzip)

export default class CrashReport {
  private readonly url: string
  private token: string | null = null

  /**
   * Send game crash reports to EML AdminTool. Ensure to initialize this class only **once** in
   * the launcher.
   *
   * **Note:** This class is useless if you close the launcher before the game crashes, because
   * the crash report will not be sent to the server.
   *
   * **Attention!** This class only works with EML AdminTool. Please do not use it without the it.
   *
   * ---
   *
   * Note for European users:
   *
   * To be compliant with the [GDPR](https://gdpr-info.eu/), **never send crash reports without**
   * the user's consent. You should ask the user for consent before sending any crash reports, and
   * only send crash reports if the user has given their consent. This class automatically hides
   * the user's username and token from the crash report, so that it does not send any personally
   * identifiable information.
   *
   * ---
   *
   * @param url The URL of your EML AdminTool website.
   */
  constructor(url: string) {
    this.url = `${url}/api`
  }

  /**
   * Send the crash report to EML AdminTool. This method should be called when the game crashes,
   * and only if the user has given their consent to send crash reports. This method will read the
   * latest.log file and the latest crash report file, sanitize them, and send them to the server.
   * @param launcher The Launcher instance used to launch the game.
   * @param crashData The crash data emited by the `launch_crash` event of the Launcher.
   */
  async send(launcher: Launcher, crashData: CrashData): Promise<void> {
    try {
      const logs = await this.readLogs(launcher, crashData)
      const sanLauncherLogs = this.sanitizeText(logs.launcherLogs, launcher)
      const sanLaunchArgs = this.sanitizeText(logs.launchArgs, launcher)
      const sanCrashReportLog = this.sanitizeText(logs.crashReportLog, launcher)
      const sanLatestLog = this.sanitizeText(logs.latestLog, launcher)
      const javaInfo = await this.checkJava(crashData.javaPath)

      const formattedLogs = `=== LAUNCHER LOGS ===
${sanLauncherLogs}

=== LAUNCH ARGUMENTS ===
${sanLaunchArgs}

=== CRASH REPORT LOG ===
${sanCrashReportLog}

=== LATEST LOG ===
${sanLatestLog}
`

      const compressedBuffer = await gzip(Buffer.from(formattedLogs, 'utf-8'))
      const logData = compressedBuffer.toString('base64')

      const payload = {
        metadata: {
          date: crashData.date,
          os: utils.getOS(),
          arch: utils.getArch(),
          javaVersion: javaInfo.version ?? 'unknown',
          javaArch: javaInfo.arch ?? 'unknown',
          profile: launcher.config.slug ?? '',
          version: launcher.config.minecraft.version ?? 'unknown',
          loader: launcher.config.minecraft.loader?.loader ?? 'vanilla',
          loaderVersion: launcher.config.minecraft.loader?.version ?? '',
          minRam: launcher.config.memory.min ?? null,
          maxRam: launcher.config.memory.max ?? null,
          exitCode: crashData.code
        },
        logData
      }

      await this.transmit(payload)
    } catch (err) {
      const error =
        err instanceof EMLLibError
          ? err
          : new EMLLibError(ErrorType.UNKNOWN_ERROR, `Crash report transmission failed: ${err instanceof Error ? err.message : err}`)
      throw error
    }
  }

  private async readLogs(
    launcher: Launcher,
    crashData: CrashData
  ): Promise<{
    launcherLogs: string
    launchArgs: string
    crashReportLog: string
    latestLog: string
  }> {
    let launcherLogs = launcher.launcherLogs.join('\n')
    let launchArgs = launcher.launchArgs.join(' ')
    let latestLog = ''
    let crashReportLog = ''

    try {
      latestLog = await fs.readFile(crashData.logsPath, 'utf-8')
    } catch {
      latestLog = 'File latest.log not found or inaccessible.'
    }

    try {
      const files = await fs.readdir(crashData.crashReportsDir)
      const txtFiles = files
        .filter((f) => f.endsWith('.txt'))
        .sort()
        .reverse()

      if (txtFiles.length > 0) {
        crashReportLog = await fs.readFile(path.join(crashData.crashReportsDir, txtFiles[0]), 'utf-8')
      }
    } catch {
      crashReportLog = 'No dedicated crash report file found.'
    }

    return {
      launcherLogs,
      launchArgs,
      crashReportLog,
      latestLog
    }
  }

  private async checkJava(javaPath: string) {
    return new Promise((resolve, reject) => {
      const process = spawn(javaPath, ['-version'])
      let output = ''

      process.stdout.on('data', (data) => {
        output += data.toString()
      })
      process.stderr.on('data', (data) => {
        output += data.toString()
      })
      process.on('error', (err) => {
        output = 'unknown'
      })
      process.on('close', (code) => {
        if ((code !== 0 && output.length === 0) || output === 'unknown') {
          resolve({ version: undefined, arch: undefined })
        }

        const versionMatch = output.match(/"(.*?)"/)
        const version = versionMatch ? versionMatch.pop() : 'unknown'
        const arch = output.includes('64-Bit') ? '64-bit' : '32-bit'
        resolve({ version: version!, arch: arch as '64-bit' | '32-bit' })
      })
    }) as Promise<{
      version?: string
      arch?: '64-bit' | '32-bit'
    }>
  }

  private sanitizeText(text: string, launcher: Launcher): string {
    let cleaned = text

    const username = os.userInfo().username
    const userDirname = os.userInfo().homedir.replaceAll('\\', '/').split('/').pop()
    const pseudo = launcher.config.account.name
    const uuid = launcher.config.account.uuid

    const sensitiveStrings: { target: string; mask: string }[] = []

    if (username && username.length > 1) sensitiveStrings.push({ target: username, mask: '<USER>' })
    if (userDirname && userDirname.length > 1) sensitiveStrings.push({ target: userDirname, mask: '<USER>' })
    if (pseudo && pseudo.length > 1) sensitiveStrings.push({ target: pseudo, mask: '<PSEUDO>' })
    if (uuid && uuid.length > 1) sensitiveStrings.push({ target: uuid, mask: '<UUID>' })

    const sensitiveKeys = ['--accessToken', '--uuid', '--clientId']
    for (const key of sensitiveKeys) {
      const index = launcher.launchArgs.indexOf(key)
      if (index !== -1 && launcher.launchArgs[index + 1]) {
        sensitiveStrings.push({ target: launcher.launchArgs[index + 1], mask: '<TOKEN>' })
      }
    }

    sensitiveStrings.sort((a, b) => b.target.length - a.target.length)

    for (const { target, mask } of sensitiveStrings) {
      const escapedTarget = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      cleaned = cleaned.replace(new RegExp(escapedTarget, 'gi'), mask)
    }

    cleaned = cleaned.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '<IP>')
    cleaned = cleaned.replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '<JWT>')

    return cleaned
  }

  private async transmit(payload: Record<string, any>): Promise<void> {
    const token = await this.getAuthToken()
    if (!token) {
      throw new EMLLibError(ErrorType.FETCH_ERROR, 'Failed to obtain authentication token for crash report transmission.')
    }

    const req = await fetch(`${this.url}/crash-reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    })

    if (!req.ok) {
      const errorText = await req.text()
      throw new EMLLibError(ErrorType.FETCH_ERROR, `HTTP ${req.status} ${errorText}`)
    }
  }

  private async getAuthToken(): Promise<string | null> {
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

      const req = await fetch(`${this.url}/crash-reports/handshake`)

      if (!req.ok) {
        return null
      }
      const data: { token: string } = await req.json()
      this.token = data.token
      return this.token
    } catch {
      return null
    }
  }
}
