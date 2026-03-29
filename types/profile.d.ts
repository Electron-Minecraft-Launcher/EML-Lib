export interface IProfile {
  id?: string
  isDefault: boolean
  name: string
  slug: string
  ip?: string | null
  port?: number | null
  tcpProtocol?: 'modern' | '1.6' | '1.4-1.5' | 'beta1.8-1.3' | null
  createdAt: Date
  updatedAt: Date
}

