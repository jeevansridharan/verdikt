import React, { useState } from 'react'
import { Brain, Star, ArrowRight, Loader2 } from 'lucide-react'

export default function AIEvaluationPanel() {
    const [description, setDescription] = useState('')
    const [evaluation, setEvaluation] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const evaluateWork = async () => {
        if (!description.trim()) {
            setError('Please describe your work first.')
            return
        }

        setLoading(true)
        setError('')
        setEvaluation(null)

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/evaluate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ submission: description, threshold: 75 }),
            })

            const data = await response.json()

            if (!response.ok) throw new Error(data.error || 'Failed to evaluate')

            setEvaluation(data)
        } catch (e) {
            console.error('[AIEvaluationPanel] Error:', e.message)
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{
            background: 'rgba(15,17,35,0.85)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '20px',
            padding: '32px',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#a78bfa15', border: '1px solid #a78bfa30', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Brain size={20} color="#a78bfa" />
                </div>
                <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9' }}>AI Proof Review</h3>
                    <p style={{ fontSize: '0.78rem', color: '#64748b' }}>Describe your work to receive an AI score</p>
                </div>
            </div>

            <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Ex. Finished the smart contract bridge between Casper and Arbitrum. Deployed at 0x..."
                style={{
                    width: '100%',
                    minHeight: '120px',
                    background: 'rgba(5,7,20,0.4)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '12px',
                    padding: '16px',
                    color: '#f1f5f9',
                    fontSize: '0.88rem',
                    lineHeight: '1.6',
                    resize: 'none',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    marginBottom: '20px'
                }}
                onFocus={e => e.currentTarget.style.borderColor = '#a78bfa50'}
                onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                {error && (
                    <p style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 500 }}>{error}</p>
                )}
                {!error && !evaluation && (
                    <div />
                )}
                
                {evaluation && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#a78bfa10', padding: '10px 16px', borderRadius: '12px', border: '1px solid #a78bfa30' }}>
                        <Star size={16} color="#a78bfa" fill="#a78bfa" />
                        <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f1f5f9' }}>{evaluation.overallScore}</span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Score</span>
                    </div>
                )}

                <button
                    onClick={evaluateWork}
                    disabled={loading}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '12px 24px', borderRadius: '12px', cursor: loading ? 'not-allowed' : 'pointer',
                        background: loading ? 'rgba(167,139,250,0.1)' : '#a78bfa',
                        border: 'none',
                        color: loading ? '#a78bfa' : '#0f1123',
                        fontSize: '0.88rem', fontWeight: 700,
                        transition: 'all 0.2s',
                        marginLeft: 'auto'
                    }}
                    onMouseEnter={e => { if(!loading) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(167,139,250,0.4)' }}}
                    onMouseLeave={e => { if(!loading) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}}
                >
                    {loading ? (
                        <>
                            <Loader2 size={18} className="animate-spin" />
                            Evaluating...
                        </>
                    ) : (
                        <>
                            Evaluate with AI
                            <ArrowRight size={18} />
                        </>
                    )}
                </button>
            </div>
        </div>
    )
}

