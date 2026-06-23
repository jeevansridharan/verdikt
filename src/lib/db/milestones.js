/**
 * src/lib/db/milestones.js (REPLACED - MOCK DB VERSION)
 */

import { mockDB } from './mockDB'

const TABLE = 'milestones'

const delay = (ms = 200) => new Promise(resolve => setTimeout(resolve, ms))

export async function createMilestone({ projectId, title, description, amountAllocated }) {
    await delay()
    if (!projectId || !title) throw new Error('projectId and title are required')

    const data = mockDB.insert(TABLE, {
        project_id: projectId,
        title: title.trim(),
        description: description?.trim() ?? '',
        amount: Number(amountAllocated),
        approved: false,
    })
    return data
}

export async function createMilestoneBatch(projectId, milestonesArray) {
    await delay()
    if (!projectId || !milestonesArray?.length) throw new Error('projectId and milestonesArray must not be empty')

    const results = milestonesArray.map(m => mockDB.insert(TABLE, {
        project_id: projectId,
        title: m.title.trim(),
        description: m.description?.trim() ?? '',
        amount: Number(m.amountAllocated),
        approved: false,
    }))
    return results
}

export async function fetchMilestonesByProject(projectId) {
    await delay()
    if (!projectId) throw new Error('projectId is required')

    const milestones = mockDB.where(TABLE, 'project_id', projectId)
    
    return milestones.map(m => {
        const votes = mockDB.where('votes', 'milestone_id', m.id)
        const yesWeight = votes.filter(v => v.vote === true).reduce((s, v) => s + (v.token_amount || 0), 0)
        const noWeight = votes.filter(v => v.vote === false).reduce((s, v) => s + (v.token_amount || 0), 0)
        
        return {
            ...m,
            voteYes: yesWeight,
            voteNo: noWeight,
            voteTotal: yesWeight + noWeight,
            isApproved: m.approved || (yesWeight + noWeight > 0 && yesWeight / (yesWeight + noWeight) > 0.5),
        }
    })
}

export async function updateMilestoneStatus(milestoneId, status) {
    await delay()
    if (!milestoneId) throw new Error('milestoneId is required')

    const approved = status === 'approved' || status === 'released'
    const data = mockDB.update(TABLE, milestoneId, { approved })
    if (!data) throw new Error('Milestone not found')
    
    return data
}
