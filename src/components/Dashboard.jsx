/**
 * Dashboard.jsx â€” Arbit Project Dashboard
 *
 * AI evaluation is now milestone-scoped:
 *   Each MilestoneCard has its own proof textarea + "Evaluate with AI" button.
 *   Clicking evaluate â†’ POST /api/evaluate â†’ score stored in that milestone's state.
 *   score >= 80 â†’ approved, else â†’ rejected.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { fetchProjectById } from '../lib/db/projects'
import ProgressBar from './ProgressBar'
import MilestoneCard from './MilestoneCard'
import WalletPanel from './WalletPanel'
import { Brain, CheckCircle } from 'lucide-react'

const AI_BACKEND = 'http://localhost:3001'

// â”€â”€ Spinner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function LoadingSpinner() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
            <div style={{
                width: '40px', height: '40px', borderRadius: '50%',
                border: '3px solid rgba(16,185,129,0.2)',
                borderTopColor: '#10b981',
                animation: 'dashSpin 0.8s linear infinite',
                marginBottom: '16px',
            }} />
            <p style={{ color: '#475569', fontSize: '0.85rem', fontWeight: 600 }}>Synchronizing with blockchainâ€¦</p>
            <style>{`@keyframes dashSpin { to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function Dashboard({ project: initialProject, onFund, onTransaction, onReset }) {
    const [project, setProject]             = useState(initialProject)
    const [milestones, setMilestones]       = useState([])
    const [loading, setLoading]             = useState(true)
    const [error, setError]                 = useState(null)
    const [connectedWallet, setConnectedWallet] = useState(null)

    // â”€â”€ Fetch project from DB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const fetchProjectData = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true)
        try {
            const { data, error: fetchError } = await fetchProjectById(initialProject.id)
            if (fetchError) throw fetchError
            if (data) {
                setProject(data)
                // Hydrate milestones with proof/score/status if not already set
                const raw = Array.isArray(data.milestones) ? data.milestones : []
                setMilestones(raw.map(m => ({
                    ...m,
                    proof:  m.proof  ?? '',
                    score:  typeof m.score === 'number' ? m.score : null,
                    status: m.status ?? 'pending',
                })))
            }
        } catch (err) {
            console.error('[Dashboard] Sync error:', err.message)
            setError(err.message)
        } finally {
            if (!isSilent) setLoading(false)
        }
    }, [initialProject.id])

    useEffect(() => { fetchProjectData() }, [fetchProjectData])

    // â”€â”€ Fund handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const handleFundComplete = async (amount, txHash) => {
        if (onFund) await onFund(amount, txHash, connectedWallet?.cashaddr)
        await fetchProjectData(true)
    }

    // â”€â”€ AI Evaluate a milestone â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    /**
     * Called by MilestoneCard when user clicks "Evaluate with AI".
     * Hits the backend, then updates that specific milestone in local state.
     *
     * @param {string|number} milestoneId
     * @param {string}        proof        â€” the proof description text
     */
    const handleAIEvaluate = async (milestoneId, proof) => {
        const response = await fetch(`${AI_BACKEND}/api/evaluate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workDescription: proof }),
        })

        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'AI evaluation failed')

        const score = data.score ?? 0
        const status = score >= 80 ? 'approved' : 'rejected'

        console.log(`[Dashboard] Milestone ${milestoneId} â†’ score=${score} â†’ ${status}`)

        setMilestones(prev => prev.map(m =>
            m.id === milestoneId
                ? { ...m, proof, score, status }
                : m
        ))
    }

    // â”€â”€ Derived values â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const title         = project?.title ?? 'Untitled Project'
    const description   = project?.description ?? ''
    const fundingTarget = parseFloat(project?.goal_amount ?? 0)
    const fundedAmount  = parseFloat(project?.raised_amount ?? 0)
    const approvedCount = milestones.filter(m => m.status === 'approved').length

    const cleanDescription = (text) => {
        if (!text) return ''
        return text.replace(/\[On-Chain Address: bchtest:[^\]]+\]/g, '').trim()
    }

    const contract_address = project?.contract_address
        || (project?.description?.includes('[On-Chain Address: ')
            ? project.description.match(/\[On-Chain Address: (bchtest:[^\]]+)\]/)?.[1]
            : null)

    if (loading && !project) return <LoadingSpinner />

    return (
        <div style={{ maxWidth: '720px', margin: '0 auto', paddingBottom: '80px' }}>

            {/* â”€â”€ Page header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                <div>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '7px',
                        padding: '3px 10px', borderRadius: '999px', marginBottom: '10px',
                        background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)',
                    }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 5px rgba(52,211,153,0.9)' }} />
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#34d399', letterSpacing: '0.06em' }}>Live Dashboard Â· Casper Network</span>
                    </div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.03em', marginBottom: '4px' }}>
                        {title}
                    </h1>
                    {contract_address && (
                        <p style={{ color: '#475569', fontSize: '0.75rem', fontFamily: 'monospace', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: '#a78bfa' }}>ðŸ›¡ï¸ Contract:</span> {contract_address}
                        </p>
                    )}
                </div>
                <button
                    onClick={onReset}
                    style={{
                        padding: '8px 16px', borderRadius: '10px', cursor: 'pointer', flexShrink: 0,
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                        color: '#64748b', fontSize: '0.82rem', fontWeight: 600, transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#f1f5f9'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
                >
                    â† All Projects
                </button>
            </div>

            {error && (
                <div style={{ marginBottom: '20px', padding: '14px', borderRadius: '12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: '0.83rem' }}>
                    âš ï¸ Error: {error}
                </div>
            )}

            {/* â”€â”€ Stats row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px', marginBottom: '20px' }}>
                {[
                    { label: 'Target',        value: `${fundingTarget.toFixed(2)} CSPR`, color: '#10b981' },
                    { label: 'Raised',         value: `${fundedAmount.toFixed(4)} CSPR`, color: '#34d399' },
                    { label: 'AI Evaluations', value: `${approvedCount}/${milestones.length} done`, color: '#a78bfa' },
                ].map(({ label, value, color }) => (
                    <div key={label} style={{
                        background: 'rgba(15,17,35,0.85)', border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '14px', padding: '18px 20px',
                        backdropFilter: 'blur(20px)',
                    }}>
                        <p style={{ fontSize: '0.68rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>{label}</p>
                        <p style={{ fontSize: '1.1rem', fontWeight: 800, color }}>{value}</p>
                    </div>
                ))}
            </div>

            {/* â”€â”€ Project info + funding progress â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div style={{ background: 'rgba(15,17,35,0.85)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '28px', marginBottom: '20px', backdropFilter: 'blur(20px)' }}>
                <h2 style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>About</h2>
                <p style={{ color: '#94a3b8', lineHeight: 1.65, fontSize: '0.9rem', marginBottom: '24px' }}>
                    {cleanDescription(description)}
                </p>
                <ProgressBar current={fundedAmount} target={fundingTarget} />
            </div>

            {/* â”€â”€ Wallet panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <WalletPanel
                onRealFund={handleFundComplete}
                onWalletConnect={setConnectedWallet}
            />

            {/* â”€â”€ Milestones section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div style={{ background: 'rgba(15,17,35,0.85)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '28px', marginTop: '20px', backdropFilter: 'blur(20px)' }}>
                {/* Section header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <div>
                        <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Brain size={18} color="#a78bfa" />
                            Milestones
                        </h2>
                        <p style={{ fontSize: '0.78rem', color: '#475569' }}>
                            Submit proof per milestone â€” AI evaluates and auto-approves at score â‰¥ 80
                        </p>
                    </div>
                    <div style={{
                        fontSize: '0.72rem', fontWeight: 700, color: '#34d399',
                        padding: '4px 12px', borderRadius: '999px',
                        background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
                    }}>
                        {approvedCount}/{milestones.length} approved
                    </div>
                </div>

                {/* Milestone list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {milestones.length > 0 ? (
                        milestones.map((milestone, index) => (
                            <MilestoneCard
                                key={milestone.id}
                                milestone={milestone}
                                index={index}
                                onEvaluate={handleAIEvaluate}
                            />
                        ))
                    ) : (
                        <p style={{ color: '#475569', fontSize: '0.85rem', textAlign: 'center', padding: '24px 0' }}>
                            No milestones defined for this project.
                        </p>
                    )}
                </div>

                {/* All approved banner */}
                {approvedCount === milestones.length && milestones.length > 0 && (
                    <div style={{
                        marginTop: '20px', padding: '18px', borderRadius: '12px', textAlign: 'center',
                        background: 'rgba(16,185,129,0.09)', border: '1px solid rgba(16,185,129,0.3)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                    }}>
                        <CheckCircle size={28} color="#10b981" />
                        <p style={{ color: '#10b981', fontWeight: 800, fontSize: '1rem' }}>ðŸŽ‰ All milestones AI-approved!</p>
                        <p style={{ color: '#475569', fontSize: '0.82rem' }}>Funds have been automatically released by the AI oracle.</p>
                    </div>
                )}
            </div>
        </div>
    )
}

