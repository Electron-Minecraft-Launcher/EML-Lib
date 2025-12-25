import { File } from './file'

export interface IBootstraps {
  updateAvailable: boolean
  currentVersion: string
  latestVersion: string
  updateInfo?: {
    releaseName?: string | null
    releaseNotes?: string | Array<{ version: string; note: string }> | null
    releaseDate: Date
  }
}

