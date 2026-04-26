export interface JavaConfig {
  /**
   * [Optional] The URL of your EML AdminTool instance. This endpoint provides the modpack 
   * manifest, loader information, and server settings.
   *
   * **Attention!** This property is ignored if a Minecraft version is explicitly defined (either 
   * in {@link minecraft `minecraft.version`}). If neither a URL nor a version is provided, the
   * launcher defaults to the latest Vanilla release.
   */
  url?: string
  /**
   * [Optional: defaults to `{ version: undefined }`]
   * Minecraft configuration.
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
  }
  /**
   * The name of the root game directory (e.g., `'minecraft'`). The launcher will automatically 
   * prefix this with a dot (e.g., `'.minecraft'`) under Windows.
   */
  root: string
}