/**
 * Copyright (c) Jonathan Cardoso Machado. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
#ifndef NODELIBCURL_OPENSSLERRORQUEUE_H
#define NODELIBCURL_OPENSSLERRORQUEUE_H

// Headers come from Node's own include/node/openssl, or vcpkg's on Windows.
#if __has_include(<openssl/err.h>)
#include <openssl/err.h>
#define NODE_LIBCURL_HAS_OPENSSL_ERR 1
#endif

namespace NodeLibcurl {

// The prebuilt Linux and Windows binaries resolve libcurl's OpenSSL calls to the
// OpenSSL that Node itself exports, so both share one per-thread error queue.
// libcurl does not always drain it: setting CURLOPT_SSLENGINE first tries to load
// the provider by name from the modules directory, which is the null device in
// Node's build, and that failure stays queued even when the provider then loads
// from OPENSSL_CONF. Node's next SSL_read() on any TLS socket then sees the stale
// error through SSL_get_error() and destroys that socket.
inline void ClearOpenSslErrorQueue() {
#ifdef NODE_LIBCURL_HAS_OPENSSL_ERR
  ERR_clear_error();
#endif
}

// Clears the queue when control leaves libcurl for JS or libuv. Declare it after
// any Napi::CallbackScope, so it runs before the scope's microtask checkpoint.
class OpenSslErrorQueueGuard {
 public:
  OpenSslErrorQueueGuard() = default;
  OpenSslErrorQueueGuard(const OpenSslErrorQueueGuard&) = delete;
  OpenSslErrorQueueGuard& operator=(const OpenSslErrorQueueGuard&) = delete;
  ~OpenSslErrorQueueGuard() { ClearOpenSslErrorQueue(); }
};

}  // namespace NodeLibcurl

#endif
