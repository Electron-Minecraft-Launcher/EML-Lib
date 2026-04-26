export interface ISkin {
  id: string
  url: string
  state: 'active' | 'inactive'
  variant: 'classic' | 'slim'
}

export interface ICape {
  id: string
  url: string
  state: 'active' | 'inactive'
  alias: string
}

export interface IAvatar {
  id: string
  /**
   * May be `null` if the `Skin` class is initialized from the main process.
   */
  url: string | null
}
