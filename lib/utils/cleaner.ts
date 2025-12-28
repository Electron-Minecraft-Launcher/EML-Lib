/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 */

import EventEmitter from './events'
import path_ from 'node:path'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { CleanerEvents } from '../../types/events'
import { File } from '../../types/file'

export default class Cleaner extends EventEmitter<CleanerEvents> {
  private readonly dest: string = ''
  private browsed: { name: string; path: string }[] = []

  /**
   * @param dest Destination folder.
   */
  constructor(dest: string) {
    super()
    this.dest = path_.join(dest)
  }

  /**
   * Clean the destination folder by removing files that are not in the list.
   * @param files List of files to check ('ok' files; files that should be in the destination folder).
   * @param ignore List of files to ignore (don't delete them).
   * @param skipClean [Optional: default is `false`] Skip the cleaning process (skip this method).
   */
  async clean(files: File[], ignore: string[] = [], skipClean: boolean = false) {
    if (skipClean) return

    const validFilesSet = new Set(files.map((f) => path_.normalize(path_.join(this.dest, f.path, f.name))))
    const ignoredPaths = ignore.map((ig) => path_.normalize(path_.join(this.dest, ig)))

    const deletePromises: Promise<void>[] = []

    let i = 0
    this.browsed = []
    await this.browse(this.dest)

    for (const file of this.browsed) {
      const fullPath = path_.normalize(path_.join(file.path, file.name))
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

      // Can't check hash for performance reasons
    }

    await Promise.all(deletePromises)

    this.emit('clean_end', { amount: i })
  }

  private async browse(dir: string) {
    if (!existsSync(dir)) return

    const files = await fs.readdir(dir)

    const promises = files.map(async (file) => {
      const fullPath = path_.join(dir, file)
      const stats = await fs.stat(fullPath)

      if (stats.isDirectory()) {
        await this.browse(fullPath)
      } else {
        this.browsed.push({
          name: file,
          path: `${dir}/`.split('\\').join('/').replace(/^\/+/, '')
        })
      }
    })

    await Promise.all(promises)
  }
}
