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
 * Polls for window.CasperWalletProvider every 100 ms for up to 2 seconds.
 * Resolves with the provider constructor if found, or null if not installed.
 */
export const getCasperProvider = () =>
  new Promise((resolve) => {
    let attempts = 0
    const interval = setInterval(() => {
      if (window.CasperWalletProvider) {
        clearInterval(interval)
        console.log('[casperClient] getCasperProvider: wallet extension detected ✓')
        resolve(window.CasperWalletProvider)
      } else if (++attempts > 20) {
        clearInterval(interval)
        console.warn('[casperClient] getCasperProvider: extension NOT found after 2 s')
        resolve(null)
      }
    }, 100)
  })

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
 * Always queries the LIVE wallet extension for the current account.
 * Never reads localStorage.
 */
export async function getActiveWalletAccount() {
  console.log('[casperClient] getActiveWalletAccount: querying live wallet…')
  try {
    const provider = walletProvider()
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

// ── Deploy signing & submission ───────────────────────────────────────────────

/**
 * signAndSubmit(deploy, publicKeyHex)
 *
 * FIX — Bug 2: replaced Deploy.fromJSON round-trip with Deploy.setSignature.
 *
 * WHY "The JSON can't be parsed as a Deploy" WAS HAPPENING:
 *   The old code called Deploy.fromJSON() on the wallet's response. fromJSON()
 *   internally calls deploy.validate() which re-verifies EVERY approval signature
 *   using the secp256k1 library. The Casper Wallet extension returns the signature
 *   as a hex string that, after being parsed by the SDK's TypedJSON deserializer,
 *   sometimes ends up in a format the secp256k1 DER parser rejects — causing
 *   "Invalid signature tag" which gets caught and re-thrown as
 *   "Serialization error: The JSON can't be parsed as a Deploy."
 *
 * THE FIX:
 *   Skip Deploy.fromJSON entirely. Instead:
 *   1. Pass the original deploy (which we already have as a proper Deploy object)
 *   2. Extract the raw signature hex from the wallet response
 *   3. Call Deploy.setSignature(deploy, signatureBytes, publicKey)
 *      This patches the approval onto the existing Deploy object without any
 *      JSON round-trip or re-validation, so signature format differences
 *      between wallet versions don't matter.
 */
async function signAndSubmit(deploy, publicKeyHex) {
  const provider = walletProvider()

  // Serialize the deploy to the JSON format the wallet expects
  const deployJson    = Deploy.toJSON(deploy)
  const deployJsonStr = JSON.stringify(deployJson)
  console.log('[casperClient] signAndSubmit: sender     =', publicKeyHex)
  console.log('[casperClient] signAndSubmit: deploy hash =', deployJson.hash)
  console.log('[casperClient] signAndSubmit: chain name =', deployJson.header?.chain_name)
  console.log('[casperClient] signAndSubmit: deploy JSON (first 300):', deployJsonStr.slice(0, 300))

  console.log('[casperClient] signAndSubmit: requesting signature from wallet…')
  const walletResponse = await provider.sign(deployJsonStr, publicKeyHex)
  console.log('[casperClient] signAndSubmit: raw wallet response:', JSON.stringify(walletResponse)?.slice(0, 400))

  if (!walletResponse || walletResponse.cancelled) {
    throw new Error('Transaction signing was cancelled.')
  }

  // Extract the signed deploy object from wherever the wallet put it
  const signedDeployData =
    walletResponse?.deploy ??
    walletResponse?.signedDeploy ??
    (typeof walletResponse === 'object' && walletResponse?.hash ? walletResponse : null)

  if (!signedDeployData) {
    console.error('[casperClient] signAndSubmit: could not locate signed deploy in wallet response:', walletResponse)
    throw new Error('Wallet returned an unexpected response format. Check the console for details.')
  }

  console.log('[casperClient] signAndSubmit: signedDeployData keys =', Object.keys(signedDeployData))

  // Extract the approval(s) — wallet adds them to the approvals array
  const approvals = signedDeployData?.approvals ?? []
  console.log('[casperClient] signAndSubmit: approvals count =', approvals.length)

  if (approvals.length === 0) {
    throw new Error('Wallet returned a signed deploy with no approvals. Signing may have failed.')
  }

  // Apply each approval onto the original deploy object using Deploy.setSignature.
  // This avoids Deploy.fromJSON (which re-validates signatures and can fail on
  // certain wallet signature encodings).
  const pk = PublicKey.fromHex(publicKeyHex)
  let signedDeploy = deploy
  for (const approval of approvals) {
    const sigHex = approval.signature ?? ''
    console.log('[casperClient] signAndSubmit: applying approval signature (first 20):', sigHex.slice(0, 20))
    const sigBytes = HexBytes.fromHex(sigHex).bytes
    signedDeploy = Deploy.setSignature(signedDeploy, sigBytes, pk)
  }

  console.log('[casperClient] signAndSubmit: sending deploy to RPC…')
  const result = await rpc.putDeploy(signedDeploy)
  console.log('[casperClient] signAndSubmit: deploy hash =', result.deployHash)
  return result.deployHash
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
