/**
 * MilestoneCard.jsx â€” Per-milestone AI evaluation (Arbit)
 *
 * Each card exposes:
 *   â€¢ Proof textarea  â€” what the creator submits
 *   â€¢ "Evaluate with AI" button
 *   â€¢ Score bar (animated)
 *   â€¢ Status badge: Pending / Approved / Rejected
 *
 * Props:
 *   milestone  â€” { id, title, description?, amount?, score, status, proof }
 *   index      â€” display number
 *   onEvaluate â€” async (milestoneId, proof) => void  (provided by Dashboard)
 */
import React, { useState } from 'react'
import { Brain, CheckCircle, XCircle, Clock, Loader2, Send, ChevronDown, ChevronUp } from 'lucide-react'

// â”€â”€ Status badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function StatusBadge({ status }) {
    if (status === 'approved') {
        return (
            <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                fontSize: '0.68rem', fontWeight: 700, padding: '3px 10px',
                borderRadius: '999px', whiteSpace: 'nowrap',
                background: 'rgba(16,185,129,0.12)',
                border: '1px solid rgba(16,185,129,0.3)',
                color: '#34d399',
            }}>
                <CheckCircle size={11} /> AI Approved
            </span>
        )
    }
    if (status === 'rejected') {
        return (
            <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                fontSize: '0.68rem', fontWeight: 700, padding: '3px 10px',
                borderRadius: '999px', whiteSpace: 'nowrap',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#f87171',
            }}>
                <XCircle size={11} /> AI Rejected
            </span>
        )
    }
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            fontSize: '0.68rem', fontWeight: 700, padding: '3px 10px',
            borderRadius: '999px', whiteSpace: 'nowrap',
            background: 'rgba(234,179,8,0.12)',
            border: '1px solid rgba(234,179,8,0.3)',
            color: '#fbbf24',
        }}>
            <Clock size={11} /> Pending
        </span>
    )
}

// â”€â”€ Score bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ScoreBar({ score }) {
    const color = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#f43f5e'
    return (
        <div style={{ margin: '14px 0 4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>AI Score</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color }}>{score} / 100</span>
            </div>
            <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{
                    height: '100%', borderRadius: '999px', width: `${score}%`,
                    background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                    transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
                    boxShadow: `0 0 10px ${color}80`,
                }} />
            </div>
        </div>
    )
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function MilestoneCard({ milestone, index, onEvaluate }) {
    const { id, title, description, score, status, amount } = milestone

    // Local state for proof text + loading + error + expand toggle
    const [proof, setProof]         = useState(milestone.proof ?? '')
    const [evaluating, setEvaluating] = useState(false)
    const [evalError, setEvalError]   = useState('')
    const [expanded, setExpanded]     = useState(status === 'pending')

    const isApproved = status === 'approved'
    const isRejected = status === 'rejected'
    const isScored   = typeof score === 'number'

    // Border glow per status
    const borderColor = isApproved
        ? 'rgba(16,185,129,0.35)'
        : isRejected
            ? 'rgba(239,68,68,0.25)'
            : 'rgba(255,255,255,0.06)'

    const handleEvaluate = async () => {
        if (!proof.trim()) {
            setEvalError('Please describe your proof before evaluating.')
            return
        }
        setEvaluating(true)
        setEvalError('')
        try {
            await onEvaluate(id, proof)
        } catch (e) {
            setEvalError(e.message || 'Evaluation failed. Is the backend running?')
        } finally {
            setEvaluating(false)
        }
    }

    return (
        <div style={{
            background: isApproved
                ? 'rgba(16,185,129,0.04)'
                : isRejected
                    ? 'rgba(239,68,68,0.03)'
                    : 'rgba(15,17,35,0.7)',
            border: `1px solid ${borderColor}`,
            borderRadius: '16px',
            padding: '20px 22px',
            transition: 'border-color 0.3s, background 0.3s',
        }}>

            {/* â”€â”€ Header row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 }}>
                    {/* Index badge */}
                    <div style={{
                        width: '32px', height: '32px', borderRadius: '9px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.8rem', fontWeight: 800, flexShrink: 0, marginTop: '2px',
                        background: isApproved ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)',
                        color: isApproved ? '#10b981' : '#64748b',
                    }}>
                        {isApproved ? 'âœ“' : index + 1}
                    </div>

                    {/* Title + subtitle */}
                    <div style={{ flex: 1 }}>
                        <h3 style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '0.95rem', marginBottom: '2px' }}>
                            {title}
                        </h3>
                        <p style={{ color: '#475569', fontSize: '0.75rem' }}>
                            {description || (isScored
                                ? `AI evaluated â€” ${score}/100`
                                : 'Submit proof to trigger AI evaluation')}
                        </p>
                    </div>
                </div>

                {/* Right: badge + toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {amount != null && (
                        <span style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 700 }}>
                            {parseFloat(amount).toFixed(2)} CSPR
                        </span>
                    )}
                    <StatusBadge status={status ?? 'pending'} />
                    <button
                        onClick={() => setExpanded(x => !x)}
                        style={{
                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '8px', color: '#64748b', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', padding: '4px 6px',
                            transition: 'all 0.2s',
                        }}
                    >
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                </div>
            </div>

            {/* â”€â”€ Score bar (if scored) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {isScored && <ScoreBar score={score} />}

            {/* â”€â”€ Expandable panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {expanded && (
                <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>

                    {/* Proof textarea */}
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '8px' }}>
                        Milestone Proof
                    </label>
                    <textarea
                        value={proof}
                        onChange={e => { setProof(e.target.value); setEvalError('') }}
                        placeholder={`Describe what you achieved for "${title}"â€¦\nEx: Deployed the smart contract at 0xâ€¦ Tested with 500 transactionsâ€¦`}
                        disabled={isApproved || evaluating}
                        rows={4}
                        style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            background: 'rgba(5,7,20,0.5)',
                            border: `1px solid ${evalError ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.07)'}`,
                            borderRadius: '10px',
                            padding: '12px 14px',
                            color: '#f1f5f9',
                            fontSize: '0.85rem',
                            lineHeight: '1.65',
                            resize: 'vertical',
                            outline: 'none',
                            fontFamily: 'inherit',
                            transition: 'border-color 0.2s',
                            opacity: isApproved ? 0.6 : 1,
                        }}
                        onFocus={e => { if (!isApproved) e.currentTarget.style.borderColor = 'rgba(167,139,250,0.4)' }}
                        onBlur={e => e.currentTarget.style.borderColor = evalError ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.07)'}
                    />

                    {evalError && (
                        <p style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '6px', fontWeight: 500 }}>
                            âš  {evalError}
                        </p>
                    )}

                    {/* Evaluate button */}
                    {!isApproved && (
                        <button
                            onClick={handleEvaluate}
                            disabled={evaluating || !proof.trim()}
                            style={{
                                marginTop: '12px',
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '10px 20px', borderRadius: '10px',
                                cursor: evaluating || !proof.trim() ? 'not-allowed' : 'pointer',
                                background: evaluating
                                    ? 'rgba(167,139,250,0.08)'
                                    : !proof.trim()
                                        ? 'rgba(255,255,255,0.04)'
                                        : 'linear-gradient(135deg,#a78bfa,#7c3aed)',
                                border: evaluating || !proof.trim()
                                    ? '1px solid rgba(167,139,250,0.15)'
                                    : 'none',
                                color: evaluating || !proof.trim() ? '#a78bfa' : '#fff',
                                fontSize: '0.85rem', fontWeight: 700,
                                transition: 'all 0.2s',
                                boxShadow: !evaluating && proof.trim() ? '0 0 20px rgba(167,139,250,0.3)' : 'none',
                            }}
                            onMouseEnter={e => {
                                if (!evaluating && proof.trim()) {
                                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(167,139,250,0.5)'
                                    e.currentTarget.style.transform = 'translateY(-1px)'
                                }
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.boxShadow = !evaluating && proof.trim() ? '0 0 20px rgba(167,139,250,0.3)' : 'none'
                                e.currentTarget.style.transform = 'translateY(0)'
                            }}
                        >
                            {evaluating ? (
                                <>
                                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                                    Evaluatingâ€¦
                                </>
                            ) : (
                                <>
                                    <Brain size={16} />
                                    Evaluate with AI
                                    <Send size={14} />
                                </>
                            )}
                        </button>
                    )}

                    {/* AI result note */}
                    {isScored && (
                        <div style={{
                            marginTop: '14px',
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '10px 14px', borderRadius: '10px',
                            background: isApproved ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.06)',
                            border: isApproved ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(239,68,68,0.2)',
                        }}>
                            <Brain size={13} color={isApproved ? '#10b981' : '#f87171'} />
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isApproved ? '#34d399' : '#f87171' }}>
                                {isApproved
                                    ? `Score ${score}/100 â€” AI Approved. Funds will be released automatically.`
                                    : `Score ${score}/100 â€” AI Rejected. Score must be â‰¥ 80 to approve.`}
                            </span>
                        </div>
                    )}

                    {isApproved && (
                        <p style={{ fontSize: '0.65rem', color: '#10b981', opacity: 0.5, textAlign: 'center', marginTop: '10px', fontWeight: 700, letterSpacing: '0.08em' }}>
                            ðŸ¤– SECURED BY AI ORACLE Â· HASHKEY CHAIN
                        </p>
                    )}
                </div>
            )}

            {/* Spin keyframe */}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}

