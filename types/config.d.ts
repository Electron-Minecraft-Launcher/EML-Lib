import { Account } from './account.js'
import { IProfile } from './profile.js'

export interface Config {
  /**
   * [Optional] The URL of your EML AdminTool instance. This endpoint provides the modpack
   * manifest, loader information, and server settings.
   *
   * **Attention!** This property is ignored if a Minecraft version is explicitly defined (either
   * in {@link minecraft `minecraft.version`} or {@link profile `profile.minecraft.version`}). If
   * neither a URL nor a version is provided, the launcher defaults to the latest Vanilla release.
   */
  url?: string

  /**
   * [Optional] The specific profile to launch. It is recommended to retrieve this object via
   * `Profiles.getProfiles()`.
   *
   * **Attention!** When you set a manual profile, you must ensure the profile contains a valid
   * `slug`. This slug determines the name of the game instance folder.
   */
  profile?: IProfile & {
    /**
     * [Optional: defaults to `{ version: undefined, args: [] }`]
     * Instance-specific Minecraft configuration.
     *
     * **Attention!** If defined, this block takes precedence over the root
     * {@link minecraft `minecraft`} configuration and any data fetched from the EML AdminTool.
     */
    minecraft?: {
      /**
       * [Optional] The Minecraft version to install (e.g., `'1.20.1'`). Use `'latest_release'` or
       * `'latest_snapshot'` for the most recent versions.
       *
       * **Attention!** Providing this value forces the launcher into to ignore the
       * {@link url `url`} property.
       *
       * @see [List of Minecraft versions](https://emlproject.pages.dev/resources/minecraft-versions/)
       */
      version?: string
      /**
       * [Optional: defaults to `{ loader: 'vanilla', version: undefined }` if
       * `profile.minecraft.version` is set, otherwise `undefined`]
       * The mod loader configuration for this profile.
       *
       * **Attention!** This property is ignored if `profile.minecraft.version` is not set.
       */
      loader?: {
        /**
         * [Optional: defaults to `'vanilla'`]
         * The type of mod loader to utilize.
         */
        loader: 'vanilla' | 'forge' | 'neoforge' | 'fabric' | 'quilt'
        /**
         * [Optional] The specific version of the loader. This is required for any loader other
         * than `'vanilla'`.
         *
         * @see [List of loader versions](https://emlproject.pages.dev/resources/loader-versions/)
         */
        version?: string
      }
      /**
       * [Optional] The direct URL to a modpack manifest (.json).
       *
       * **Attention!** This property is ignored if `profile.minecraft.version` is not set.
       *
       * @see [Modpack JSON Generator](https://emlproject.pages.dev/resources/modpack-json-generator/)
       */
      modpackUrl?: string
      /**
       * [Optional: defaults to `[]`]
       * Custom Minecraft launch arguments.
       * **Use this option only if you know what you are doing!**
       */
      args?: string[]
    }
  }

  /**
   * @deprecated Use the {@link storage `storage`} property instead.
   */
  storageMode?: 'isolated' | 'shared'
  /**
   * [Optional: defaults to `'isolated'`]
   * Defines how game files are organized on the disk.
   * - `'isolated'`: Each profile has its own completely separate folder (e.g., `.root/slug/` if
   * you use the {@link profile `profile`} property, `.root/` otherwise).
   * - `'shared'`: Profiles share common assets and libraries, but keep `mods`, `config`, and
   * `saves` in separate sub-folders.
   *
   * **Attention!** If you use `storage: 'shared'`, you should disable the {@link cleaning cleaning} (with `cleaning.enabled: false`) to avoid deleting the shared assets and libraries when launching different profiles.
   */
  storage?: 'isolated' | 'shared'

  /**
   * @deprecated Use the {@link root `root`} property instead.
   */
  serverId?: string
  /**
   * The name of the root game directory (e.g., `'minecraft'`). The launcher will automatically
   * prefix this with a dot (e.g., `'.minecraft'`) under Windows.
   */
  root?: string

  /**
   * [Optional: defaults to `{ version: undefined, args: [] }`]
   * Global Minecraft configuration.
   *
   * **Attention!** This configuration is overridden if {@link profile `profile.minecraft`} is
   * defined with a valid version. Setting `minecraft.version` will bypass the EML AdminTool data.
   */
  minecraft?: {
    /**
     * [Optional] The Minecraft version to install (e.g., `'1.20.1'`). Use `'latest_release'` or
     * `'latest_snapshot'` for the most recent versions.
     *
     * **Attention!** Providing this value forces the launcher into to ignore the {@link url `url`}
     * property.
     *
     * @see [List of Minecraft versions](https://emlproject.pages.dev/resources/minecraft-versions/)
     */
    version?: string
    /**
     * [Optional: defaults to `{ loader: 'vanilla', version: undefined }` if `minecraft.version` is
     * set, otherwise `undefined`]
     * The mod loader configuration for this profile.
     *
     * **Attention!** This property is ignored if you don't set `minecraft.version`.
     */
    loader?: {
      /**
       * [Optional: defaults to `'vanilla'`]
       * The loader to use for the Minecraft instance.
       */
      loader: 'vanilla' | 'forge' | 'neoforge' | 'fabric' | 'quilt'
      /**
       * [Optional] The specific version of the loader. This is required for any loader other than
       * `'vanilla'`.
       *
       * @see [List of loader versions](https://emlproject.pages.dev/resources/loader-versions/)
       */
      version?: string
    }
    /**
     * [Optional] The direct URL to a modpack manifest (.json).
     *
     * **Attention!** This property is ignored if `minecraft.version` is not set.
     *
     * @see [Modpack JSON Generator](https://emlproject.pages.dev/resources/modpack-json-generator/)
     */
    modpackUrl?: string
    /**
     * Optional: defaults to `[]`]
     * Custom Minecraft launch arguments.
     * **Use this option only if you know what you are doing!**
     */
    args?: string[]
  }

  /**
   * [Optional: defaults to `{ enabled: true, ignored: [...] }`]
   * Configuration for the directory cleaning process before launch.
   */
  cleaning?: {
    /**
     * @deprecated Use the `enabled` property instead to enable or disable the cleaning.
     */
    clean?: boolean
    /**
     * [Optional: defaults to `true`]
     * Whether the launcher should remove unrecognized files from the instance folder.
     *
     * **Attention!** Must be `false` when {@link storage `storage`} is set to 'shared'.
     */
    enabled?: boolean
    /**
     * [Optional: defaults to `['crash-reports/', 'logs/', 'resourcepacks/', 'resources/', 
     * 'saves/', 'shaderpacks/', 'options.txt', 'optionsof.txt']`]
     * A list of relative paths or files to protect from the cleaning process.
     */
    ignored?: string[]
  }

  /**
   * The authenticated player account. Use `MicrosoftAuth`, `AzAuth`, `YggdrasilAuth`, or
   * `CrackAuth` to generate this.
   */
  account: Account

  /**
   * [Optional: default automatically manages Java runtimes]
   * Java Runtime Environment (JRE) configuration.
   */
  java?: {
    /**
     * [Optional: defaults to `'auto'`]
     * - `'auto'`: Automatically downloads and manages the required Java version.
     * - `'manual'`: Uses a pre-installed Java executable.
     */
    install?: 'auto' | 'manual'
    /**
     * [Optional: defaults to `'java'` if `java.install` is set to `'manual'`, otherwise
     * `undefined`]
     * The absolute path to the Java executable. Required if `install` is `'manual'` and
     * `relativePath` is not provided.
     *
     * **Attention!** Overrides `java.relativePath`. Ignored if `install` is `'auto'`.
     */
    absolutePath?: string
    /**
     * [Optional: defaults to `'runtime/jre-X/bin/java'` where `X` is the major version of Java]
     * The path to the Java executable relative to the game `root` or `root/slug`.
     *
     * **Attention!** Ignored if `install` is `'auto'` or `absolutePath` is set.
     */
    relativePath?: string
    /**
     * [Optional: defaults to `[]`]
     * Custom JVM (Java Virtual Machine) arguments.
     * **Use this option only if you know what you are doing!**
     *
     * **Attention!** Do not use this for [Log4j patches]((https://help.minecraft.net/hc/en-us/articles/4416199399693-Security-Vulnerability-in-Minecraft-Java-Edition)); the launcher applies security patches automatically.
     */
    args?: string[]
  }

  /**
   * [Optional: defaults to 854x480]
   * Configuration for the Minecraft game window.
   */
  window?: {
    /**
     * [Optional: defaults to `854`]
     * The width of the Minecraft window.
     */
    width?: number
    /**
     * [Optional: defaults to `480`]
     * The height of the Minecraft window.
     */
    height?: number
    /**
     * [Optional: defaults to `false`]
     * Should the Minecraft window be fullscreen?
     */
    fullscreen?: boolean
  }

  /**
   * [Optional: defaults to `{ min: 512, max: 1023 }`]
   * RAM allocation for the Minecraft process (in MB).
   */
  memory?: {
    /**
     * [Optional: defaults to `512`]
     * The minimum memory (RAM), in **MB**, allocated to Minecraft.
     */
    min: number
    /**
     * [Optional: defaults to `1023`]
     * The maximum memory (RAM), in **MB**, allocated to Minecraft.
     */
    max: number
  }
}

export interface ResolvedConfig {
  url?: string
  slug?: string
  storage: 'isolated' | 'shared'
  root: string
  minecraft: {
    version?: string
    loader?: {
      loader: 'vanilla' | 'forge' | 'neoforge' | 'fabric' | 'quilt'
      version: string
    }
    modpackUrl?: string
    args: string[]
  }
  cleaning: {
    enabled: boolean
    ignored: string[]
  }
  account: Account
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

