/**
 * src/hooks/useSupabase.js
 *
 * Central React hook for all Supabase-backed state.
 *
 * BUG FIXES APPLIED
 * ──────────────────
 *   ✓ loadProjects: was not destructuring {data, error} from fetchProjects
 *     (was assigning the whole {data,error} object into setProjects)
 *   ✓ createFullProject: field names corrected:
 *     - fundingTarget  → goal_amount   (matches projects table column)
 *     - creatorId      → owner_wallet  (matches projects table column)
 *   ✓ Full try/catch with proper error propagation
 *   ✓ Optimistic UI: new project prepended to projects list immediately
 *     so the user sees it without waiting for a re-fetch
 *
 * USAGE
 * ─────
 *   const { user, projects, createFullProject, loadProjects, ... } = useSupabase(walletAddress)
 */

import { useState, useEffect, useCallback } from 'react'
import {
    upsertUser,
    createProject,
    createMilestoneBatch,
    fetchProjects,
    fetchProjectById,
    fetchMilestonesByProject,
    updateFundedAmount,
    voteOnMilestone,
    insertTransaction,
    hasUserVoted,
} from '../lib/db'

// ─────────────────────────────────────────────────────────────────────────────

export function useSupabase(walletAddress = null) {
    const [user, setUser] = useState(null)
    const [projects, setProjects] = useState([])
    const [activeProject, setActiveProject] = useState(null)
    const [milestones, setMilestones] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    // ── Auto-upsert user when wallet connects ─────────────────────────────────
    useEffect(() => {
        if (!walletAddress) {
            setUser(null)
            return
        }
        ; (async () => {
            try {
                const dbUser = await upsertUser(walletAddress)
                setUser(dbUser)
            } catch (e) {
                console.error('[useSupabase] upsertUser failed:', e)
                // Non-fatal: app still works without DB user record
            }
        })()
    }, [walletAddress])

    // ── Load all projects ─────────────────────────────────────────────────────
    /**
     * BUG FIX: fetchProjects returns { data, error }.
     * Previous code did `const data = await fetchProjects(...)` which set
     * `data` to the entire { data: [...], error: null } object, not the array.
     */
    const loadProjects = useCallback(async (filters = {}) => {
        setLoading(true)
        setError(null)
        try {
            const { data, error: sbError } = await fetchProjects(filters)  // ← destructure!

            if (sbError) {
                console.error('[useSupabase] loadProjects error:', sbError)
                setError(sbError.message ?? 'Failed to load projects')
                return
            }

            console.log('[useSupabase] loadProjects: loaded', data.length, 'projects')
            setProjects(data)
        } catch (e) {
            console.error('[useSupabase] loadProjects exception:', e)
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }, [])

    // ── Load single project + its milestones ──────────────────────────────────
    const loadProject = useCallback(async (projectId) => {
        setLoading(true)
        setError(null)
        try {
            const [{ data: project, error: pErr }, { data: milestonesData, error: mErr }] =
                await Promise.all([
                    fetchProjectById(projectId),
                    fetchMilestonesByProject(projectId),
                ])

            if (pErr) throw new Error(pErr.message)
            if (mErr) throw new Error(mErr.message)

            setActiveProject(project)
            setMilestones(milestonesData ?? [])
        } catch (e) {
            console.error('[useSupabase] loadProject exception:', e)
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }, [])

    // ── Create project + milestones in one call ───────────────────────────────
    /**
     * createFullProject({ title, description, goal_amount, owner_wallet, milestones })
     *
     * BUG FIX: field names now match the Supabase table columns:
     *   goal_amount   (was: fundingTarget)
     *   owner_wallet  (was: creatorId — which was a UUID, not a wallet address)
     *
     * @param {object} formData — shape from ProjectForm
     * @returns {Promise<{ project, milestones }>}
     */
    const createFullProject = useCallback(async (formData) => {
        if (!user) throw new Error('Connect your wallet before creating a project.')

        setLoading(true)
        setError(null)

        try {
            console.log('[useSupabase] createFullProject: formData =', formData)

            // ── 1. Create project row ─────────────────────────────────────────
            const { data: project, error: pErr } = await createProject({
                title: formData.title,
                description: formData.description ?? '',
                goal_amount: formData.goal_amount ?? formData.fundingTarget, // support both field names
                owner_wallet: formData.owner_wallet ?? walletAddress,         // fallback to connected wallet
                status: 'active',
            })

            if (pErr) {
                console.error('[useSupabase] createFullProject: project insert failed:', pErr)
                throw new Error(pErr.message)
            }

            console.log('[useSupabase] createFullProject: project created →', project)

            // ── 2. Batch-insert milestones ────────────────────────────────────
            let createdMilestones = []
            if (formData.milestones?.length) {
                const { data: ms, error: mErr } = await createMilestoneBatch(
                    project.id,
                    formData.milestones.map(m => ({
                        title: m.title,
                        description: m.description ?? '',
                        amountAllocated: m.amountAllocated ??
                            (project.goal_amount / formData.milestones.length),
                    }))
                )
                if (mErr) console.warn('[useSupabase] Milestone insert failed (non-fatal):', mErr)
                createdMilestones = ms ?? []
            }

            const fullProject = { ...project, milestones: createdMilestones }

            // ── 3. Optimistic state update — new project appears IMMEDIATELY ──
            setActiveProject(fullProject)
            setMilestones(createdMilestones)
            setProjects(prev => [fullProject, ...prev])  // prepend so it shows first

            console.log('[useSupabase] createFullProject: ✓ complete')
            return fullProject

        } catch (e) {
            console.error('[useSupabase] createFullProject exception:', e)
            setError(e.message)
            throw e
        } finally {
            setLoading(false)
        }
    }, [user, walletAddress])

    // ── Fund project (record on-chain tx + update DB) ─────────────────────────
    const recordFunding = useCallback(async ({ projectId, txHash, amount }) => {
        setError(null)
        try {
            await Promise.all([
                insertTransaction({ projectId, txHash, amount, type: 'funding' }),
                updateFundedAmount(projectId, amount),
            ])
            // Refresh active project state if it's the one being funded
            if (activeProject?.id === projectId) {
                setActiveProject(prev => ({
                    ...prev,
                    raised_amount: (parseFloat(prev.raised_amount ?? 0) + amount).toFixed(8),
                }))
            }
        } catch (e) {
            console.error('[useSupabase] recordFunding exception:', e)
            setError(e.message)
            throw e
        }
    }, [activeProject])

    // ── Vote on milestone ─────────────────────────────────────────────────────
    const castVoteDB = useCallback(async ({ milestoneId, vote, votingPower = 1 }) => {
        if (!user) throw new Error('Connect your wallet to vote.')
        setError(null)
        try {
            const result = await voteOnMilestone({
                milestoneId,
                voterId: user.id,
                vote,
                votingPower,
            })
            setMilestones(prev => prev.map(m => {
                if (m.id !== milestoneId) return m
                return {
                    ...m,
                    voteYes: result.yesWeight,
                    voteNo: result.noWeight,
                    voteTotal: result.total,
                    isApproved: result.milestoneApproved,
                    status: result.milestoneApproved ? 'approved' : 'voting',
                }
            }))
            return result
        } catch (e) {
            console.error('[useSupabase] castVoteDB exception:', e)
            setError(e.message)
            throw e
        }
    }, [user])

    // ── Check if current user voted on a milestone ────────────────────────────
    const checkHasVoted = useCallback(async (milestoneId) => {
        if (!user) return false
        return hasUserVoted(milestoneId, user.id)
    }, [user])

    // ─────────────────────────────────────────────────────────────────────────
    return {
        // State
        user,
        projects,
        activeProject,
        milestones,
        loading,
        error,

        // Actions
        loadProjects,
        loadProject,
        createFullProject,
        recordFunding,
        castVoteDB,
        checkHasVoted,

        // Clear error manually
        clearError: () => setError(null),
    }
}
