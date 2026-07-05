import * as CasperSdk from 'casper-js-sdk'

const {
  AccountIdentifier,
  Args,
  CLValue,
  ContractHash,
  Deploy,
  DeployHeader,
  ExecutableDeployItem,
  HttpHandler,
  PublicKey,
  RpcClient,
  StoredContractByHash,
  makeCsprTransferDeploy,
} = CasperSdk

// Browser apps cannot call the Casper RPC node directly (CORS). Route through /casper-rpc.
function resolveRpcUrl() {
  if (import.meta.env.VITE_CASPER_NODE_URL) {
    return import.meta.env.VITE_CASPER_NODE_URL
  }
  if (typeof window !== 'undefined') {
    return '/casper-rpc'
  }
  return 'https://node.testnet.casper.network/rpc'
}

export const CASPER_NODE_URL   = resolveRpcUrl()
export const CASPER_CHAIN_NAME = import.meta.env.VITE_CASPER_CHAIN_NAME || 'casper-test'
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
 * Maps raw wallet / RPC errors to user-friendly messages.
 * -32009 "No such account" is the most common cause of confusion:
 *   it means the public key has never sent a deploy and has no on-chain
 *   account record, OR the account was deleted / switched.
 */
export function translateCasperError(err) {
  const msg = (err?.message ?? String(err)).toLowerCase()
  const code = err?.code ?? err?.data?.code

  if (code === -32009 || msg.includes('no such account') || msg.includes('-32009')) {
    return (
      'No Casper account found on this network. ' +
      'Please create or import an account into your Casper Wallet, ' +
      'then try connecting again.'
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
  // Return original message if no pattern matched
  return err?.message ?? String(err)
}

// ── Provider detection ────────────────────────────────────────────────────────
/**
 * getCasperProvider()
 *
 * Polls for window.CasperWalletProvider every 100 ms for up to 2 seconds
 * (20 attempts). Resolves with the provider constructor if found, or null
 * if the extension is not installed / not yet injected.
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
        console.warn('[casperClient] getCasperProvider: wallet extension NOT found after 2 s')
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
 * ALWAYS queries the live wallet extension for the currently selected account.
 * Never reads localStorage — that is the source of the -32009 bug.
 *
 * Returns the hex public key string, or null if the wallet is not installed
 * or has no active account.
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
 * Requests wallet connection, fetches the LIVE active public key, stores it
 * in localStorage for session persistence, and returns { provider, publicKey }.
 *
 * Key fix: clears the stale localStorage key BEFORE requesting connection so
 * a stale key can never be reused if the user switches or deletes accounts.
 */
export async function connectCasperWallet() {
  console.log('[casperClient] connectCasperWallet: starting…')
  console.log('[casperClient] connectCasperWallet: RPC =', CASPER_NODE_URL, '| chain =', CASPER_CHAIN_NAME)

  // Clear any stale cached key before we ask the wallet for the current one.
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
  console.log('[casperClient] connectCasperWallet: key cached to localStorage ✓')

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

// ── Balance & transfers ───────────────────────────────────────────────────────

export async function getCsprBalance(publicKeyHex) {
  console.log('[casperClient] getCsprBalance: fetching balance for', publicKeyHex?.slice(0, 12) + '…')
  try {
    const publicKey = PublicKey.fromHex(publicKeyHex)
    const account = await rpc.getAccountInfo(null, new AccountIdentifier(undefined, publicKey))
    const balance = await rpc.getLatestBalance(account.account.mainPurse.toPrefixedString())
    const cspr = Number(balance.balanceValue.toString()) / 1_000_000_000
    console.log('[casperClient] getCsprBalance: balance =', cspr, 'CSPR')
    return cspr
  } catch (err) {
    console.error('[casperClient] getCsprBalance: error —', err?.message ?? err)
    throw new Error(translateCasperError(err))
  }
}

async function signAndSubmit(deploy, publicKey) {
  const provider = walletProvider()
  console.log('[casperClient] signAndSubmit: requesting signature from wallet…')
  const signed = await provider.sign(JSON.stringify(Deploy.toJSON(deploy)), publicKey)
  console.log('[casperClient] signAndSubmit: wallet response =', signed?.cancelled ? 'CANCELLED' : 'signed ✓')
  if (signed?.cancelled) throw new Error('Transaction signing was cancelled.')

  const signedJson = signed?.deploy || signed?.signedDeploy || signed
  const signedDeploy = Deploy.fromJSON(
    typeof signedJson === 'string' ? JSON.parse(signedJson) : signedJson,
  )
  const result = await rpc.putDeploy(signedDeploy)
  console.log('[casperClient] signAndSubmit: deploy hash =', result.deployHash)
  return result.deployHash
}

export async function transferCspr({ publicKey, recipient, amountCspr }) {
  const deploy = makeCsprTransferDeploy({
    senderPublicKeyHex: publicKey,
    recipientPublicKeyHex: recipient,
    transferAmount: String(Math.round(Number(amountCspr) * 1_000_000_000)),
    chainName: CASPER_CHAIN_NAME,
    paymentAmount: import.meta.env.VITE_CASPER_PAYMENT_AMOUNT || '5000000000',
  })
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
  header.account = PublicKey.fromHex(publicKey)
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
