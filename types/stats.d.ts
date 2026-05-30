export type StatEvent = 'STARTUP' | 'LOGIN' | 'LAUNCH' | 'BOOTSTRAP'

export type StatProvider = 'AUTH_MICROSOFT' | 'AUTH_YGGDRASIL' | 'AUTH_AZURIOM' | 'AUTH_CRACK' | 'LAUNCHER' | 'BOOTSTRAP'

export interface IStatProvider {
  public readonly statType: StatProvider
}