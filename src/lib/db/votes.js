/**
 * src/lib/db/votes.js (REPLACED - MOCK DB VERSION)
 */

import { mockDB } from './mockDB'
import { updateMilestoneStatus } from './milestones'

const TABLE = 'votes'
const APPROVAL_THRESHOLD = 0.5

const delay = (ms = 100) => new Promise(resolve => setTimeout(resolve, ms))

export async function voteOnMilestone({ milestoneId, voterId, vote, votingPower = 1 }) {
    await delay()
    if (!milestoneId || !voterId) throw new Error('milestoneId and voterId are required')

    // Check if already voted
    const existing = mockDB.where(TABLE, 'milestone_id', milestoneId)
        .find(v => v.wallet_address === voterId.toLowerCase())
    
    if (existing) {
        throw new Error('You have already voted on this milestone.')
    }

    const voteRecord = mockDB.insert(TABLE, {
        milestone_id: milestoneId,
        wallet_address: voterId.toLowerCase(),
        vote,
        token_amount: Number(votingPower),
    })

    // Recalculate
    const allVotes = mockDB.where(TABLE, 'milestone_id', milestoneId)
    const yesWeight = allVotes.filter(v => v.vote === true).reduce((s, v) => s + Number(v.token_amount || 0), 0)
    const noWeight = allVotes.filter(v => v.vote === false).reduce((s, v) => s + Number(v.token_amount || 0), 0)
    const total = yesWeight + noWeight
    const yesPercent = total > 0 ? Math.round((yesWeight / total) * 100) : 0
    const milestoneApproved = total > 0 && (yesWeight / total) > APPROVAL_THRESHOLD

    if (milestoneApproved) {
        await updateMilestoneStatus(milestoneId, 'approved')
    } else if (total > 0) {
        await updateMilestoneStatus(milestoneId, 'voting')
    }

    return {
        voteRecord,
        milestoneApproved,
        yesPercent,
        yesWeight,
        noWeight,
        total,
    }
}

export async function getVotesByMilestone(milestoneId) {
    await delay()
    if (!milestoneId) throw new Error('milestoneId is required')

    const data = mockDB.where(TABLE, 'milestone_id', milestoneId)
    return data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

export async function hasUserVoted(milestoneId, voterId) {
    await delay()
    if (!milestoneId || !voterId) return false

    const votes = mockDB.where(TABLE, 'milestone_id', milestoneId)
    return votes.some(v => v.wallet_address === voterId.toLowerCase())
}
