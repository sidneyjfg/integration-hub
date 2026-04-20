import path from 'node:path'
import { Readable } from 'node:stream'
import axios from 'axios'

export function getMercadoLivreXmlFixturePaths(): string[] {
  return [
    path.resolve(__dirname, '../fixtures/mercadolivre/xml/nfe-1001.xml'),
    path.resolve(__dirname, '../fixtures/mercadolivre/xml/nfe-1002.xml'),
    path.resolve(__dirname, '../fixtures/mercadolivre/xml/nfe-1003.xml')
  ]
}

export function createMercadoLivreAxiosMock(options?: {
  notifications?: Array<{ url: string; body: any }>
}) {
  const notifications = options?.notifications ?? []

  return {
    get: async () => ({
      status: 200,
      data: Readable.from([Buffer.from('mock-zip-content')])
    }),
    post: async (url: string, body: any) => {
      notifications.push({ url, body })
      return axios.post(url, body, {
        headers: {
          'Content-Type': 'application/json'
        }
      })
    }
  }
}
