/**
 * Copyright (c) Jonathan Cardoso Machado. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import https from 'node:https'
import { type Socket } from 'node:net'
import { describe, beforeAll, afterAll, it, expect } from 'vitest'

import { createHttpsServer } from '../helper/server'
import { CurlCode, Easy } from '../../lib'

// Where libcurl links the OpenSSL that Node exports (the Linux and Windows
// prebuilds), an OpenSSL error libcurl leaves queued makes Node's next read on
// an unrelated TLS socket fail. With a separate OpenSSL these tests pass anyway.
describe('Easy', () => {
  const serverInstance = createHttpsServer()
  const agent = new https.Agent({ keepAlive: true, maxSockets: 1 })

  const get = () =>
    new Promise<{ body: string; socket: Socket }>((resolve, reject) => {
      https
        .get(
          serverInstance.url,
          { agent, rejectUnauthorized: false },
          (res) => {
            let body = ''
            res.setEncoding('utf8')
            res.on('data', (chunk: string) => (body += chunk))
            res.on('end', () => resolve({ body, socket: res.socket as Socket }))
          },
        )
        .on('error', reject)
    })

  beforeAll(async () => {
    serverInstance.app.get('/', (_req, res) => {
      res.send('ok')
    })

    await serverInstance.listen()
  })

  afterAll(async () => {
    agent.destroy()
    await serverInstance.close()
    serverInstance.app._router.stack.pop()
  })

  describe('setOpt', () => {
    it('keeps an open Node TLS socket usable after SSLENGINE fails to load an engine', async () => {
      const first = await get()

      const easy = new Easy()
      try {
        // Fails inside OpenSSL's provider/engine loader, which queues the error.
        expect(
          easy.setOpt('SSLENGINE', 'node-libcurl-nonexistent-engine'),
        ).toBe(CurlCode.CURLE_SSL_ENGINE_NOTFOUND)
      } finally {
        easy.close()
      }

      const second = await get()

      expect(second.body).toBe('ok')
      expect(second.socket).toBe(first.socket)
    })
  })
})
