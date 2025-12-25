export interface LauncherEvents {
  launch_compute_download: []
  launch_download: [
    {
      /**
       * The total size/amount of files to download.
       *
       * `total` parameter of `download_progress` event will be specific for each "type" of files:
       * Java, modpack, libraries and natives, and finally assets.
       */
      total: { amount: number; size: number }
    }
  ]
  launch_install_loader: [
    {
      type: 'VANILLA' | 'FORGE'
      minecraftVersion: string
      loaderVersion: string | null
      format: 'INSTALLER' | 'UNIVERSAL' | 'CLIENT'
    }
  ]
  launch_copy_assets: []
  launch_extract_natives: []
  launch_patch_loader: []
  launch_check_java: []
  launch_clean: []
  launch_launch: [{ version: string; type: 'VANILLA' | 'FORGE'; loaderVersion: string | null }]
  launch_data: [string]
  launch_close: [number]
  launch_debug: [string]
}

export interface FilesManagerEvents {
  extract_progress: [{ filename: string }]
  extract_end: [{ amount: number }]
  copy_progress: [{ filename: string; dest: string }]
  copy_end: [{ amount: number }]
  copy_debug: [string]
}

export interface JavaEvents {
  java_info: [{ version: string; arch: '32-bit' | '64-bit' }]
}

export interface CleanerEvents {
  clean_progress: [{ filename: string }]
  clean_error: [{ filename: string; message: Error | string }]
  clean_end: [{ amount: number }]
}

export interface PatcherEvents {
  patch_progress: [{ filename: string }]
  patch_error: [{ filename: string; message: Error | string }]
  patch_end: [{ amount: number }]
  patch_debug: [string]
}

export interface BootstrapsEvents {
  bootstraps_error: [{ message: string | Error }]
}

export interface DownloaderEvents {
  download_progress: [
    {
      total: { amount: number; size: number }
      downloaded: { amount: number; size: number }
      speed: number
      /**
       * @workInProgress Currently not working well.
       */
      type: string
    }
  ]
  download_error: [{ filename: string; type: string; message: Error | string }]
  download_end: [{ downloaded: { amount: number; size: number } }]
}

