/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 */

import EventEmitter from './events.js'
import path_ from 'node:path'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { CleanerEvents } from '../../types/events.js'
import { File } from '../../types/file.js'

export default class Cleaner extends EventEmitter<CleanerEvents> {
  private readonly dest: string = ''

  /**
   * @param dest Destination folder.
   */
  constructor(dest: string) {
    super()
    this.dest = path_.join(dest)
  }

  /**
   * Clean the destination folder by removing files that are not in the list.
   * @param files List of files to check ('ok' files; files that should be in the destination 
   * folder).
   * @param ignore List of files to ignore (don't delete them).
   * @param skipClean [Optional: defaults to `false`] Skip the cleaning process (skip this method).
   */
  async clean(files: File[], ignore: string[] = [], skipClean: boolean = false): Promise<void> {
    if (skipClean) return

    const validFilesSet = new Set(files.map((f) => path_.resolve('/', this.dest, f.path, f.name).replace(/\\/g, '/')))
    const ignoredPaths = ignore.map((ig) => path_.resolve(this.dest, ig))
    const deletePromises: Promise<void>[] = []
    let i = 0

    const browsed: { name: string; path: string }[] = []
    await this.browse(this.dest, browsed)
    for (const file of browsed) {
      const fullPath = path_.resolve('/', file.path, file.name).replace(/\\/g, '/')
      const isFileValid = validFilesSet.has(fullPath)
      const isIgnored = ignoredPaths.some((ig) => fullPath.startsWith(ig))
      if (!isFileValid && !isIgnored) {
        deletePromises.push(
          fs
            .unlink(fullPath)
            .then(() => {
              i++
              this.emit('clean_progress', { filename: file.name })
            })
            .catch((err) => {
              this.emit('clean_error', { filename: file.name, message: err })
            })
        )
      }

      // can't check hash for performance reasons
    }

    await Promise.all(deletePromises)

    this.emit('clean_end', { amount: i })
  }

  private async browse(dir: string, browsed: { name: string; path: string }[] = []) {
    if (!existsSync(dir)) return

    const files = await fs.readdir(dir)

    const promises = files.map(async (file) => {
      const fullPath = path_.join(dir, file)
      const stats = await fs.stat(fullPath)

      if (stats.isDirectory()) {
        await this.browse(fullPath, browsed)
      } else {
        browsed.push({
          name: file,
          path: `${dir}/`.split('\\').join('/').replace(/^\/+/, '')
        })
      }
    })

    await Promise.all(promises)
  }
}


