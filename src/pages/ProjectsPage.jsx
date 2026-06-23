import React, { useState, useEffect, useCallback } from 'react'
import {
    FolderKanban, Plus, RefreshCw,
    AlertCircle, Inbox,
} from 'lucide-react'

import { createProject, deleteProject, updateRaisedAmount, fetchProjects as dbFetchProjects } from '../lib/db/projects'
import { insertTransaction } from '../lib/db/transactions'
import { createMilestoneBatch } from '../lib/db/milestones'
import { voteOnMilestone, hasUserVoted } from '../lib/db/votes'
import ProjectCard from '../components/ProjectCard'
import ProjectForm from '../components/ProjectForm'
import Dashboard from '../components/Dashboard'
const PLACEHOLDER_WALLET = 'casper-wallet-not-connected'

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function ProjectsPage() {

    // â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    /** All projects fetched from database */
    const [projects, setProjects] = useState([])

    /** true while the database request is in-flight */
    const [loading, setLoading] = useState(true)

    /** Non-null string if the fetch failed */
    const [error, setError] = useState(null)

    /** Controls "Create new project" form vs list view */
    const [showForm, setShowForm] = useState(false)

    /** Active project (once created/selected by user) */
    const [activeProject, setActiveProject] = useState(null)

    // â”€â”€ Fetch projects from database â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    /**
     * fetchProjects()
     *
     * Sends a SELECT query to database:
     *   SELECT * FROM projects ORDER BY created_at DESC
     *
     * Uses useCallback so it can be passed to the refresh button
     * without causing re-render loops.
     */
    const fetchProjects = useCallback(async () => {
        setLoading(true)   // show spinner
        setError(null)     // clear any previous error

        try {
            const { data, error: dbError } = await dbFetchProjects()

            if (dbError) {
                console.error('[ProjectsPage] DB error:', dbError)
                setError(dbError.message)
                setProjects([])
            } else {
                setProjects(data ?? [])
            }
        } catch (err) {
            console.error('[ProjectsPage] Unexpected error:', err)
            setError(err.message)
        }

        setLoading(false)  // hide spinner
    }, [])

    /**
     * useEffect â€” runs once when the component mounts (page loads).
     * Equivalent to componentDidMount in class components.
     * The empty dependency array [] means "run only on first render".
     */
    useEffect(() => {
        fetchProjects()
    }, [fetchProjects])

    // â”€â”€ Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    /**
     * handleProjectCreate
     *
     * Called by ProjectForm when the user submits the form.
     *
     * BUG FIX: was NOT async, never actually called Supabase.
     * Now: awaits createProject(), throws on error (form shows it),
     * sets local state only AFTER a confirmed DB insert.
     *
     * @param {object} projectData â€” from ProjectForm (goal_amount, owner_wallet, etc.)
     */
    const handleProjectCreate = async (projectData) => {
        console.log('[ProjectsPage] handleProjectCreate: received formData =', projectData)
        console.log('[ProjectsPage] handleProjectCreate: calling mock database insertâ€¦')

        // â”€â”€ 1. Real database INSERT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const { data: newProject, error: insertError } = await createProject({
            title: projectData.title,
            description: projectData.description ?? '',
            goal_amount: projectData.goal_amount,
            owner_wallet: projectData.owner_wallet || localStorage.getItem('arbit_casper_public_key') || PLACEHOLDER_WALLET,
            contract_address: import.meta.env.VITE_CASPER_CONTRACT_HASH || '',
            status: 'active',
        })

        if (insertError) {
            console.error('[ProjectsPage] handleProjectCreate: INSERT FAILED:', insertError)
            throw new Error(insertError.message ?? 'Database insert failed')
        }

        console.log('[ProjectsPage] handleProjectCreate: âœ“ project inserted:', newProject)

        // â”€â”€ BUG FIX: Save milestones to database â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // Previously milestones were only kept in local state with fake IDs,
        // causing "No milestones defined" on the dashboard.
        let savedMilestones = []
        const rawMilestones = projectData.milestones ?? []
        if (rawMilestones.length > 0) {
            try {
                const milestoneBatch = rawMilestones.map(m => ({
                    title: m.title,
                    description: m.description ?? '',
                    amountAllocated: parseFloat(projectData.goal_amount) / rawMilestones.length,
                }))
                savedMilestones = await createMilestoneBatch(newProject.id, milestoneBatch)
                console.log('[ProjectsPage] âœ“ milestones inserted:', savedMilestones)
            } catch (milestoneErr) {
                console.error('[ProjectsPage] milestone insert failed:', milestoneErr.message)
                // Don't block â€” project was created, milestones can be added later
            }
        }

        // â”€â”€ Normalise milestones shape for UI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const normalisedMilestones = savedMilestones.map(m => ({
            ...m,
            status: m.status ?? 'pending',
            votes: { yes: 0, no: 0 },
        }))

        const fullProject = {
            ...newProject,
            milestones: normalisedMilestones,
            raised_amount: 0,
        }

        setProjects(prev => [fullProject, ...prev])
        setActiveProject(fullProject)
        setShowForm(false)
    }

    const handleTransaction = async (amount, txHash, type = 'funding', walletAddress) => {
        if (!activeProject) return
        const finalWallet = walletAddress || PLACEHOLDER_WALLET
        console.log(`[ProjectsPage] handleTransaction: ${type} of ${amount} CSPR (${txHash}) by ${finalWallet}`)

        // 1. Record in transactions table
        if (txHash) {
            try {
                await insertTransaction({
                    projectId: activeProject.id,
                    txHash,
                    amount,
                    type,
                    walletAddress: finalWallet,
                })
                console.log(`[ProjectsPage] âœ“ ${type} recorded in database`)
            } catch (err) {
                console.error(`[ProjectsPage] Database error for ${type}:`, err.message)
            }
        }

        // 2. If it's a funding transaction, increment the project's raised_amount
        if (type === 'funding') {
            try {
                await updateRaisedAmount(activeProject.id, amount)
                console.log('[ProjectsPage] âœ“ raised_amount incremented in projects table')
            } catch (err) {
                console.error('[ProjectsPage] Failed to update project total:', err.message)
            }

            // Update local state for immediate UI feedback
            setActiveProject(prev => ({
                ...prev,
                raised_amount: (parseFloat(prev.raised_amount) + amount).toFixed(8)
            }))
        }
    }

    const handleFund = (amount, txHash, walletAddress) => handleTransaction(amount, txHash, 'funding', walletAddress)

    const handleVote = async (milestoneId, voteType) => {
        // Resolve stable anonymous voter ID from localStorage
        const key = 'arbit_anon_voter_id'
        let voterId = localStorage.getItem(key)
        if (!voterId) {
            voterId = 'anon_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
            localStorage.setItem(key, voterId)
        }

        // â”€â”€ Pre-check: has this wallet already voted on this milestone? â”€â”€â”€â”€â”€â”€
        const alreadyVoted = await hasUserVoted(milestoneId, voterId)
        if (alreadyVoted) {
            console.info('[ProjectsPage] User has already voted on milestone:', milestoneId)
            alert('You have already voted on this milestone.')
            return  // â† exit early, no 409 request, no double-count
        }

        // â”€â”€ Insert vote into Supabase â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        try {
            await voteOnMilestone({
                milestoneId,
                voterId,
                vote: voteType === 'yes',
                votingPower: 1,
            })
            console.log(`[ProjectsPage] âœ“ Vote '${voteType}' recorded in DB for milestone:`, milestoneId)
        } catch (voteErr) {
            console.warn('[ProjectsPage] DB vote failed:', voteErr.message)
            alert(voteErr.message || 'Vote failed. Please try again.')
            return  // â† don't update local state if the vote wasn't saved
        }

        // â”€â”€ Update local state only after a successful DB write â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        setActiveProject(prev => ({
            ...prev,
            milestones: prev.milestones?.map(m => {
                if (m.id !== milestoneId) return m
                const newVotes = { ...m.votes, [voteType]: (m.votes?.[voteType] ?? 0) + 1 }
                const total = newVotes.yes + newVotes.no
                return {
                    ...m,
                    votes: newVotes,
                    status: total > 0 && newVotes.yes / total > 0.5 ? 'Approved' : 'Pending',
                }
            }),
        }))
    }

    const handleProjectDelete = async (projectId) => {
        const { error } = await deleteProject(projectId)
        if (error) {
            alert(`Failed to delete project: ${error.message}`)
            return
        }
        // Remove from local state
        setProjects(prev => prev.filter(p => p.id !== projectId))
    }

    const handleReset = () => {
        setActiveProject(null)
        setShowForm(false)
        fetchProjects() // Refresh the list so totals are accurate when returning
    }

    // â”€â”€ Route: show Dashboard if a project is active â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (activeProject) {
        return (
            <Dashboard
                project={activeProject}
                onFund={handleFund}
                onTransaction={handleTransaction}
                onReset={handleReset}
            />
        )
    }

    // â”€â”€ Route: show create form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (showForm) {
        return (
            <div>
                <button
                    onClick={() => setShowForm(false)}
                    style={{
                        marginBottom: '20px', padding: '8px 16px', borderRadius: '10px',
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                        color: '#64748b', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '6px',
                    }}
                >
                    â† Back to Projects
                </button>
                <ProjectForm
                    onProjectCreate={handleProjectCreate}
                    walletAddress={PLACEHOLDER_WALLET}
                />
            </div>
        )
    }

    // â”€â”€ Main view: project list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    return (
        <div>

            {/* â”€â”€ Page header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '28px', flexWrap: 'wrap', gap: '12px',
            }}>
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.03em', marginBottom: '4px' }}>
                        Projects
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                        {loading ? 'Loadingâ€¦' : `${projects.length} project${projects.length !== 1 ? 's' : ''} on Casper Network`}
                    </p>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '10px' }}>
                    {/* Refresh */}
                    <button
                        onClick={fetchProjects}
                        disabled={loading}
                        title="Refresh list"
                        style={{
                            padding: '9px 14px', borderRadius: '10px', cursor: loading ? 'not-allowed' : 'pointer',
                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                            color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px',
                            transition: 'all 0.2s', opacity: loading ? 0.5 : 1,
                        }}
                    >
                        <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                    </button>

                    {/* Create */}
                    <button
                        onClick={() => setShowForm(true)}
                        style={{
                            padding: '9px 18px', borderRadius: '10px', cursor: 'pointer',
                            background: 'linear-gradient(135deg,#10b981,#059669)',
                            border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.85rem',
                            display: 'flex', alignItems: 'center', gap: '7px',
                            boxShadow: '0 0 20px rgba(16,185,129,0.3)', transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 28px rgba(16,185,129,0.5)'}
                        onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 20px rgba(16,185,129,0.3)'}
                    >
                        <Plus size={16} /> New Project
                    </button>
                </div>
            </div>

            {/* â”€â”€ Loading state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {loading && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                    {[1, 2, 3].map(i => (
                        <div key={i} style={{
                            background: 'rgba(15,17,35,0.9)', border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '16px', padding: '24px', height: '260px',
                            animation: 'pulse 1.5s ease-in-out infinite',
                        }}>
                            {/* Skeleton lines */}
                            {[100, 60, 80, 40].map((w, j) => (
                                <div key={j} style={{
                                    height: '12px', width: `${w}%`, borderRadius: '6px',
                                    background: 'rgba(255,255,255,0.04)', marginBottom: '14px',
                                }} />
                            ))}
                        </div>
                    ))}
                </div>
            )}

            {/* â”€â”€ Error state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {!loading && error && (
                <div style={{
                    background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: '14px', padding: '28px', display: 'flex', alignItems: 'flex-start', gap: '14px',
                }}>
                    <AlertCircle size={20} color="#f87171" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                        <p style={{ color: '#f87171', fontWeight: 700, marginBottom: '6px' }}>Failed to load projects</p>
                        <p style={{ color: '#94a3b8', fontSize: '0.83rem', marginBottom: '14px' }}>{error}</p>
                        <p style={{ color: '#64748b', fontSize: '0.78rem' }}>
                            âš  Common causes: schema.sql not run yet Â· RLS policy missing Â· wrong .env keys
                        </p>
                        <button
                            onClick={fetchProjects}
                            style={{
                                marginTop: '14px', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
                                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                                color: '#f87171', fontWeight: 700, fontSize: '0.8rem',
                            }}
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            )}

            {/* â”€â”€ Empty state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {!loading && !error && projects.length === 0 && (
                <div style={{
                    background: 'rgba(15,17,35,0.85)', border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '16px', padding: '60px 40px', textAlign: 'center',
                }}>
                    <div style={{
                        width: '64px', height: '64px', borderRadius: '16px', margin: '0 auto 20px',
                        background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Inbox size={28} color="#10b981" />
                    </div>
                    <p style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1.05rem', marginBottom: '8px' }}>
                        No projects yet
                    </p>
                    <p style={{ color: '#475569', fontSize: '0.875rem', marginBottom: '24px' }}>
                        Be the first to create a milestone-based funding submission on Casper Network.
                    </p>
                    <button
                        onClick={() => setShowForm(true)}
                        style={{
                            padding: '10px 24px', borderRadius: '10px', cursor: 'pointer',
                            background: 'linear-gradient(135deg,#10b981,#059669)',
                            border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.875rem',
                            display: 'inline-flex', alignItems: 'center', gap: '8px',
                            boxShadow: '0 0 20px rgba(16,185,129,0.3)',
                        }}
                    >
                        <Plus size={16} /> Create First Project
                    </button>
                </div>
            )}

            {/* â”€â”€ Projects grid â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {!loading && !error && projects.length > 0 && (
                <>
                    {/* Count + filter bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                        <div style={{
                            padding: '4px 12px', borderRadius: '999px',
                            background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
                        }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10b981' }}>
                                {projects.length} PROJECT{projects.length !== 1 ? 'S' : ''}
                            </span>
                        </div>
                        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
                        <span style={{ fontSize: '0.72rem', color: '#334155' }}>Sorted: Newest first</span>
                    </div>

                    {/* Responsive card grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                        gap: '20px',
                    }}>
                        {projects.map(project => (
                            <ProjectCard
                                key={project.id}
                                project={project}
                                onView={(p) => setActiveProject(p)}
                                onDelete={handleProjectDelete}
                            />
                        ))}
                    </div>
                </>
            )}

            {/* Spinner keyframe */}
            <style>{`
                @keyframes spin   { to { transform: rotate(360deg); } }
                @keyframes pulse  { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
            `}</style>

        </div>
    )
}

