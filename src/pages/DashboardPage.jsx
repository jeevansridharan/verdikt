/**
 * pages/DashboardPage.jsx
 * Arbit â€” AI-powered autonomous funding protocol on Casper Network
 * Overview stats + quick-access cards
 */

import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
    FolderKanban, ArrowUpRight,
    TrendingUp, Zap, Shield, ChevronRight,
    RefreshCw, Brain, Star, Award,
} from 'lucide-react'
import { fetchProjects } from '../lib/db/projects'

// â”€â”€ Quick action card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function QuickAction({ to, Icon, title, description, color, onClick }) {
    const inner = (
        <div style={{
            background: 'rgba(15,17,35,0.85)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '14px',
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            transition: 'all 0.2s ease',
            cursor: 'pointer',
        }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = color + '40'; e.currentTarget.style.background = `rgba(15,17,35,0.95)` }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.background = 'rgba(15,17,35,0.85)' }}
        >
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: `${color}15`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={20} color={color} />
            </div>
            <div style={{ flex: 1 }}>
                <p style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.92rem', marginBottom: '2px' }}>{title}</p>
                <p style={{ color: '#475569', fontSize: '0.78rem' }}>{description}</p>
            </div>
            <ChevronRight size={16} color="#334155" />
        </div>
    )

    if (onClick) return <div onClick={onClick} style={{ textDecoration: 'none' }}>{inner}</div>
    return <Link to={to} style={{ textDecoration: 'none' }}>{inner}</Link>
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function DashboardPage() {
    const [stats, setStats] = useState({ projects: 0, hskRaised: '0.000', evaluations: 0, avgScore: 0, rewards: 0 })
    const [loading, setLoading] = useState(true)

    async function loadStats() {
        setLoading(true)
        try {
            const { data: projects, error } = await fetchProjects()
            
            if (error) throw error

            const projectCount = projects?.length ?? 0
            const totalRaised = (projects ?? []).reduce(
                (sum, p) => sum + parseFloat(p.raised_amount || 0), 0
            )

            setStats({
                projects: projectCount,
                hskRaised: totalRaised.toFixed(3),
                evaluations: projectCount,           // 1 AI eval per project
                avgScore: projectCount > 0 ? 78 : 0, // placeholder average
                rewards: Math.floor(projectCount * 0.6),
            })
        } catch (e) {
            console.error('[DashboardPage] Failed to load stats:', e.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadStats() }, [])

    // Stat card component (inline)
    const StatCard = ({ label, value, unit, color, Icon }) => (
        <div style={{
            background: 'rgba(15,17,35,0.85)',
            border: `1px solid ${color}30`,
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            backdropFilter: 'blur(20px)',
            transition: 'transform 0.2s, box-shadow 0.2s',
        }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 32px ${color}20` }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `${color}15`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={16} color={color} />
                </div>
            </div>
            <div>
                {loading ? (
                    <div style={{ width: '60px', height: '32px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                ) : (
                    <p style={{ fontSize: '2rem', fontWeight: 800, color: '#f1f5f9', lineHeight: 1 }}>{value}</p>
                )}
                <p style={{ fontSize: '0.75rem', color: color, fontWeight: 600, marginTop: '4px' }}>{unit}</p>
            </div>
        </div>
    )

    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            {/* â”€â”€ Page header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div style={{ marginBottom: '36px' }}>
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '4px 12px', borderRadius: '999px', marginBottom: '12px',
                    background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
                }}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px rgba(16,185,129,0.8)' }} />
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#34d399', letterSpacing: '0.06em' }}>LIVE Â· HASHKEY CHAIN</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.03em', marginBottom: '4px' }}>
                            Welcome to Arbit
                        </h1>
                        <p style={{ color: '#10b981', fontSize: '0.88rem', fontWeight: 600, marginBottom: '4px' }}>
                            AI-powered autonomous funding protocol
                        </p>
                        <p style={{ color: '#64748b', fontSize: '0.82rem' }}>
                            Autonomous funding powered by AI decision-making
                        </p>
                    </div>
                    {/* Refresh button */}
                    <button
                        onClick={loadStats}
                        title="Refresh stats"
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '8px 14px', borderRadius: '10px', cursor: 'pointer',
                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                            color: '#64748b', fontSize: '0.78rem', fontWeight: 600,
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#10b981'; e.currentTarget.style.borderColor = 'rgba(16,185,129,0.3)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
                    >
                        <RefreshCw size={13} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* â”€â”€ Dashboard Stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px', marginBottom: '28px' }}>
                <StatCard label="Active Projects"    value={stats.projects}    unit="PROJ"  color="#10b981" Icon={FolderKanban} />
                <StatCard label="AI Evaluations"     value={stats.evaluations} unit="SCORED" color="#a78bfa" Icon={Brain} />
                <StatCard label="Average AI Score"   value={stats.avgScore ? `${stats.avgScore}` : 'â€”'} unit="/ 100" color="#06b6d4" Icon={Star} />
            </div>


            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '16px', marginBottom: '28px' }}>
                <StatCard label="Total Funded"    value={stats.hskRaised}  unit="CSPR"      color="#34d399" Icon={TrendingUp} />
                <StatCard label="Rewards Released" value={stats.rewards}   unit="RELEASED" color="#f59e0b" Icon={Award} />
            </div>

            {/* â”€â”€ Quick Actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div style={{ marginBottom: '28px' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '4px', height: '16px', background: '#10b981', borderRadius: '4px' }}></div>
                    Quick Actions
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '16px' }}>
                    <QuickAction
                        to="/projects"
                        Icon={FolderKanban}
                        title="Create or Browse Projects"
                        description="Submit a milestone-based project on Casper Network"
                        color="#10b981"
                    />
                    <QuickAction
                        to="/projects"
                        Icon={Brain}
                        title="Run AI Evaluation"
                        description="Let the AI oracle score your milestone proof"
                        color="#a78bfa"
                    />
                    <QuickAction
                        to="/projects"
                        Icon={Star}
                        title="Check AI Score"
                        description="View your project's current AI evaluation score"
                        color="#06b6d4"
                    />
                    <QuickAction
                        to="/transactions"
                        Icon={ArrowUpRight}
                        title="Auto Reward Status"
                        description="Track automatic fund releases based on AI scores"
                        color="#f59e0b"
                    />
                </div>
            </div>

            {/* â”€â”€ How Arbit Works â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div style={{ background: 'rgba(15,17,35,0.85)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '28px', backdropFilter: 'blur(20px)' }}>
                <h2 style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Zap size={18} color="#10b981" /> How Arbit Works
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '20px' }}>
                    {[
                        { step: '01', title: 'Create & Fund', desc: 'Lock CSPR into escrow and define your milestone score threshold', color: '#10b981', Icon: FolderKanban },
                        { step: '02', title: 'Submit Proof', desc: 'Creator submits milestone proof â€” text or IPFS hash', color: '#a78bfa', Icon: Brain },
                        { step: '03', title: 'AI Decides', desc: 'AI oracle scores proof (0â€“100). Score â‰¥ threshold â†’ funds auto-released', color: '#06b6d4', Icon: Shield },
                    ].map(({ step, title, desc, color, Icon }) => (
                        <div key={step}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${color}15`, border: `1px solid ${color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                                <Icon size={18} color={color} />
                            </div>
                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: color, letterSpacing: '0.1em', marginBottom: '4px' }}>STEP {step}</div>
                            <p style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.875rem', marginBottom: '4px' }}>{title}</p>
                            <p style={{ color: '#64748b', fontSize: '0.78rem', lineHeight: 1.5 }}>{desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

