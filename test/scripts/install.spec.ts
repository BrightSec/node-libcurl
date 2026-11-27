import { describe, expect, it, vi } from 'vitest'

const { install, nodePreGyp, vcpkgSetup } = require('../../scripts/install.js')

type Call = [script: string, args: string[], env: NodeJS.ProcessEnv]

function runner(...statuses: number[]) {
  return vi.fn((..._call: Call) => statuses.shift() ?? 0)
}

describe('install', () => {
  it('keeps the download-or-build install on non-Windows platforms', () => {
    const run = runner(0)
    const env = { npm_config_build_from_source: 'true' }

    expect(install({ platform: 'linux', env, isGitRepo: false, run })).toBe(0)
    expect(run.mock.calls).toEqual([
      [nodePreGyp, ['install', '--fallback-to-build'], env],
    ])
  })

  it('skips vcpkg on Windows when the prebuilt binary installs', () => {
    const run = runner(0)
    const env = { PATH: 'C:\\bin', npm_config_fallback_to_build: 'true' }

    expect(install({ platform: 'win32', env, isGitRepo: false, run })).toBe(0)
    expect(run.mock.calls).toEqual([
      [nodePreGyp, ['install'], { PATH: 'C:\\bin' }],
    ])
  })

  it('runs vcpkg and builds on Windows when the prebuilt binary is unavailable', () => {
    const run = runner(1, 0, 0)
    const env = { PATH: 'C:\\bin' }

    expect(install({ platform: 'win32', env, isGitRepo: false, run })).toBe(0)
    expect(run.mock.calls.map(([script, args]) => [script, args])).toEqual([
      [nodePreGyp, ['install']],
      [vcpkgSetup, []],
      [nodePreGyp, ['install', '--build-from-source']],
    ])
  })

  it.each(['true', '@brightsec/node-libcurl'])(
    'runs vcpkg first on Windows when npm_config_build_from_source is %s',
    (value) => {
      const run = runner(0, 0)
      const env = { npm_config_build_from_source: value }

      expect(install({ platform: 'win32', env, isGitRepo: false, run })).toBe(0)
      expect(run.mock.calls).toEqual([
        [vcpkgSetup, [], env],
        [nodePreGyp, ['install', '--fallback-to-build'], env],
      ])
    },
  )

  it('runs vcpkg first on Windows in a git checkout', () => {
    const run = runner(0, 0)

    expect(install({ platform: 'win32', env: {}, isGitRepo: true, run })).toBe(
      0,
    )
    expect(run.mock.calls.map(([script]) => script)).toEqual([
      vcpkgSetup,
      nodePreGyp,
    ])
  })

  it('stops with the vcpkg exit code when vcpkg setup fails', () => {
    const run = runner(1, 3)

    expect(install({ platform: 'win32', env: {}, isGitRepo: false, run })).toBe(
      3,
    )
    expect(run).toHaveBeenCalledTimes(2)
  })
})
