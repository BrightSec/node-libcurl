// On Windows a source build first needs vcpkg to compile curl and its
// dependencies, which takes 20-30 minutes, so vcpkg only runs when the
// prebuilt binary cannot be used.
const { spawnSync } = require('child_process')
const path = require('path')

const packageJson = require('../package.json')
const buildFlags = require('./utils/buildFlags')

const nodePreGyp = require.resolve('@mapbox/node-pre-gyp/bin/node-pre-gyp')
const vcpkgSetup = path.join(__dirname, 'vcpkg-setup.js')

function isSourceBuildRequested(env) {
  const value = env.npm_config_build_from_source
  return value === 'true' || value === packageJson.name
}

function runNode(script, args, env) {
  const { status, error } = spawnSync(process.execPath, [script, ...args], {
    stdio: 'inherit',
    env,
  })
  if (error) throw error
  return status ?? 1
}

function install({
  platform = process.platform,
  env = process.env,
  isGitRepo = buildFlags.isGitRepo,
  run = runNode,
} = {}) {
  const fallbackInstallArgs = ['install', '--fallback-to-build']

  if (platform !== 'win32') {
    return run(nodePreGyp, fallbackInstallArgs, env)
  }

  let buildArgs = fallbackInstallArgs

  // A git checkout keeps vcpkg ready for later `pnpm pregyp rebuild` runs.
  if (!isSourceBuildRequested(env) && !isGitRepo) {
    // node-pre-gyp lets npm_config_* env vars override its argv. Dropping the
    // fallback flag keeps this attempt download-only, because a build without
    // vcpkg would fail.
    const { npm_config_fallback_to_build: _fallback, ...downloadEnv } = env
    if (run(nodePreGyp, ['install'], downloadEnv) === 0) return 0
    console.log(
      'node-libcurl: prebuilt binary is not available, building from source with vcpkg',
    )
    // A failed extraction can leave a partial node_libcurl.node, which another
    // `install` would accept as installed. A source build deletes it first.
    buildArgs = ['install', '--build-from-source']
  }

  const vcpkgStatus = run(vcpkgSetup, [], env)
  if (vcpkgStatus !== 0) return vcpkgStatus
  return run(nodePreGyp, buildArgs, env)
}

module.exports = { install, nodePreGyp, vcpkgSetup }

if (require.main === module) {
  process.exitCode = install()
}
