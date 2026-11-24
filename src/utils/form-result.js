// What the contact form's service answered, read strictly: a message counts as
// sent only when the service says so in JSON. Web3Forms replies
// {"success": true, …}; Formspree replies {"ok": true, …}. Anything else (an
// HTML page, an empty body, success: false, an HTTP error) is not a confirmation.

/**
 * @param {boolean} httpOk  response.ok
 * @param {unknown} json    the parsed body, or null when it wasn't JSON
 * @returns {'sent' | 'rejected' | 'unconfirmed'}
 */
export function formResult(httpOk, json) {
  if (json && typeof json === 'object') {
    if (httpOk && (json.success === true || json.ok === true)) return 'sent';
    if (json.success === false || json.ok === false || !httpOk) return 'rejected';
    return 'unconfirmed';
  }
  return httpOk ? 'unconfirmed' : 'rejected';
}
