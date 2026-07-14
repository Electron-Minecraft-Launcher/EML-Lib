export interface IMaintenance {
  id?: number
  startTime?: Date| null
  endTime?: Date | null
  message?: string,
  canBypass?: boolean
}
