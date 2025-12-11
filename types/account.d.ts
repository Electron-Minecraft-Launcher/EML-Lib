export interface Account {
  name: string
  uuid: string
  accessToken: string
  clientToken: string
  refreshToken?: string
  userProperties?: any
  availableProfiles?: any
  meta: { online: boolean; type: 'msa' | 'azuriom' | 'yggdrasil' | 'crack' }
  xbox?: {
    xuid: string
    gamertag: string
    ageGroup: string
  }
}
