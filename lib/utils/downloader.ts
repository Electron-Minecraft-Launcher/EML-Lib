/**
 * @license MIT
 * @copyright Copyright (c) 2025, GoldFrite
 */

import { File } from '../../types/file'
import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import path_ from 'node:path'
import fetch from 'node-fetch'
import EventEmitter from '../utils/events'
import { DownloaderEvents } from '../../types/events'
import utils from './utils'
import { EMLLibError, ErrorType } from '../../types/errors'
import { chmod } from 'node:fs/promises'

export default class Downloader extends EventEmitter<DownloaderEvents> {
  private readonly CONCURRENCY_LIMIT = 5
  private readonly dest: string
  private size = 0
  private amount = 0
  private downloaded: { amount: number; size: number } = { amount: 0, size: 0 }
  private error = false
  private speed = 0
  private eta = 0
  private history: { size: number; time: number }[] = []

  /**
   * @param dest Destination folder.
   */
  constructor(dest: string) {
    super()
    this.dest = path_.join(dest)
  }

  /**
   * Download files from the list.
   * @param files List of files to download. This list must include folders.
   * @param skipCheck [Optional: default is `false`] Skip files that already exist in the
   * destination folder (force to download all files).
   */
  async download(files: File[], skipCheck: boolean = false) {
    const filesToDownload: File[] = !skipCheck ? await this.getFilesToDownload(files) : files

    this.size = filesToDownload.reduce((acc, curr) => acc + (curr.size ?? 0), 0)
    this.amount = filesToDownload.length
    this.downloaded = { amount: 0, size: 0 }
    this.error = false
    this.speed = 0
    this.eta = 0
    this.history = []

    if (this.size === 0 || filesToDownload.length === 0) {
      this.emit('download_end', { downloaded: this.downloaded })
      return
    }

    const queue = [...filesToDownload]

    const workers = Array(this.CONCURRENCY_LIMIT)
      .fill(null)
      .map(async () => {
        while (queue.length > 0) {
          const file = queue.shift()
          if (file) await this.downloadFileWithRetry(file)
        }
      })

    try {
      await Promise.all(workers)
      this.emit('download_end', { downloaded: this.downloaded })
    } catch (err) {
      throw err
    }
  }

  /**
   * Get files that need to be downloaded (files that don't exist or have different hash).
   * @param files List of files to check.
   * @returns List of files to download.
   */
  async getFilesToDownload(files: File[]) {
    let filesToDownload: File[] = []

    const promises = files.map(async (file) => {
      const filePath = path_.join(this.dest, file.path, file.name)

      if (file.type === 'FOLDER') {
        try {
          await fs.access(filePath)
        } catch {
          await fs.mkdir(filePath, { recursive: true })
        }
      }
      let needsDownload = false

      try {
        await fs.access(filePath)
        if (file.sha1 && file.sha1 !== await utils.getFileHash(filePath)) {
          needsDownload = true
        }
      } catch {
        needsDownload = true
      }

      if (needsDownload && file.url) {
        filesToDownload.push(file)
      }
    })

    await Promise.all(promises)

    return filesToDownload
  }

  private async downloadFileWithRetry(file: File, attempt = 0): Promise<void> {
    try {
      await this.downloadFile(file)
      this.downloaded.amount++
    } catch (err: any) {
      if (attempt < 5) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
        return this.downloadFileWithRetry(file, attempt + 1)
      } else {
        this.emit('download_error', {
          filename: file.name,
          type: file.type,
          message: err.message ?? err
        })
        throw new EMLLibError(ErrorType.DOWNLOAD_ERROR, `Failed to download ${file.name} after 5 attempts`)
      }
    }
  }

  private async downloadFile(file: File) {
    const dirPath = path_.join(this.dest, file.path)
    const filePath = path_.join(dirPath, file.name)
    let bytesDownloadedThisAttempt = 0

    await fs.mkdir(dirPath, { recursive: true })

    const res = await fetch(file.url, { headers: { Accept: 'application/octet-stream' } })

    if (!res.ok || !res.body) {
      throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while fetching ${file.name}: ${res.statusText}`)
    }

    const stream = fsSync.createWriteStream(filePath)

    return new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        res.body?.removeAllListeners()
        stream.removeAllListeners()
        stream.destroy()
      }
      res.body!.on('data', (chunk: Buffer) => {
        const now = Date.now()
        this.history.push({ size: chunk.length, time: now })
        while (this.history.length > 0 && now - this.history[0].time > 6000) {
          this.history.shift()
        }

        stream.write(chunk)

        bytesDownloadedThisAttempt += chunk.length
        this.downloaded.size += chunk.length

        const totalSampled = this.history.reduce((acc, curr) => acc + curr.size, 0)
        const elapsed = (now - this.history[0].time) / 1000
        this.speed = elapsed > 0 ? totalSampled / elapsed : 0
        this.eta = this.speed > 0 ? (this.size - this.downloaded.size) / this.speed : 0

        this.emit('download_progress', {
          total: { amount: this.amount, size: this.size },
          downloaded: this.downloaded,
          speed: this.speed,
          eta: Math.floor(this.eta),
          type: file.type
        })
      })

      res.body!.on('end', () => {
        stream.end()
      })

      res.body!.on('error', (err) => {
        this.downloaded.size -= bytesDownloadedThisAttempt
        cleanup()
        reject(err)
      })

      stream.on('finish', async () => {
        cleanup()
        try {
          await this.chmodJavaFiles(filePath, file)
          resolve()
        } catch (err) {
          reject(err)
        }
      })

      stream.on('error', (err) => {
        this.downloaded.size -= bytesDownloadedThisAttempt
        cleanup()
        reject(err)
      })
    })
  }

  private async chmodJavaFiles(filePath: string, file: File) {
    if (process.platform !== 'win32' && file.executable) {
      await fs.chmod(filePath, 0o755)
    }
  }
}
