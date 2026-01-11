/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 */

import { FullConfig } from '../../types/config'
import { MinecraftManifest } from '../../types/manifest'
import utils from '../utils/utils'
import path_ from 'node:path'
import { ExtraFile, ILoader } from '../../types/file'

export default class ArgumentsManager {
  private config: FullConfig
  private manifest: MinecraftManifest
  private loaderManifest: MinecraftManifest | null
  private loader: ILoader | null

  constructor(config: FullConfig, manifest: MinecraftManifest) {
    this.config = config
    this.manifest = manifest
    this.loaderManifest = null
    this.loader = null
  }

  /**
   * Get the arguments to launch the game.
   * @param libraries The libraries of the game (including loader libraries).
   * @returns The arguments to launch the game.
   */
  getArgs(libraries: ExtraFile[], loader: ILoader | null, loaderManifest: MinecraftManifest | null = null) {
    this.loaderManifest = loaderManifest
    this.loader = loader

    const jvmArgs = this.getJvmArgs(libraries)
    const mainClass = this.getMainClass()
    const minecraftArgs = this.getMinecraftArgs()

    return [...jvmArgs, mainClass, ...minecraftArgs]
  }

  private getJvmArgs(libraries: ExtraFile[]) {
    const nativeDirectory = path_.join(this.config.root, 'bin', 'natives').replaceAll('\\', '/')
    const libraryDirectory = path_.join(this.config.root, 'libraries').replaceAll('\\', '/')
    const classpath = this.getClasspath(libraries)

    let args: string[] = this.config.java?.args || []

    if (this.manifest.arguments?.jvm) {
      ;[...this.manifest.arguments.jvm, ...(this.loaderManifest?.arguments!.jvm || [])].forEach((arg) => {
        if (typeof arg === 'string') {
          args.push(arg)
        } else if (arg.rules && utils.isArgAllowed(arg)) {
          if (typeof arg.value === 'string') {
            args.push(arg.value)
          } else {
            args.push(...arg.value)
          }
        }
      })
    } else {
      args.push('-Djava.library.path=${natives_directory}')
      args.push('-Dminecraft.launcher.brand=${launcher_name}')
      args.push('-Dminecraft.launcher.version=${launcher_version}')
      args.push('-Dminecraft.client.jar=${jar_path}')
      args.push('-cp')
      args.push('${classpath}')
      if (utils.getOS() === 'win' && +utils.getOSVersion().split('.')[0] >= 10) args.push('-Dos.name=Windows 10 -Dos.version=10.0')
      if (utils.getOS() === 'win') args.push('-XX:HeapDumpPath=MojangTricksIntelDriversForPerformance_javaw.exe_minecraft.exe.heapdump')
      if (utils.getOS() === 'mac') args.push('-XstartOnFirstThread')
      if (utils.getArch() === '32') args.push('-Xss1M')
    }

    args.push(...this.getLog4jArgs())
    args.push('-Xmx${max_memory}M')
    args.push('-Xms${min_memory}M')
    args.push('-Dfml.ignoreInvalidMinecraftCertificates=true')

    return args.map((arg) =>
      arg
        .replaceAll('${natives_directory}', nativeDirectory)
        .replaceAll('${library_directory}', libraryDirectory)
        .replaceAll('${launcher_name}', `${this.config.serverId}-launcher`)
        .replaceAll('${launcher_version}', '2')
        .replaceAll('${version_name}', this.manifest.id)
        .replaceAll('${jar_path}', path_.join(this.config.root, 'versions', this.manifest.id, `${this.manifest.id}.jar`).replaceAll('\\', '/'))
        .replaceAll('${classpath}', classpath)
        .replaceAll('${max_memory}', this.config.memory.max + '')
        .replaceAll('${min_memory}', this.config.memory.min + '')
        .replaceAll('${classpath_separator}', path_.delimiter)
    )
  }

  /**
   * Patch Log4j vulnerability.
   * @see [help.minecraft.net](https://help.minecraft.net/hc/en-us/articles/4416199399693-Security-Vulnerability-in-Minecraft-Java-Edition)
   */
  private getLog4jArgs() {
    let args: string[] = []

    if (this.manifest.id === '1.18' || this.manifest.id.startsWith('1.17')) {
      args.push('-Dlog4j2.formatMsgNoLookups=true')
    } else if (+this.manifest.id.split('.')[1] <= 16 && +this.manifest.id.split('.')[1] >= 12) {
      args.push('-Dlog4j.configurationFile=log4j2_112-116.xml')
    } else if (+this.manifest.id.split('.')[1] <= 11 && +this.manifest.id.split('.')[1] >= 7) {
      args.push('-Dlog4j.configurationFile=log4j2_17-111.xml')
    }

    return args
  }

  private getMinecraftArgs() {
    const gameDirectory = path_.join(this.config.root).replaceAll('\\', '/')
    const assetsDirectory =
      this.manifest.assets === 'legacy' || this.manifest.assets === 'pre-1.6'
        ? path_.join(this.config.root, 'ressources').replaceAll('\\', '/')
        : path_.join(this.config.root, 'assets').replaceAll('\\', '/')

    let args: string[] = this.config.minecraft?.args || []

    if (this.manifest.arguments?.game) {
      ;[...this.manifest.arguments.game, ...(this.loaderManifest?.arguments!.game || [])].forEach((arg) => {
        if (typeof arg === 'string') {
          args.push(arg)
        } else if (arg.rules && utils.isArgAllowed(arg)) {
          if (typeof arg.value === 'string') {
            args.push(arg.value)
          } else {
            args.push(...arg.value)
          }
        }
      })
    } else if (this.manifest.minecraftArguments) {
      args.push(...(this.loaderManifest?.minecraftArguments || this.manifest.minecraftArguments).split(' '))
    }

    if (this.config.window.fullscreen) {
      args.push('--fullscreen')
    } else {
      args.push('--width')
      args.push('${resolution_width}')
      args.push('--height')
      args.push('${resolution_height}')
    }

    return [...new Set(args)].map(
      (arg) =>
        arg
          .replaceAll('${clientid}', this.config.account.clientToken || this.config.account.accessToken)
          .replaceAll('${auth_xuid}', this.config.account.xbox?.xuid || this.config.account.accessToken)
          .replaceAll('${auth_player_name}', this.config.account.name)
          .replaceAll('${auth_uuid}', this.config.account.uuid)
          .replaceAll('${auth_access_token}', this.config.account.accessToken)
          .replaceAll(
            '${user_type}',
            this.manifest.id.startsWith('1.16') && this.config.account.meta.type === 'msa' ? 'Xbox' : this.config.account.meta.type
          )
          .replaceAll('${version_name}', this.manifest.id)
          .replaceAll('${game_directory}', gameDirectory)
          .replaceAll('${assets_root}', assetsDirectory)
          .replaceAll('${assets_index_name}', this.manifest.assetIndex.id)
          .replaceAll('${version_type}', this.manifest.type)
          .replaceAll('${resolution_width}', this.config.window.width + '')
          .replaceAll('${resolution_height}', this.config.window.height + '')
          .replaceAll('${auth_session}', this.config.account.accessToken) // legacy
          .replaceAll('${user_properties}', JSON.stringify(this.config.account.userProperties || {})) // legacy
          .replaceAll('${game_assets}', assetsDirectory) // legacy
    )
  }

  // private getClasspath(libraries: ExtraFile[]) {
  //   let classpath: string[] = []

  //   libraries = [...new Set(libraries)]

  //   for (let i = 0; i < libraries.length; i++) {
  //     const lib = libraries[i]
  //     if (lib.extra === 'INSTALL') continue
  //     if (lib.type === 'LIBRARY') {
  //       const path = path_.join(this.config.root, lib.path, lib.name).replaceAll('\\', '/')
  //       const check = libraries.find(
  //         (l, j) =>
  //           l.path.replaceAll('/', '\\').split('\\').slice(0, -2).join('/') === lib.path.replaceAll('/', '\\').split('\\').slice(0, -2).join('/') &&
  //           !l.path.startsWith('versions') &&
  //           i !== j &&
  //           l.extra !== 'INSTALL'
  //       )
  //       if (check && utils.isNewer(lib, check)) continue
  //       classpath.push(path)
  //     }
  //   }

  //   return [...new Set([...classpath])].join(path_.delimiter)
  // }

  private getClasspath(libraries: ExtraFile[]) {
    const classpath: string[] = []

    libraries = [...new Set(libraries)]

    for (let i = 0; i < libraries.length; i++) {
      const lib = libraries[i]
      if (lib.extra === 'INSTALL') continue
      if (lib.type !== 'LIBRARY') continue

      const betterVersionExists = libraries.find((otherLib, otherIndex) => {
        if (i === otherIndex) return false
        if (otherLib.extra === 'INSTALL') return false

        return utils.isNewer(lib, otherLib) === true
      })

      if (betterVersionExists) continue

      const path = path_.join(this.config.root, lib.path, lib.name).replaceAll('\\', '/')
      classpath.push(path)
    }

    return [...new Set(classpath)].join(path_.delimiter)
  }

  // private getClasspath(libraries: ExtraFile[]) {
  //   // Clé : L'identifiant unique de la lib (Groupe + Nom) sans la version
  //   // Valeur : Le fichier de la librairie (le plus récent trouvé)
  //   const bestVersions = new Map<string, ExtraFile>()

  //   for (const lib of libraries) {
  //     if (lib.extra === 'INSTALL') continue
  //     if (lib.type !== 'LIBRARY') continue

  //     // 1. On détermine l'identifiant de l'artefact (le dossier parent de la version)
  //     // Ex: "libraries/org/ow2/asm/asm/9.9/" devient "libraries/org/ow2/asm/asm"
  //     // On normalise les slashs et on retire le slash de fin pour que dirname fonctionne bien
  //     const cleanPath = lib.path.replace(/\\/g, '/').replace(/\/$/, '')
  //     const artifactId = path_.dirname(cleanPath)

  //     // 2. Logique de "Roi de la colline"
  //     if (!bestVersions.has(artifactId)) {
  //       // C'est la première fois qu'on voit cette lib, on l'ajoute
  //       bestVersions.set(artifactId, lib)
  //     } else {
  //       // On a déjà une version stockée. Est-ce que la nouvelle (lib) est plus récente ?
  //       const currentBest = bestVersions.get(artifactId)!

  //       // Si 'lib' est plus récent que 'currentBest', il prend sa place
  //       if (utils.isNewer(currentBest, lib)) {
  //         bestVersions.set(artifactId, lib)
  //       }
  //     }
  //   }

  //   // 3. On génère le tableau de chemins final
  //   const classpath = Array.from(bestVersions.values()).map((lib) => {
  //     return path_.join(this.config.root, lib.path, lib.name).replaceAll('\\', '/')
  //   })

  //   return classpath.join(path_.delimiter)
  // }

  private getMainClass() {
    return this.loaderManifest?.mainClass ?? this.manifest.mainClass
  }
}
