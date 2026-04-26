import { File } from './file.js'

export interface IBootstrap {
  updateAvailable: boolean
  currentVersion: string
  latestVersion: string
  updateInfo?: {
    releaseName?: string | null
    releaseNotes?: string | Array<{ version: string; note: string }> | null
    releaseDate: Date
  }
}

export type IBootstraps = IBootstrap

