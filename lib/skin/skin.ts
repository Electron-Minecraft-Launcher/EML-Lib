/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 */

import { Account } from '../../types/account.js'
import { EMLLibError, ErrorType } from '../../types/errors.js'
import { IAvatar, ICape, ISkin } from '../../types/skin.js'

export default class Skin {
  private readonly account: Account
  private cached: boolean

  private skins: ISkin[] = []
  private capes: ICape[] = []
  private avatar: IAvatar | null = null

  /**
   * Manage the player's skin, avatar and cape.
   * @param account The account of the player (must be authenticated with EML Lib's authentication
   * system).
   */
  constructor(account: Account) {
    this.account = account
    this.cached = false
  }

  /**
   * Get the player's skin. If the player has no skin, an empty array is returned.
   *
   * **Note:** Data returned by this method may be cached. Call `reload()` to fetch the latest data
   * from the server.
   *
   * @param active Whether to only return active skins (i.e., the skin currently used by the
   * player). If `false`, all skins are returned, including inactive ones.
   * @returns The list of the player's skins.
   */
  async getSkin(active: boolean = false): Promise<ISkin[]> {
    if (!this.cached) await this.reload()
    return this.skins.filter((skin) => !active || skin.state === 'active')
  }

  /**
   * Get the player's cape. If the player has no cape, an empty array is returned.
   *
   * **Note:** Data returned by this method may be cached. Call `reload()` to fetch the latest data
   * from the server.
   *
   * @param active Whether to only return active capes (i.e., the cape currently used by the
   * player). If `false`, all capes are returned, including inactive ones.
   * @returns The list of the player's capes.
   */
  async getCape(active: boolean = false): Promise<ICape[]> {
    if (!this.cached) await this.reload()
    return this.capes.filter((cape) => !active || cape.state === 'active')
  }

  /**
   * Get the player's avatar. If the player has no avatar, `null` is returned.
   *
   * **Note:** Data returned by this method may be cached. Call `reload()` to fetch the latest data
   * from the server.
   *
   * @returns The player's avatar.
   */
  async getAvatar(): Promise<IAvatar | null> {
    if (!this.cached) await this.reload()
    return this.avatar
  }

  /**
   * Reload the player's skin, cape and avatar data from the server. This is useful to get the
   * latest data after the player has changed their skin or cape, or if you want to make sure you
   * have the latest data from the server.
   */
  async reload(): Promise<void> {
    if (this.account.meta.type === 'msa') {
      await this.fetchFromMicrosoft()
      this.cached = true
    } else if (this.account.meta.type === 'yggdrasil') {
      await this.fetchFromYggdrasil()
      this.cached = true
    } else if (this.account.meta.type === 'azuriom') {
      await this.fetchFromAzuriom()
      this.cached = true
    } else {
      throw new EMLLibError(ErrorType.CONFIG_ERROR, `Unsupported account type: ${this.account.meta.type}`)
    }
  }

  /**
   * Upload a new skin for the player and activate it. Cache is automatically updated after a
   * successful update.
   * @param source The source file of the skin. The image should be a `.png` file of the skin,
   * and must follow the standard Minecraft skin format (64x64 pixels, or 64x32 pixels for legacy
   * skins). You can also provide a URL to the skin image.
   * @param variant The skin variant to use. This is only relevant for Minecraft accounts that have
   * both a classic and a slim skin. If the account only has one skin variant, this parameter is
   * ignored.
   */
  async updateSkin(source: string | File | Blob, variant: 'classic' | 'slim' = 'classic'): Promise<void> {
    if (this.account.meta.type === 'msa') {
      await this.uploadSkinToMicrosoft(source, variant)
    } else if (this.account.meta.type === 'yggdrasil') {
      await this.uploadSkinToYggdrasil(source, variant)
    } else if (this.account.meta.type === 'azuriom') {
      await this.uploadSkinToAzuriom(source)
    } else {
      throw new EMLLibError(ErrorType.CONFIG_ERROR, `Unsupported account type: ${this.account.meta.type}`)
    }
  }

  /**
   * Upload a new cape for the player and activate it. Cache is automatically updated after a
   * successful update.
   *
   * **Attention!** This method only works for Azuriom accounts.
   *
   * @param source The source file of the cape. The image should be a `.png` file of the cape, and
   * must follow the standard Minecraft cape format (64x32 pixels). You can also provide a URL
   * to the cape image.
   */
  async updateCape(source: string | File | Blob): Promise<void> {
    if (this.account.meta.type === 'msa') {
      throw new EMLLibError(
        ErrorType.CONFIG_ERROR,
        `Microsoft accounts don't allow custom capes. Please use switchCape() to switch between the capes available on the player's account instead of uploading a new one.`
      )
    } else if (this.account.meta.type === 'yggdrasil') {
      throw new EMLLibError(
        ErrorType.CONFIG_ERROR,
        `Yggdrasil accounts don't allow custom capes. User must change their cape manually on the Yggdrasil-compatible server.`
      )
    } else if (this.account.meta.type === 'azuriom') {
      await this.uploadCapeToAzuriom(source)
    } else {
      throw new EMLLibError(ErrorType.CONFIG_ERROR, `Unsupported account type: ${this.account.meta.type}`)
    }
  }

  /**
   * Delete the player's cape. Cache is automatically updated after a successful update.
   *
   * **Note:** Microsoft accounts doesn't allow custom capes. Please use `hideCape()` to hide the
   * player's cape instead of deleting it, as they don't support deleting capes.
   */
  async deleteCape(): Promise<void> {
    if (this.account.meta.type === 'msa') {
      throw new EMLLibError(
        ErrorType.CONFIG_ERROR,
        `Microsoft accounts don't allow custom capes. Please use hideCape() to hide the player's cape instead of deleting it, as they don't support deleting capes.`
      )
    } else if (this.account.meta.type === 'yggdrasil') {
      await this.deleteCapeFromYggdrasil()
    } else if (this.account.meta.type === 'azuriom') {
      await this.deleteCapeFromAzuriom()
    } else {
      throw new EMLLibError(ErrorType.CONFIG_ERROR, `Unsupported account type: ${this.account.meta.type}`)
    }
  }

  /**
   * Switch the player's active cape.
   *
   * **Note:** This method only works for Microsoft accounts. Please use `updateCape()` to update
   * the cape for other account types, as they don't support multiple capes.
   *
   * @param capeId The ID of the cape to activate. You can get the list of the player's capes and
   * their IDs with the `getCape()` method.
   */
  async switchCape(capeId: string): Promise<void> {
    if (this.account.meta.type === 'msa') {
      await this.switchCapeOnMicrosoft(capeId)
    } else {
      throw new EMLLibError(ErrorType.CONFIG_ERROR, `Unsupported account type: ${this.account.meta.type}`)
    }
  }

  /**
   * Hide the player's cape. Cache is automatically updated after a successful update.
   *
   * **Note:** This method only works for Microsoft accounts. Please use `deleteCape()` to delete
   * the cape for other account types, as they don't support hiding capes.
   */
  async hideCape(): Promise<void> {
    if (this.account.meta.type === 'msa') {
      await this.hideCapeOnMicrosoft()
    } else {
      throw new EMLLibError(ErrorType.CONFIG_ERROR, `Unsupported account type: ${this.account.meta.type}`)
    }
  }

  private async fetchFromMicrosoft() {
    try {
      const req = await fetch('https://api.minecraftservices.com/minecraft/profile', {
        headers: {
          Authorization: `Bearer ${this.account.accessToken}`
        }
      })

      if (!req.ok) {
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while fetching skin data from Microsoft: HTTP ${req.status} ${errorText}`)
      }
      const data = await req.json()

      this.skins =
        data?.skins?.map((skin: any) => ({
          id: skin.id,
          url: skin.url,
          state: skin.state === 'ACTIVE' ? 'active' : 'inactive',
          variant: skin.variant === 'SLIM' ? 'slim' : 'classic'
        })) ?? []

      this.capes =
        data?.capes?.map((cape: any) => ({
          id: cape.id,
          url: cape.url,
          state: cape.state.toLowerCase() as 'active' | 'inactive',
          alias: cape.alias
        })) ?? []

      this.avatar = {
        id: this.account.uuid,
        url: `https://minotar.com/avatar/${this.account.name}/256.png`
      }
    } catch (err: any) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while checking for updates: ${err.message ?? err}`)
    }
  }

  private async fetchFromYggdrasil() {
    try {
      const req = await fetch(`${this.account.meta.url}/session/minecraft/profile/${this.account.uuid}`)

      if (!req.ok) {
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while fetching skin data from Yggdrasil server: HTTP ${req.status} ${errorText}`)
      }
      const data = await req.json()
      const textures = data.properties?.find((prop: any) => prop.name === 'textures')?.value

      if (textures) {
        const decoded = JSON.parse(Buffer.from(textures, 'base64').toString('utf-8'))

        if (decoded.textures?.SKIN) {
          this.skins = [
            {
              id: decoded.textures.SKIN.url,
              url: decoded.textures.SKIN.url,
              state: 'active',
              variant: decoded.textures.SKIN.metadata?.model === 'slim' ? 'slim' : 'classic'
            }
          ]

          this.avatar = {
            id: this.account.uuid,
            url: await this.getAvatarFromSkin(decoded.textures.SKIN.url)
          }
        } else {
          this.skins = []
          this.avatar = null
        }

        if (decoded.textures?.CAPE) {
          this.capes = [
            {
              id: decoded.textures.CAPE.url,
              url: decoded.textures.CAPE.url,
              state: 'active',
              alias: 'cape'
            }
          ]
        } else {
          this.capes = []
        }
      }
    } catch (err: any) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while checking for updates: ${err.message ?? err}`)
    }
  }

  private async fetchFromAzuriom() {
    try {
      const req1 = await fetch(`${this.account.meta.url}/api/skin-api/skins/${this.account.name}`)

      if (!req1.ok) {
        if (req1.status === 404) {
          this.skins = []
          return
        } else {
          const errorText = await req1.text()
          throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while fetching skin data from Azuriom server: HTTP ${req1.status} ${errorText}`)
        }
      }

      this.skins = [
        {
          id: this.account.uuid,
          url: `${this.account.meta.url}/api/skin-api/skins/${this.account.name}`,
          state: 'active',
          variant: 'classic'
        }
      ]

      const req2 = await fetch(`${this.account.meta.url}/api/skin-api/capes/${this.account.name}`)

      if (!req2.ok) {
        if (req2.status === 404) {
          this.capes = []
          return
        } else {
          const errorText = await req2.text()
          throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while fetching cape data from Azuriom server: HTTP ${req2.status} ${errorText}`)
        }
      }

      this.capes = [
        {
          id: this.account.uuid,
          url: `${this.account.meta.url}/api/skin-api/capes/${this.account.name}`,
          state: 'active',
          alias: 'cape'
        }
      ]

      if (this.skins.length > 0) {
        this.avatar = {
          id: this.account.uuid,
          url: `${this.account.meta.url}/api/skin-api/avatars/face/${this.account.name}`
        }
      } else {
        this.avatar = null
      }
    } catch (err: any) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while checking for updates: ${err.message ?? err}`)
    }
  }

  private async uploadSkinToMicrosoft(source: string | File | Blob, variant: 'classic' | 'slim') {
    const headers: Record<string, string> = { Authorization: `Bearer ${this.account.accessToken}` }

    try {
      let body: any

      if (typeof source === 'string') {
        headers['Content-Type'] = 'application/json'
        body = JSON.stringify({
          url: source,
          variant: variant
        })
      } else {
        const formData = new FormData()
        formData.append('file', source, 'skin.png')
        formData.append('variant', variant)
        body = formData
      }

      const req = await fetch('https://api.minecraftservices.com/minecraft/profile/skins', { method: 'POST', headers, body })

      if (!req.ok) {
        const errorText = await req.text()
        if (req.status === 429) {
          throw new EMLLibError(ErrorType.TOO_MANY_REQUESTS, `Too many requests while uploading skin to Microsoft: HTTP ${req.status} ${errorText}`)
        }
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while uploading skin to Microsoft: HTTP ${req.status} ${errorText}`)
      }
      const data = await req.json()

      this.skins =
        data?.skins?.map((skin: any) => ({
          id: skin.id,
          url: skin.url,
          state: skin.state === 'ACTIVE' ? 'active' : 'inactive',
          variant: skin.variant === 'SLIM' ? 'slim' : 'classic'
        })) ?? this.skins

      this.avatar = {
        id: this.account.uuid,
        url: await this.getAvatarFromSkin(this.skins[0].url)
      }
    } catch (err: any) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while uploading skin to Microsoft: ${err.message ?? err}`)
    }
  }

  private async uploadSkinToYggdrasil(source: string | File | Blob, variant: 'classic' | 'slim') {
    const headers: Record<string, string> = { Authorization: `Bearer ${this.account.accessToken}` }

    try {
      const body = new FormData()
      if (typeof source === 'string') {
        const image = await fetch(source).then((res) => {
          if (!res.ok) {
            throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while fetching skin image from URL: HTTP ${res.status} ${res.statusText}`)
          }
          return res.blob()
        })
        body.append('file', image, 'skin.png')
        body.append('variant', variant)
      } else {
        body.append('file', source, 'skin.png')
        body.append('variant', variant)
      }

      const req = await fetch(`${this.account.meta.url}/minecraft/profile/skins`, { method: 'POST', headers, body })

      if (!req.ok) {
        const errorText = await req.text()
        if (req.status === 429) {
          throw new EMLLibError(
            ErrorType.TOO_MANY_REQUESTS,
            `Too many requests while uploading skin to ${this.account.meta.type === 'msa' ? 'Microsoft' : 'Yggdrasil'}: HTTP ${req.status} ${errorText}`
          )
        }
        throw new EMLLibError(
          ErrorType.FETCH_ERROR,
          `Error while uploading skin to ${this.account.meta.type === 'msa' ? 'Microsoft' : 'Yggdrasil'}: HTTP ${req.status} ${errorText}`
        )
      }
      const data = await req.json()

      this.skins =
        data?.skins?.map((skin: any) => ({
          id: skin.id,
          url: skin.url,
          state: skin.state === 'ACTIVE' ? 'active' : 'inactive',
          variant: skin.variant === 'SLIM' ? 'slim' : 'classic'
        })) ?? this.skins

      this.avatar = {
        id: this.account.uuid,
        url: await this.getAvatarFromSkin(this.skins[0].url)
      }
    } catch (err: any) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(
        ErrorType.FETCH_ERROR,
        `Error while uploading skin to ${this.account.meta.type === 'msa' ? 'Microsoft' : 'Yggdrasil'}: ${err.message ?? err}`
      )
    }
  }

  private async uploadSkinToAzuriom(source: string | File | Blob) {
    try {
      let image: Blob
      if (typeof source === 'string') {
        image = await fetch(source).then((res) => {
          if (!res.ok) {
            throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while fetching skin image from URL: HTTP ${res.status} ${res.statusText}`)
          }
          return res.blob()
        })
      } else {
        image = source
      }

      const body = new FormData()
      body.append('skin', image, 'skin.png')
      body.append('access_token', this.account.accessToken)

      const req = await fetch(`${this.account.meta.url}/api/skin-api/skins`, {
        method: 'POST',
        body
      })

      if (!req.ok) {
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while uploading skin to Azuriom server: HTTP ${req.status} ${errorText}`)
      }

      await this.fetchFromAzuriom()
    } catch (err: any) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while uploading skin to Azuriom server: ${err.message ?? err}`)
    }
  }

  private async switchCapeOnMicrosoft(capeId: string) {
    try {
      const req = await fetch('https://api.minecraftservices.com/minecraft/profile/capes/active', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.account.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          capeId
        })
      })

      if (!req.ok) {
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while switching cape on Microsoft: HTTP ${req.status} ${errorText}`)
      }
      const data = await req.json()

      this.capes =
        data?.capes?.map((cape: any) => ({
          id: cape.id,
          url: cape.url,
          state: cape.state === 'ACTIVE' ? 'active' : 'inactive',
          alias: cape.alias
        })) ?? []
    } catch (err: any) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while switching cape on Microsoft: ${err.message ?? err}`)
    }
  }

  private async hideCapeOnMicrosoft() {
    try {
      const req = await fetch('https://api.minecraftservices.com/minecraft/profile/capes/active', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.account.accessToken}`
        }
      })

      if (!req.ok) {
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while hiding cape on Microsoft: HTTP ${req.status} ${errorText}`)
      }
      const data = await req.json()

      if (data?.capes) {
        this.capes = data.capes.map((cape: any) => ({
          id: cape.id,
          url: cape.url,
          state: cape.state === 'ACTIVE' ? 'active' : 'inactive',
          alias: cape.alias
        }))
      } else {
        await this.fetchFromMicrosoft()
      }
    } catch (err: any) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while hiding cape on Microsoft: ${err.message ?? err}`)
    }
  }

  private async deleteCapeFromYggdrasil() {
    try {
      const req = await fetch(`${this.account.meta.url}/minecraft/profile/capes/active`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.account.accessToken}`
        }
      })

      if (!req.ok) {
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while hiding cape on Yggdrasil: HTTP ${req.status} ${errorText}`)
      }

      await this.fetchFromYggdrasil()
    } catch (err: any) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while hiding cape on Yggdrasil: ${err.message ?? err}`)
    }
  }

  private async uploadCapeToAzuriom(source: string | File | Blob) {
    try {
      let image: Blob
      if (typeof source === 'string') {
        image = await fetch(source).then((res) => {
          if (!res.ok) {
            throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while fetching cape image from URL: HTTP ${res.status} ${res.statusText}`)
          }
          return res.blob()
        })
      } else {
        image = source
      }

      const formData = new FormData()
      formData.append('cape', image, 'cape.png')
      formData.append('access_token', this.account.accessToken)

      const req = await fetch(`${this.account.meta.url}/api/skin-api/capes`, {
        method: 'POST',
        body: formData
      })

      if (!req.ok) {
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while uploading cape to Azuriom server: HTTP ${req.status} ${errorText}`)
      }

      await this.fetchFromAzuriom()
    } catch (err: any) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while uploading cape to Azuriom server: ${err.message ?? err}`)
    }
  }

  private async deleteCapeFromAzuriom() {
    try {
      const formData = new FormData()
      formData.append('access_token', this.account.accessToken)

      const req = await fetch(`${this.account.meta.url}/api/skin-api/capes`, {
        method: 'DELETE',
        body: formData
      })

      if (!req.ok) {
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while deleting cape from Azuriom server: HTTP ${req.status} ${errorText}`)
      }

      await this.fetchFromAzuriom()
    } catch (err: any) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while deleting cape from Azuriom server: ${err.message ?? err}`)
    }
  }

  // util
  private async getAvatarFromSkin(skinUrl: string, size: number = 256) {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return null
    }

    try {
      const req = await fetch(skinUrl)

      if (!req.ok) {
        const errorText = await req.text()
        throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while fetching avatar from skin: HTTP ${req.status} ${errorText}`)
      }

      const blob = await req.blob()
      const img = await createImageBitmap(blob)

      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size

      const ctx = canvas.getContext('2d')!
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(img, 8, 8, 8, 8, 0, 0, size, size)
      ctx.drawImage(img, 40, 8, 8, 8, 0, 0, size, size)

      return canvas.toDataURL('image/png')
    } catch (err: any) {
      if (err instanceof EMLLibError) throw err
      throw new EMLLibError(ErrorType.FETCH_ERROR, `Error while fetching avatar from skin: ${err.message ?? err}`)
    }
  }
}




