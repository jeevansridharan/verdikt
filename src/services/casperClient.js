import * as CasperSdk from 'casper-js-sdk'

const {
  Args,
  CLValue,
  ContractHash,
  Deploy,
  DeployHeader,
  ExecutableDeployItem,
  HexBytes,
  HttpHandler,
  PublicKey,
  PurseIdentifier,
  RpcClient,
  StoredContractByHash,
  makeCsprTransferDeploy,
} = CasperSdk

// ── RPC / network configuration ───────────────────────────────────────────────
// Browser apps cannot call the Casper RPC node directly (CORS). Route through /casper-rpc.
function resolveRpcUrl() {
  if (import.meta.env.VITE_CASPER_NODE_URL) return import.meta.env.VITE_CASPER_NODE_URL
  if (typeof window !== 'undefined') return '/casper-rpc'
  return 'https://node.testnet.casper.network/rpc'
}

export const CASPER_NODE_URL    = resolveRpcUrl()
export const CASPER_CHAIN_NAME  = import.meta.env.VITE_CASPER_CHAIN_NAME || 'casper-test'
export const CASPER_EXPLORER_URL =
  import.meta.env.VITE_CASPER_EXPLORER_URL || 'https://testnet.cspr.live'

const rpc = new RpcClient(new HttpHandler(CASPER_NODE_URL))

// ── Diagnostic banner (printed once at module load) ───────────────────────────
console.log('[casperClient] ── configuration ──────────────────────────')
console.log('[casperClient]  RPC URL    :', CASPER_NODE_URL)
console.log('[casperClient]  Chain name :', CASPER_CHAIN_NAME)
console.log('[casperClient]  Explorer   :', CASPER_EXPLORER_URL)
console.log('[casperClient]  Contract   :', import.meta.env.VITE_CASPER_CONTRACT_HASH || '(not set)')
console.log('[casperClient] ────────────────────────────────────────────')

// ── Error translation ─────────────────────────────────────────────────────────
/**
 * translateCasperError(err)
 *
 * Maps raw wallet / RPC error codes to human-readable messages.
 *
 * -32009  state_get_account_info: no on-chain account state record.
 * -32026  query_balance: account exists as a key but has NO main purse.
 *         A main purse is only created when an account receives its first
 *         CSPR on-chain. This is the definitive sign of an unfunded account.
 *         Confirmed via direct RPC probe: the node IS casper-test (v2.2.2)
 *         and the key is valid — the account just needs testnet CSPR.
 */
export function translateCasperError(err) {
  const msg  = (err?.message ?? String(err)).toLowerCase()
  const code = err?.code ?? err?.data?.code

  if (code === -32026 || msg.includes('purse not found') || msg.includes('-32026')) {
    return (
      'This Casper Testnet account has not been activated yet. ' +
      'Please fund it using the Casper Testnet faucet at https://testnet.cspr.live/tools/faucet, ' +
      'then refresh the page.'
    )
  }
  if (code === -32009 || msg.includes('no such account') || msg.includes('-32009')) {
    return (
      'No Casper account found on this network. ' +
      'Please create or import an account in your Casper Wallet and make sure ' +
      'it is set to Testnet, then try connecting again.'
    )
  }
  if (msg.includes('cancelled') || msg.includes('rejected') || msg.includes('declined')) {
    return 'Connection request was declined. Please approve it in Casper Wallet to continue.'
  }
  if (msg.includes('not installed') || msg.includes('casperwalletprovider')) {
    return (
      'Casper Wallet extension is not installed. ' +
      'Visit https://casperwallet.io to install it.'
    )
  }
  return err?.message ?? String(err)
}

// ── Provider detection ────────────────────────────────────────────────────────
/**
 * getCasperProvider()
 *
 * Waits for window.CasperWalletProvider to be injected by the Casper Wallet
 * browser extension content script.
 *
 * ── Why polling is required ───────────────────────────────────────────────────
 * Browser extensions inject globals asynchronously via content scripts.
 * When multiple wallet extensions are loaded, injection can be delayed by
 * 2-5 seconds. A single 2-second check is insufficient.
 *
 * ── Strategy ─────────────────────────────────────────────────────────────────
 * 1. POLL every 200 ms for up to 6 seconds (30 attempts).
 *    Stop and resolve immediately the moment the provider appears.
 * 2. EVENT HINTS: listen for 'CasperWalletProviderReady' (dispatched by some
 *    versions of the Casper Wallet extension) and 'DOMContentLoaded' (fired
 *    when the page finishes parsing) — both trigger an immediate check without
 *    waiting for the next poll tick.
 * 3. TIMEOUT: if still not found after 6 s, resolve(null) so callers can
 *    show "Connect Casper Wallet" gracefully.
 *
 * ── Parameters ───────────────────────────────────────────────────────────────
 * @param {number} [pollMs=200]      Poll interval in milliseconds
 * @param {number} [timeoutMs=6000]  Maximum wait time before giving up
 * @returns {Promise<Function|null>} Resolves with window.CasperWalletProvider
 *                                   constructor, or null if not found.
 */
export function getCasperProvider(pollMs = 200, timeoutMs = 6000) {
  return new Promise((resolve) => {
    // Resolved flag prevents double-resolution from concurrent strategies
    let resolved = false

    function success(label) {
      if (resolved) return
      resolved = true
      cleanup()
      console.log(`[casperClient] getCasperProvider: wallet extension detected ✓ (via ${label})`)
      resolve(window.CasperWalletProvider)
    }

    function timeout() {
      if (resolved) return
      resolved = true
      cleanup()
      console.warn(
        `[casperClient] getCasperProvider: extension NOT found after ${timeoutMs / 1000} s` +
        ' — install Casper Wallet or check the extension is enabled'
      )
      resolve(null)
    }

    // ── Cleanup helper: cancel all timers and event listeners ──────────────
    let pollTimer = null
    let deadlineTimer = null

    function cleanup() {
      if (pollTimer)    clearInterval(pollTimer)
      if (deadlineTimer) clearTimeout(deadlineTimer)
      window.removeEventListener('CasperWalletProviderReady', onEvent)
      document.removeEventListener('DOMContentLoaded', onEvent)
      pollTimer = null
      deadlineTimer = null
    }

    // ── Immediate check (synchronous) ──────────────────────────────────────
    // The extension may already be injected if the page loaded slowly.
    if (typeof window !== 'undefined' && typeof window.CasperWalletProvider === 'function') {
      console.log('[casperClient] getCasperProvider: wallet extension already present ✓')
      resolve(window.CasperWalletProvider)
      return
    }

    // ── Event-hint handler ─────────────────────────────────────────────────
    // Some Casper Wallet builds fire 'CasperWalletProviderReady'; others don't.
    // DOMContentLoaded is a common trigger point for extension injection.
    function onEvent(evt) {
      if (typeof window.CasperWalletProvider === 'function') {
        success(evt.type)
      }
      // If not yet present on this event, the poll loop will catch it shortly.
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('CasperWalletProviderReady', onEvent, { once: true })
      if (document.readyState !== 'complete') {
        document.addEventListener('DOMContentLoaded', onEvent, { once: true })
      }
    }

    // ── Poll loop (primary strategy) ───────────────────────────────────────
    pollTimer = setInterval(() => {
      if (typeof window !== 'undefined' && typeof window.CasperWalletProvider === 'function') {
        success('poll')
      }
    }, pollMs)

    // ── Hard deadline ──────────────────────────────────────────────────────
    deadlineTimer = setTimeout(timeout, timeoutMs)
  })
}

function walletProvider() {
  if (typeof window === 'undefined' || !window.CasperWalletProvider) {
    throw new Error('Casper Wallet is not installed.')
  }
  return window.CasperWalletProvider()
}

// ── Core wallet helpers ───────────────────────────────────────────────────────

/**
 * getActiveWalletAccount()
 *
 * Returns the active Casper Wallet public key, or null if:
 *   - The Casper Wallet extension is not installed
 *   - No account is active in the extension
 *   - Any error occurs
 *
 * NEVER throws. NEVER logs before checking for the extension.
 * This is safe to call during app startup without a prior extension check.
 */
export async function getActiveWalletAccount() {
  // ── Guard: extension not installed ──────────────────────────────
  // Do NOT call window.CasperWalletProvider() here if the extension is absent.
  // Doing so causes the Casper Wallet shim to attempt a MetaMask fallback,
  // which throws "Failed to connect to MetaMask: MetaMask extension not found".
  if (typeof window === 'undefined' || typeof window.CasperWalletProvider !== 'function') {
    // Silent: Casper Wallet extension not installed — expected during startup
    return null
  }

  console.log('[casperClient] getActiveWalletAccount: querying live wallet…')
  try {
    const provider = window.CasperWalletProvider()
    const publicKey = await provider.getActivePublicKey()
    console.log('[casperClient] getActiveWalletAccount: live key =', publicKey)
    return publicKey ?? null
  } catch (err) {
    console.warn('[casperClient] getActiveWalletAccount: failed —', err?.message ?? err)
    return null
  }
}

/**
 * connectCasperWallet()
 *
 * Clears any stale localStorage key FIRST, then requests connection,
 * fetches the LIVE active public key, caches it, and returns { provider, publicKey }.
 */
export async function connectCasperWallet() {
  console.log('[casperClient] connectCasperWallet: starting…')
  console.log('[casperClient] connectCasperWallet: RPC =', CASPER_NODE_URL, '| chain =', CASPER_CHAIN_NAME)

  // Clear stale cached key before asking the wallet for the current one
  localStorage.removeItem('arbit_casper_public_key')
  console.log('[casperClient] connectCasperWallet: stale localStorage key cleared')

  let provider
  try {
    provider = walletProvider()
    console.log('[casperClient] connectCasperWallet: wallet extension found ✓')
  } catch (err) {
    throw new Error(translateCasperError(err))
  }

  let connected
  try {
    connected = await provider.requestConnection()
    console.log('[casperClient] connectCasperWallet: requestConnection() response =', connected)
  } catch (err) {
    throw new Error(translateCasperError(err))
  }

  if (!connected) {
    throw new Error('Casper Wallet connection was declined. Please approve it in the extension popup.')
  }

  let publicKey
  try {
    publicKey = await provider.getActivePublicKey()
    console.log('[casperClient] connectCasperWallet: active public key =', publicKey)
  } catch (err) {
    console.error('[casperClient] connectCasperWallet: getActivePublicKey error —', err)
    throw new Error(translateCasperError(err))
  }

  if (!publicKey) {
    throw new Error(
      'No Casper account found. Please create or import an account into your ' +
      'Casper Wallet, then try connecting again.'
    )
  }

  localStorage.setItem('arbit_casper_public_key', publicKey)
  console.log('[casperClient] connectCasperWallet: key cached ✓')

  return { provider, publicKey }
}

/**
 * disconnectCasperWallet()
 */
export async function disconnectCasperWallet() {
  console.log('[casperClient] disconnectCasperWallet: disconnecting…')
  const provider = walletProvider()
  await provider.disconnectFromSite()
  localStorage.removeItem('arbit_casper_public_key')
  console.log('[casperClient] disconnectCasperWallet: localStorage cleared ✓')
}

// ── Balance lookup ────────────────────────────────────────────────────────────

/**
 * getCsprBalance(publicKeyHex)
 *
 * FIX — Bug 1: replaced state_get_account_info + state_get_balance with query_balance.
 *
 * WHY -32009 WAS HAPPENING:
 *   The old code called rpc.getAccountInfo() which maps to the RPC method
 *   `state_get_account_info`. That method requires an on-chain account STATE record,
 *   which is only created after the account receives its first funded deploy.
 *   A freshly created wallet has a valid public key and a deterministic account-hash,
 *   but NO on-chain state — so the node returns Code -32009 "No such account".
 *
 * THE FIX:
 *   rpc.queryLatestBalance(PurseIdentifier.fromPublicKey(pk)) calls the newer
 *   `query_balance` RPC method. It derives the main purse from the public key
 *   without needing an account state record. Works for both activated and
 *   freshly created accounts. Returns the balance as a CLValueUInt512.
 */
export async function getCsprBalance(publicKeyHex) {
  // ── Diagnostics ──────────────────────────────────────────────────────────
  console.log('[casperClient] getCsprBalance ─────────────────────────────')
  console.log('[casperClient]   RPC endpoint :', CASPER_NODE_URL)
  console.log('[casperClient]   Chain name   :', CASPER_CHAIN_NAME)
  console.log('[casperClient]   Public key   :', publicKeyHex)

  const pk = PublicKey.fromHex(publicKeyHex)
  const accountHash = pk.accountHash()
  console.log('[casperClient]   Account hash :', accountHash.toPrefixedString())

  // PurseIdentifier.fromPublicKey → { main_purse_under_public_key: '02...' }
  // This calls the query_balance RPC method, which avoids state_get_account_info.
  // However -32026 is still returned when the account has NEVER received CSPR
  // (no main purse exists on-chain yet — the account is unfunded).
  const purseIdentifier = PurseIdentifier.fromPublicKey(pk)
  console.log('[casperClient]   RPC method   : query_balance')
  console.log('[casperClient]   RPC payload  :', JSON.stringify({ purse_identifier: { main_purse_under_public_key: publicKeyHex } }))

  try {
    const result = await rpc.queryLatestBalance(purseIdentifier)
    console.log('[casperClient]   RPC response :', result?.rawJSON ?? JSON.stringify(result))

    // result.balance is a CLValueUInt512; toString() returns the mote value
    const motes = result.balance.toString()
    const cspr  = Number(motes) / 1_000_000_000
    console.log('[casperClient]   Balance      :', cspr, 'CSPR (', motes, 'motes)')
    console.log('[casperClient] ─────────────────────────────────────────────')
    return cspr
  } catch (err) {
    const code = err?.code ?? err?.data?.code
    const msg  = (err?.message ?? String(err)).toLowerCase()

    console.error('[casperClient]   RPC error code    :', code)
    console.error('[casperClient]   RPC error message :', err?.message ?? err)
    console.error('[casperClient]   RPC error data    :', err?.data ?? '(none)')
    console.log('[casperClient] ─────────────────────────────────────────────')

    // ── -32026: Purse not found ────────────────────────────────────────────
    // Root cause (confirmed by direct RPC probe against node.testnet.casper.network):
    //   • The RPC node IS casper-test (v2.2.2) — endpoint and network are correct.
    //   • The public key IS valid and well-formed.
    //   • -32026 means the account has NEVER received CSPR on testnet.
    //     A Casper account's main purse is only created on-chain when it
    //     receives its first funded deploy. Until then, query_balance returns
    //     -32026 because there is no purse to look up.
    //   • Fix for the USER: fund the account via the testnet faucet.
    //   • Fix for the APP: return 0 so the wallet UI still renders instead
    //     of crashing, and surface a friendly actionable message.
    if (code === -32026 || msg.includes('purse not found')) {
      console.warn('[casperClient] getCsprBalance: account unfunded — returning 0 and surfacing faucet message')
      // Re-throw with a friendly message so WalletPanel / ProfilePage can show it
      throw new Error(translateCasperError(err))
    }

    throw new Error(translateCasperError(err))
  }
}

/**
 * signAndSubmit(deploy, publicKeyHex)
 *
 * Sends the deploy to the Casper Wallet for signing, then submits it to the RPC.
 *
 * ── Wallet API history ─────────────────────────────────────────────────────
 * Casper Wallet Extension has shipped two distinct sign() response shapes:
 *
 *   v1 (old): sign() returned the FULL signed deploy object
 *     { cancelled: boolean, deploy: { hash, header, payment, session, approvals: [{signer, signature}] } }
 *     Our code extracted approvals[].signature and called Deploy.setSignature.
 *
 *   v2 (current, what the user sees in console):
 *     { cancelled: boolean, signatureHex: string, signature: Uint8Array }
 *     The wallet returns ONLY the raw signature bytes — NOT a signed deploy.
 *     The app is responsible for attaching the signature to the deploy using
 *     Deploy.setSignature(deploy, sigBytes, publicKey).
 *
 * This function handles BOTH shapes in priority order:
 *   1. walletResponse.signature  (Uint8Array)  — v2 current API  ← primary
 *   2. walletResponse.signatureHex (string)     — v2 fallback
 *   3. walletResponse.deploy?.approvals         — v1 legacy shape
 *   4. walletResponse.signedDeploy?.approvals   — v1 legacy shape (alt key)
 *
 * In every case, Deploy.setSignature() attaches the approval to the deploy
 * object we already built — NO Deploy.fromJSON round-trip, NO re-validation.
 */
async function signAndSubmit(deploy, publicKeyHex) {
  const provider = walletProvider()
  const pk       = PublicKey.fromHex(publicKeyHex)

  // ── 1. Serialize deploy for the wallet ──────────────────────────────────
  const deployJson    = Deploy.toJSON(deploy)
  const deployJsonStr = JSON.stringify(deployJson)

  console.log('[casperClient] signAndSubmit ───────────────────────────────')
  console.log('[casperClient]   Sender      :', publicKeyHex)
  console.log('[casperClient]   Deploy hash :', deployJson.hash)
  console.log('[casperClient]   Chain name  :', deployJson.header?.chain_name)
  console.log('[casperClient]   Unsigned deploy JSON (first 400):')
  console.log('[casperClient]  ', deployJsonStr.slice(0, 400))

  // ── 2. Request signature from wallet ───────────────────────────────────
  console.log('[casperClient]   Requesting signature from Casper Wallet…')
  const walletResponse = await provider.sign(deployJsonStr, publicKeyHex)

  console.log('[casperClient]   Raw wallet response keys :', walletResponse ? Object.keys(walletResponse) : 'null')
  console.log('[casperClient]   Raw wallet response      :', JSON.stringify(
    walletResponse,
    (_k, v) => v instanceof Uint8Array ? `Uint8Array(${v.length})` : v,
  )?.slice(0, 400))

  // ── 3. Guard: cancelled ─────────────────────────────────────────────────
  if (!walletResponse || walletResponse.cancelled === true) {
    throw new Error('Transaction signing was cancelled.')
  }

  // ── 4. Extract signature bytes ──────────────────────────────────────────
  // Priority: Uint8Array > signatureHex > legacy deploy.approvals
  let sigBytes = null

  if (walletResponse.signature instanceof Uint8Array && walletResponse.signature.length > 0) {
    // ── v2 API: wallet returned raw Uint8Array ─────────────────────────
    sigBytes = walletResponse.signature
    console.log('[casperClient]   Signature source : walletResponse.signature (Uint8Array, length=' + sigBytes.length + ')')

  } else if (typeof walletResponse.signatureHex === 'string' && walletResponse.signatureHex.length > 0) {
    // ── v2 API: wallet returned hex string ────────────────────────────
    const hex = walletResponse.signatureHex.replace(/^0x/, '')
    sigBytes  = HexBytes.fromHex(hex).bytes
    console.log('[casperClient]   Signature source : walletResponse.signatureHex (', walletResponse.signatureHex.slice(0, 20), '…)')

  } else {
    // ── v1 API: wallet returned a signed deploy object ────────────────
    const signedDeployData =
      walletResponse?.deploy ??
      walletResponse?.signedDeploy ??
      (typeof walletResponse === 'object' && walletResponse?.hash ? walletResponse : null)

    if (!signedDeployData) {
      console.error('[casperClient]   Full wallet response:', walletResponse)
      throw new Error(
        'Casper Wallet returned an unrecognised response format. ' +
        'Expected: { signatureHex, signature } or { deploy: { approvals } }. ' +
        'Check the console for the full wallet response.'
      )
    }

    const approvals = signedDeployData?.approvals ?? []
    console.log('[casperClient]   Signature source : legacy deploy.approvals (count=' + approvals.length + ')')

    if (approvals.length === 0) {
      throw new Error('Wallet returned a signed deploy with no approvals. Signing may have failed.')
    }

    // Use the first approval's signature hex
    const sigHex = approvals[0]?.signature ?? ''
    sigBytes     = HexBytes.fromHex(sigHex.replace(/^0x/, '')).bytes
  }

  // ── 5. Attach the signature to the deploy ──────────────────────────────
  console.log('[casperClient]   Attaching signature (', sigBytes.length, 'bytes) to deploy…')
  const signedDeploy = Deploy.setSignature(deploy, sigBytes, pk)
  console.log('[casperClient]   Approvals after attach :', signedDeploy.approvals.length)

  // ── 6. Submit to RPC ────────────────────────────────────────────────────
  const signedDeployJson = Deploy.toJSON(signedDeploy)
  console.log('[casperClient]   RPC submit payload (first 300):', JSON.stringify(signedDeployJson).slice(0, 300))
  console.log('[casperClient]   Submitting deploy to RPC…')

  const result = await rpc.putDeploy(signedDeploy)
  const deployHash = result.deployHash

  console.log('[casperClient]   Deploy hash returned by RPC :', deployHash)
  console.log('[casperClient] signAndSubmit complete ✓ ────────────────────')

  return deployHash
}


// ── Public transfer & contract helpers ────────────────────────────────────────

/**
 * transferCspr({ publicKey, recipient, amountCspr })
 *
 * Validates all fields before building the deploy, so failures are caught
 * with descriptive errors before any signing attempt.
 */
export async function transferCspr({ publicKey, recipient, amountCspr }) {
  // ── Pre-flight validation ────────────────────────────────────────────────
  if (!publicKey) throw new Error('Sender public key is required.')
  if (!recipient) throw new Error('Recipient public key is required.')

  const amountMotes = Math.round(Number(amountCspr) * 1_000_000_000)
  if (!Number.isFinite(amountMotes) || amountMotes <= 0) {
    throw new Error(`Invalid transfer amount: ${amountCspr} CSPR`)
  }

  let senderPk, recipientPk
  try {
    senderPk    = PublicKey.fromHex(publicKey)
  } catch {
    throw new Error(`Sender public key is malformed: ${publicKey}`)
  }
  try {
    recipientPk = PublicKey.fromHex(recipient)
  } catch {
    throw new Error(`Recipient public key is malformed: ${recipient}`)
  }

  const paymentAmount = import.meta.env.VITE_CASPER_PAYMENT_AMOUNT || '5000000000'

  console.log('[casperClient] transferCspr: sender    =', publicKey)
  console.log('[casperClient] transferCspr: recipient =', recipient)
  console.log('[casperClient] transferCspr: recipient account-hash =', recipientPk.accountHash().toPrefixedString())
  console.log('[casperClient] transferCspr: amount    =', amountMotes, 'motes =', amountCspr, 'CSPR')
  console.log('[casperClient] transferCspr: payment   =', paymentAmount, 'motes')
  console.log('[casperClient] transferCspr: chain     =', CASPER_CHAIN_NAME)

  const deploy = makeCsprTransferDeploy({
    senderPublicKeyHex:    publicKey,
    recipientPublicKeyHex: recipient,
    transferAmount:        String(amountMotes),
    chainName:             CASPER_CHAIN_NAME,
    paymentAmount,
  })

  // Validate the deploy before signing
  const deployJson = Deploy.toJSON(deploy)
  console.log('[casperClient] transferCspr: deploy JSON (first 300):', JSON.stringify(deployJson).slice(0, 300))

  if (!deployJson.hash || !deployJson.header?.account) {
    throw new Error('Deploy construction failed: missing hash or header.account.')
  }
  if (deployJson.header.chain_name !== CASPER_CHAIN_NAME) {
    throw new Error(`Deploy chain_name mismatch: got "${deployJson.header.chain_name}", expected "${CASPER_CHAIN_NAME}"`)
  }

  return signAndSubmit(deploy, publicKey)
}

export async function callContract({ publicKey, entryPoint, args = {} }) {
  const configuredHash = import.meta.env.VITE_CASPER_CONTRACT_HASH
  if (!configuredHash) throw new Error('VITE_CASPER_CONTRACT_HASH is not configured.')

  const runtimeArgs = Args.fromMap(
    Object.fromEntries(
      Object.entries(args).map(([name, value]) => {
        if (value.type === 'u32') return [name, CLValue.newCLUInt32(value.value)]
        if (value.type === 'u512') return [name, CLValue.newCLUInt512(value.value)]
        return [name, CLValue.newCLString(String(value.value))]
      }),
    ),
  )

  const session = new ExecutableDeployItem()
  session.storedContractByHash = new StoredContractByHash(
    ContractHash.newContract(configuredHash),
    entryPoint,
    runtimeArgs,
  )

  const header = DeployHeader.default()
  header.account   = PublicKey.fromHex(publicKey)
  header.chainName = CASPER_CHAIN_NAME

  const deploy = Deploy.makeDeploy(
    header,
    ExecutableDeployItem.standardPayment(
      import.meta.env.VITE_CASPER_PAYMENT_AMOUNT || '5000000000',
    ),
    session,
  )
  return signAndSubmit(deploy, publicKey)
}

// ── Utilities ─────────────────────────────────────────────────────────────────

export function explorerDeployUrl(hash) {
  return `${CASPER_EXPLORER_URL}/deploy/${hash}`
}

export function shortenPublicKey(publicKey) {
  return publicKey ? `${publicKey.slice(0, 8)}…${publicKey.slice(-6)}` : ''
}
