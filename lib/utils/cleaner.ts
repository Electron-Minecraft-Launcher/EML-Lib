/**
 * @license MIT
 * @copyright Copyright (c) 2025, GoldFrite
 */

import EventEmitter from './events'
import path_ from 'node:path'
import fs from 'node:fs'
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
  clean(files: File[], ignore: string[] = [], skipClean: boolean = false) {
    if (skipClean) return 

    let i = 0
    this.browsed = []
    this.browse(this.dest)

    this.browsed.forEach((file) => {
      const fullPath = path_.join(file.path, file.name)
      if (
        !files.find((f) => path_.join(this.dest, f.path, f.name) === fullPath) &&
        !ignore.find((ig) => fullPath.startsWith(path_.join(this.dest, ig)))
      ) {
        fs.unlinkSync(fullPath)
        i++
        this.emit('clean_progress', { filename: file.name })
      }
      // Can't check hash for performance reasons
    })

    this.emit('clean_end', { amount: i })
  }

  private browse(dir: string): void {
    if (!fs.existsSync(dir)) return

    const files = fs.readdirSync(dir)

    files.forEach((file) => {
      if (fs.statSync(path_.join(dir, file)).isDirectory()) {
        this.browse(path_.join(dir, file))
      } else {
        this.browsed.push({
          name: file,
          path: `${dir}/`.split('\\').join('/').replace(/^\/+/, '')
        })
      }
    })
  }
}
