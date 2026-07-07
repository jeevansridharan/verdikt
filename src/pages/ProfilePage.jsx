/**
 * pages/ProfilePage.jsx
 * Casper Wallet identity + account overview
 */

import React, { useState, useEffect } from 'react'
import { Copy, CheckCircle, Wallet, Shield, ExternalLink, LogOut, AlertCircle } from 'lucide-react'
import {
    CASPER_EXPLORER_URL,
    disconnectCasperWallet,
    getCsprBalance,
    getActiveWalletAccount,
    translateCasperError,
} from '../services/casperClient'

// ── Info row ──────────────────────────────────────────────────────────────────
function InfoRow({ label, value, mono = false, color = '#94a3b8' }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600 }}>{label}</span>
            <span style={{ fontSize: '0.82rem', color, fontWeight: 700, fontFamily: mono ? 'monospace' : 'inherit', maxWidth: '260px', wordBreak: 'break-all', textAlign: 'right' }}>
                {value}
            </span>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ProfilePage() {
    const [address, setAddress]   = useState('')
    const [copied, setCopied]     = useState(false)
    const [balance, setBalance]   = useState(0)
    const [loading, setLoading]   = useState(false)
    const [loadError, setLoadError] = useState('')

    useEffect(() => {
        const loadConnectedWallet = async () => {
            setLoading(true)
            setLoadError('')

            try {
                // ── Guard: Casper Wallet extension not installed ──────────────────────
                // Do NOT call getActiveWalletAccount() without this check.
                // If the extension is absent, calling CasperWalletProvider() internally
                // triggers a MetaMask fallback that throws an uncaught promise error.
                if (typeof window === 'undefined' || typeof window.CasperWalletProvider !== 'function') {
                    console.log('[ProfilePage] Casper Wallet extension not detected — skipping session restore')
                    setLoading(false)
                    return
                }

                const cachedKey = localStorage.getItem('arbit_casper_public_key')
                console.log('[ProfilePage] loadConnectedWallet: cached key =', cachedKey?.slice(0, 12) ?? '(none)')

                // Always ask the live extension for the current account.
                // Never blindly trust localStorage — that is the root cause of -32009.
                const liveKey = await getActiveWalletAccount()
                console.log('[ProfilePage] loadConnectedWallet: live key  =', liveKey?.slice(0, 12) ?? '(none)')

                if (!liveKey) {
                    // No active account in the wallet extension
                    if (cachedKey) {
                        console.warn('[ProfilePage] loadConnectedWallet: no live key, clearing stale cache')
                        localStorage.removeItem('arbit_casper_public_key')
                    }
                    setLoading(false)
                    return
                }

                if (cachedKey && cachedKey !== liveKey) {
                    console.warn('[ProfilePage] loadConnectedWallet: cached key differs from live key — using live key')
                    localStorage.removeItem('arbit_casper_public_key')
                }

                // Verify the account exists on-chain before displaying it
                try {
                    console.log('[ProfilePage] loadConnectedWallet: fetching on-chain balance…')
                    const bal = await getCsprBalance(liveKey)
                    console.log('[ProfilePage] loadConnectedWallet: balance =', bal, 'CSPR')

                    // Account confirmed valid — update cache and display
                    localStorage.setItem('arbit_casper_public_key', liveKey)
                    setAddress(liveKey)
                    setBalance(bal)
                } catch (err) {
                    const friendly = translateCasperError(err)
                    console.error('[ProfilePage] loadConnectedWallet: on-chain check failed —', friendly)
                    // Clear stale key so wallet panel shows Connect button
                    localStorage.removeItem('arbit_casper_public_key')
                    setLoadError(friendly)
                }
            } catch (err) {
                // Outer catch: silently swallow any unexpected startup errors
                // (including any wallet provider shim errors)
                console.warn('[ProfilePage] loadConnectedWallet: unexpected error (suppressed) —', err?.message ?? err)
            } finally {
                setLoading(false)
            }
        }

        loadConnectedWallet()
    }, [])

    const handleCopy = () => {
        if (!address) return
        navigator.clipboard.writeText(address)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleDisconnect = async () => {
        await disconnectCasperWallet()
        setAddress('')
        setBalance(0)
        setLoadError('')
        window.location.reload()
    }

    return (
        <div>
            {/* Header */}
            <div style={{ marginBottom: '28px' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.03em', marginBottom: '6px' }}>
                    Profile
                </h1>
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Your decentralized identity on Casper Network</p>
            </div>

            {/* Wallet card */}
            <div style={{ background: 'rgba(15,17,35,0.85)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '16px', padding: '28px', backdropFilter: 'blur(20px)', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 24px rgba(59,130,246,0.3)' }}>
                        <Wallet size={26} color="white" />
                    </div>
                    <div>
                        <p style={{ color: '#f1f5f9', fontWeight: 800, fontSize: '1.1rem' }}>Casper Wallet</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: address ? '#3b82f6' : '#475569', boxShadow: address ? '0 0 6px rgba(59,130,246,0.8)' : 'none' }} />
                            <span style={{ fontSize: '0.75rem', color: address ? '#3b82f6' : '#475569', fontWeight: 600 }}>
                                {loading ? 'Checking account…' : address ? 'Active Session · Casper' : 'Session Inactive'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Error banner */}
                {loadError && (
                    <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: '10px',
                        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                        borderRadius: '10px', padding: '12px 14px', marginBottom: '16px',
                    }}>
                        <AlertCircle size={15} color="#f87171" style={{ flexShrink: 0, marginTop: '1px' }} />
                        <p style={{ color: '#f87171', fontSize: '0.8rem', lineHeight: 1.6, margin: 0 }}>
                            {loadError}
                        </p>
                    </div>
                )}

                {address ? (
                    <>
                        <InfoRow label="Wallet Address" value={address} mono color="#3b82f6" />
                        <InfoRow label="CSPR Balance" value={`${balance.toFixed(4)} CSPR`} color="#3b82f6" />
                        <InfoRow label="Network" value="Casper Testnet" color="#60a5fa" />

                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                            <button
                                onClick={handleCopy}
                                style={{
                                    flex: 1, padding: '10px', borderRadius: '10px', cursor: 'pointer',
                                    background: copied ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)',
                                    border: copied ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(59,130,246,0.25)',
                                    color: copied ? '#60a5fa' : '#3b82f6', fontWeight: 700, fontSize: '0.82rem',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.2s',
                                }}
                            >
                                {copied ? <><CheckCircle size={14} /> Copied!</> : <><Copy size={14} /> Copy Address</>}
                            </button>
                            <a
                                href={`${CASPER_EXPLORER_URL}/account/${address}`}
                                target="_blank" rel="noreferrer"
                                style={{
                                    flex: 1, padding: '10px', borderRadius: '10px', cursor: 'pointer',
                                    background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)',
                                    color: '#06b6d4', fontWeight: 700, fontSize: '0.82rem',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                    textDecoration: 'none', transition: 'all 0.2s',
                                }}
                            >
                                <ExternalLink size={14} /> View on Explorer
                            </a>
                        </div>
                    </>
                ) : (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <p style={{ color: '#475569', fontSize: '0.875rem', marginBottom: '16px' }}>
                            {loadError
                                ? 'Connect your wallet after resolving the issue above.'
                                : 'Connect your wallet to see your profile details.'}
                        </p>
                    </div>
                )}
            </div>

            {/* Security card */}
            <div style={{ background: 'rgba(15,17,35,0.85)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '24px', backdropFilter: 'blur(20px)', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <Shield size={16} color="#fbbf24" />
                    <h2 style={{ color: '#fbbf24', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Autonomous Security
                    </h2>
                </div>
                {[
                    'Non-Custodial: Your keys, your funds. We never store them on our servers.',
                    'Casper Network: Transactions are finalized by Casper validators.',
                    'Testnet Warning: This is a dev environment. Use only testnet CSPR.',
                    'Identity: Your profile is derived from your connected Casper public key.',
                ].map((note, i) => (
                    <p key={i} style={{ color: '#64748b', fontSize: '0.8rem', lineHeight: 1.7 }}>• {note}</p>
                ))}
            </div>

            {address && (
                <button
                    onClick={handleDisconnect}
                    style={{
                        width: '100%', padding: '12px', borderRadius: '12px', cursor: 'pointer',
                        background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
                        color: '#f87171', fontWeight: 700, fontSize: '0.875rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s',
                    }}
                >
                    <LogOut size={16} /> Disconnect Wallet
                </button>
            )}
        </div>
    )
}
