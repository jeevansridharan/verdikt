import React, { useCallback, useEffect, useState } from 'react'
import { Download, ExternalLink, Loader2, RefreshCw, Wallet } from 'lucide-react'
import { getCasperProvider } from '../services/casperClient'
import {
  connectCasperWallet,
  disconnectCasperWallet,
  explorerDeployUrl,
  getCsprBalance,
  shortenPublicKey,
  transferCspr,
} from '../services/casperClient'

export default function WalletPanel({ onRealFund, onWalletConnect }) {
  const [publicKey, setPublicKey] = useState('')
  const [balance, setBalance] = useState(null)
  const [amount, setAmount] = useState('')
  const [deployHash, setDeployHash] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // null = unchecked, true = found, false = not installed
  const [walletAvailable, setWalletAvailable] = useState(null)

  const refreshBalance = useCallback(async () => {
    if (!publicKey) return
    try {
      setBalance(await getCsprBalance(publicKey))
    } catch (err) {
      setError(err.message)
    }
  }, [publicKey])

  useEffect(() => {
    refreshBalance()
  }, [refreshBalance])

  // Poll for wallet extension on mount (up to 2 s)
  useEffect(() => {
    let cancelled = false
    getCasperProvider().then((provider) => {
      if (!cancelled) setWalletAvailable(provider !== null)
    })
    return () => { cancelled = true }
  }, [])

  const connect = async () => {
    setLoading(true)
    setError('')
    try {
      const wallet = await connectCasperWallet()
      setPublicKey(wallet.publicKey)
      onWalletConnect?.(wallet)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const disconnect = async () => {
    await disconnectCasperWallet()
    setPublicKey('')
    setBalance(null)
    onWalletConnect?.(null)
  }

  const fund = async () => {
    const recipient = import.meta.env.VITE_CASPER_FUNDING_RECIPIENT
    if (!recipient) return setError('VITE_CASPER_FUNDING_RECIPIENT is not configured.')
    if (!(Number(amount) > 0)) return setError('Enter a valid CSPR amount.')

    setLoading(true)
    setError('')
    try {
      const hash = await transferCspr({ publicKey, recipient, amountCspr: amount })
      setDeployHash(hash)
      onRealFund?.(Number(amount), hash, publicKey)
      await refreshBalance()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Wallet checking spinner ──────────────────────────────────────────────
  if (walletAvailable === null) {
    return (
      <div className="card-glass rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-3">
          <Loader2 size={18} className="animate-spin" color="#10b981" />
          <p className="text-slate-400 text-sm">Detecting Casper Wallet…</p>
        </div>
      </div>
    )
  }

  // ── Wallet not installed card ─────────────────────────────────────────────
  if (walletAvailable === false) {
    return (
      <div
        className="card-glass rounded-2xl p-6 mb-6"
        style={{
          border: '1px solid rgba(0,192,127,0.18)',
          boxShadow: '0 0 28px rgba(0,192,127,0.07)',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div
            style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'rgba(0,192,127,0.1)',
              border: '1px solid rgba(0,192,127,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Wallet size={19} color="#00C07F" />
          </div>
          <div>
            <h2 className="text-white font-bold text-base leading-tight">Casper Wallet Required</h2>
            <p className="text-slate-500 text-xs mt-0.5">Casper Testnet · CSPR</p>
          </div>
        </div>

        {/* Description */}
        <p className="text-slate-400 text-sm mb-5 leading-relaxed">
          To fund or interact with this project, you need the{' '}
          <span className="text-emerald-400 font-medium">Casper Wallet</span> browser extension.
        </p>

        {/* Install button */}
        <a
          href="https://casperwallet.io"
          target="_blank"
          rel="noreferrer"
          className="w-full py-3.5 rounded-xl font-bold text-white gradient-btn-green flex items-center justify-center gap-2 no-underline"
          style={{ display: 'flex' }}
        >
          <Download size={16} />
          Install Casper Wallet
        </a>

        {/* Already installed refresh link */}
        <button
          onClick={() => window.location.reload()}
          className="mt-3 w-full text-center text-slate-500 hover:text-emerald-400 text-xs transition-colors duration-200"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
        >
          Already installed? Refresh the page
        </button>
      </div>
    )
  }

  // ── Normal wallet UI ──────────────────────────────────────────────────────
  return (
    <div className="card-glass rounded-2xl p-6 mb-6">
      <div className="flex items-center gap-3 mb-5">
        <Wallet size={21} color="#10b981" />
        <div>
          <h2 className="text-white font-bold text-base">Casper Wallet</h2>
          <p className="text-slate-500 text-xs">Casper Testnet · CSPR</p>
        </div>
      </div>

      {!publicKey ? (
        <button onClick={connect} disabled={loading} className="w-full py-3.5 rounded-xl font-bold text-white gradient-btn-green flex items-center justify-center gap-2">
          {loading ? <Loader2 size={17} className="animate-spin" /> : <Wallet size={17} />}
          Connect Casper Wallet
        </button>
      ) : (
        <>
          <div className="rounded-xl p-4 mb-4 bg-white/5 border border-white/10">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Public key</p>
            <p className="text-slate-300 text-xs font-mono" title={publicKey}>{shortenPublicKey(publicKey)}</p>
          </div>
          <div className="flex items-center justify-between rounded-xl p-4 mb-5 bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-xl font-bold text-emerald-400">{balance?.toFixed(4) ?? '—'} CSPR</p>
            <button onClick={refreshBalance} className="p-2 bg-white/5 rounded-lg text-slate-400"><RefreshCw size={14} /></button>
          </div>
          <input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.0 CSPR" className="input-web3 w-full mb-3" />
          <button onClick={fund} disabled={loading} className="w-full py-3.5 rounded-xl font-bold text-white gradient-btn-green flex items-center justify-center gap-2">
            {loading && <Loader2 size={17} className="animate-spin" />} Fund project
          </button>
          <button onClick={disconnect} className="mt-4 text-slate-500 hover:text-red-400 text-xs w-full">Disconnect</button>
        </>
      )}

      {error && <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">{error}</div>}
      {deployHash && (
        <a href={explorerDeployUrl(deployHash)} target="_blank" rel="noreferrer" className="mt-4 flex items-center gap-2 text-emerald-400 text-xs">
          View deploy <ExternalLink size={13} />
        </a>
      )}
    </div>
  )
}
