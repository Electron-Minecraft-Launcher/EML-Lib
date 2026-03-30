import { Account } from './account.js'
import { IProfile } from './profile.js'

export interface Config {
  /**
   * [Optional] The URL of your EML AdminTool website, where is stored your modpack and loader info. If
   * you don't set this value, the launcher will use the vanilla version of Minecraft (loaders such as
   * Forge or Fabric are only available through the EML AdminTool).
   */
  url?: string
  /**
   * [Optional] The profile of the Minecraft instance to launch. You should choose a profile form
   * `Profiles.getProfiles()` to be sure to get the correct profile. If you don't set this value, the
   * launcher will use the default profile from EML AdminTool.
   */
  profile?: IProfile
  /**
   * [Optional: default is `'isolated'`] 
   * The storage mode of the launcher. If you set this value to `'shared'`, the launcher will use the 
   * same game folder for all the profiles, which means that the different profiles will share the same 
   * assets, libraries, etc., but mods, configurations and saves will be separated in different 
   * folders. If you set this value to `'isolated'`, the launcher will create a separate game folder 
   * for each profile (e.g. `.minecraft/profile1`) and the profiles will not share anything.
   * 
   * **Attention!** If you use `storageMode: 'shared'`, you should disable the cleaning (with 
   * `cleaning.enabled: false`) to avoid deleting the shared assets and libraries when launching 
   * different profiles.
   */
  storageMode?: 'isolated' | 'shared' // TODO: replace with storage instead of storageMode
  /**
   * Your Minecraft server ID (e.g. `'minecraft'`). This will be used to create the
   * server folder (e.g. `.minecraft`).
   * @deprecated Use `root` property instead to set the game folder directly.
   */
  serverId?: string
  /**
   * The name of the game folder, **without the dot** (e.g. `'minecraft'`). This will be used to create
   * the server folder (e.g. `.minecraft`).
   */
  root?: string
  /**
   * [Optional: default is `{ clean: true, ignored: ['runtime/', 'crash-reports/', 'logs/',
   * 'resourcepacks/', 'resources/', 'saves/', 'shaderpacks/', 'options.txt', 'optionsof.txt'] }`]
   * The cleaning configuration, used to clean the game folder before launching the Minecraft game.
   */
  cleaning?: {
    /**
     * [Optional: default is `true`]
     * Should the launcher clean the game folder before launching the Minecraft game? In most cases,
     * you should set this value to `true`. Set this value to `false` if you want to keep allow the
     * players to keep their mods, resource packs, etc., or if you want to install multiple
     * instances of Minecraft on the same game folder.
     * @deprecated Use `enabled` property instead to enable or disable the cleaning.
     */
    clean?: boolean
    /**
     * [Optional: default is `true`]
     * Should the launcher clean the game folder before launching the Minecraft game? In most cases,
     * you should set this value to `true`. Set this value to `false` if you want to keep allow the
     * players to keep their mods, resource packs, etc., or if you want to install multiple
     * instances of Minecraft on the same game folder.
     * 
     * **Attention!** You should disable the cleaning if you use `storageMode: 'shared'`.
     */
    enabled?: boolean
    /**
     * [Optional: default is `['crash-reports/', 'logs/', 'resourcepacks/', 'resources/',
     * 'saves/', 'shaderpacks/', 'options.txt', 'optionsof.txt']`]
     * The list of paths/files to ignore when checking and cleaning the game folder, before launching
     * the Minecraft game.
     */
    ignored?: string[]
  }
  /**
   * The player account (use `MicrosoftAuth`, `AzAuth` `YggdrasilAuth` or `CrackAuth` to get the account,
   * but you should **not** authenticate the user directly in the `config`, to be able to handle
   * authentication).
   */
  account: Account
  /**
   * [Optional: default is `{ version: 'latest_release', args: [] }`]
   * Minecraft configuration.
   *
   * **Attention!** Setting `minecraft.version` overrides the Minecraft version from the EML AdminTool.
   * Moreover, if you want to use a loader (like Forge), you **must** use the EML AdminTool.
   */
  minecraft?: {
    /**
     * [Optional: default is `null`]
     * The version of Minecraft you want to install. Set to `'latest_release'` to install the
     * latest release version of Minecraft, or `'latest_snapshot'` to install the latest snapshot.
     * Set to `null` or `undefined` to get the version from the EML AdminTool.
     */
    version?: string | null
    /**
     * [Optional: default is `[]`]
     * **Use this option only if you know what you are doing!** Add custom arguments to launch Minecraft.
     */
    args?: string[]
  }
  /**
   * [Optional: default automatically installs Java when calling `Launcher.launch()`]
   * Java configuration.
   */
  java?: {
    /**
     * [Optional: default is `'auto'`]
     * Should the launcher install Java automatically? `'auto'` automatically installs Java when
     * calling `Launcher.launch()`. `'manual'` does not install Java automatically. You can use
     * `Java.download()` to install Java manually.
     */
    install?: 'auto' | 'manual'
    /**
     * [Optional: default is `undefined`]
     * The absolute path to the Java executable.
     * If you use a manual installation of Java with a custom path, you can set it here. Be careful
     * to indicate the correct path depending on the operating system of the user.
     * If you don't install Java (automatically or manually), set this value to `'java'` to use the
     * Java installed on the user's computer.
     *
     * **Attention!** This property overrides the `java.relativePath` property.
     */
    absolutePath?: string
    /**
     * [Optional: default is `'runtime/jre-X/bin/java'` where `X` is the major version of Java]
     * The path (relative to the game folder) to the Java executable.
     * If you use a manual installation of Java with a custom path, or if you don't install Java,
     * (automatically or manually) use `java.absolutePath` property instead.
     *
     * **Attention!** This property is ignored if `java.absolutePath` is set.
     */
    relativePath?: string
    /**
     * [Optional: default is `[]`]
     * **Use this option only if you know what you are doing!** Add custom arguments to Java
     * Virtual Machine (JVM).
     *
     * **Please don't try to patch [Log4j](https://help.minecraft.net/hc/en-us/articles/4416199399693-Security-Vulnerability-in-Minecraft-Java-Edition)
     * with this option!** The launcher will automatically patch Log4j if needed.
     */
    args?: string[]
  }
  /**
   * [Optional: default is a 854x480 window]
   * The Minecraft window configuration.
   */
  window?: {
    /**
     * [Optional: default is `854`]
     * The width of the Minecraft window.
     */
    width?: number
    /**
     * [Optional: default is `480`]
     * The height of the Minecraft window.
     */
    height?: number
    /**
     * [Optional: default is `false`]
     * Should the Minecraft window be fullscreen?
     */
    fullscreen?: boolean
  }
  /**
   * [Optional: default is `{ min: 1024, max: 2048 }`]
   * The memory (RAM) configuration.
   */
  memory?: {
    /**
     * [Optional: default is `512`]
     * The minimum memory (RAM), in **MB**, allocated to Minecraft.
     */
    min: number
    /**
     * [Optional: default is `1023`]
     * The maximum memory (RAM), in **MB**, allocated to Minecraft.
     */
    max: number
  }
}

export interface FullConfig {
  url: string
  profile?: IProfile
  storageMode: 'isolated' | 'shared'
  root: string
  cleaning: {
    enabled: boolean
    ignored: string[]
  }
  account: Account
  minecraft: {
    version: string | null
    args: string[]
  }
  java: {
    install: 'auto' | 'manual'
    absolutePath: string
    args: string[]
  }
  window: {
    width: number
    height: number
    fullscreen: boolean
  }
  memory: {
    min: number
    max: number
  }
}

