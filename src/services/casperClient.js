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

export const CASPER_NODE_URL =
  import.meta.env.VITE_CASPER_NODE_URL || 'https://node.testnet.casper.network/rpc'
export const CASPER_CHAIN_NAME = import.meta.env.VITE_CASPER_CHAIN_NAME || 'casper-test'
export const CASPER_EXPLORER_URL =
  import.meta.env.VITE_CASPER_EXPLORER_URL || 'https://testnet.cspr.live'

const rpc = new RpcClient(new HttpHandler(CASPER_NODE_URL))

/**
 * getCasperProvider()
 *
 * Polls for window.CasperWalletProvider every 100 ms for up to 2 seconds
 * (20 attempts). Resolves with the provider constructor if found, or null
 * if the extension is not installed / not yet injected.
 *
 * This prevents false "not installed" errors on slow extension injection.
 */
export const getCasperProvider = () =>
  new Promise((resolve) => {
    let attempts = 0
    const interval = setInterval(() => {
      if (window.CasperWalletProvider) {
        clearInterval(interval)
        resolve(window.CasperWalletProvider)
      } else if (++attempts > 20) {
        clearInterval(interval)
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

export async function connectCasperWallet() {
  const provider = walletProvider()
  const connected = await provider.requestConnection()
  if (!connected) throw new Error('Casper Wallet connection was declined.')
  const publicKey = await provider.getActivePublicKey()
  localStorage.setItem('arbit_casper_public_key', publicKey)
  return { provider, publicKey }
}

export async function disconnectCasperWallet() {
  const provider = walletProvider()
  await provider.disconnectFromSite()
  localStorage.removeItem('arbit_casper_public_key')
}

export async function getCsprBalance(publicKeyHex) {
  const publicKey = PublicKey.fromHex(publicKeyHex)
  const account = await rpc.getAccountInfo(null, new AccountIdentifier(undefined, publicKey))
  const balance = await rpc.getLatestBalance(account.account.mainPurse.toPrefixedString())
  return Number(balance.balanceValue.toString()) / 1_000_000_000
}

async function signAndSubmit(deploy, publicKey) {
  const provider = walletProvider()
  const signed = await provider.sign(JSON.stringify(Deploy.toJSON(deploy)), publicKey)
  if (signed?.cancelled) throw new Error('Transaction signing was cancelled.')

  const signedJson = signed?.deploy || signed?.signedDeploy || signed
  const signedDeploy = Deploy.fromJSON(
    typeof signedJson === 'string' ? JSON.parse(signedJson) : signedJson,
  )
  const result = await rpc.putDeploy(signedDeploy)
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

export function explorerDeployUrl(hash) {
  return `${CASPER_EXPLORER_URL}/deploy/${hash}`
}

export function shortenPublicKey(publicKey) {
  return publicKey ? `${publicKey.slice(0, 8)}…${publicKey.slice(-6)}` : ''
}
