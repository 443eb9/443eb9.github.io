import { createCipheriv, randomBytes } from 'node:crypto'

export const ENCRYPTION_HEADER = Buffer.from('ISLAND-AES-GCM\x01')
export const IV_BYTES = 12
export const TAG_BYTES = 16

export function encryptionKey(value) {
  const key = typeof value === 'string' ? Buffer.from(value, 'base64') : Buffer.alloc(0)
  if (key.length !== 32 || key.toString('base64') !== value) {
    throw new Error('ISLAND_ENCRYPTION_KEY must contain a Base64-encoded random 32-byte key for encrypted islands.')
  }
  return key
}

export function encryptContent(content, key, context) {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_BYTES })
  cipher.setAAD(Buffer.from(context, 'utf8'))
  return Buffer.concat([ENCRYPTION_HEADER, iv, cipher.update(content), cipher.final(), cipher.getAuthTag()])
}
