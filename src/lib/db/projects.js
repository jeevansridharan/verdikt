/**
 * src/lib/db/projects.js (REPLACED - MOCK DB VERSION)
 */

import { mockDB } from './mockDB'

const TABLE = 'projects'
const VALID_STATUSES = ['active', 'funded', 'completed', 'cancelled']

const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms))

export async function createProject({
    title,
    description = '',
    goal_amount,
    owner_wallet,
    contract_address = '',
    status = 'active',
}) {
    await delay();
    if (!title) return { data: null, error: { message: 'Title required' } }
    
    const payload = {
        title: title.trim(),
        description: description.trim(),
        goal_amount: Number(goal_amount),
        raised_amount: 0,
        owner_wallet: owner_wallet.trim(),
        contract_address: contract_address,
        status,
    }

    const data = mockDB.insert(TABLE, payload)
    return { data, error: null }
}

export async function fetchProjects({ status, owner_wallet, limit = 50, offset = 0 } = {}) {
    await delay();
    let data = mockDB.getAll(TABLE)
    
    if (status) data = data.filter(p => p.status === status)
    if (owner_wallet) data = data.filter(p => p.owner_wallet === owner_wallet)
    
    data = data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    data = data.slice(offset, offset + limit)
    
    return { data, error: null }
}

export async function fetchProjectById(id) {
    await delay();
    if (!id) return { data: null, error: { message: 'ID required' } }

    const project = mockDB.getById(TABLE, id)
    if (!project) return { data: null, error: { message: 'Project not found' } }

    // Join milestones and transactions
    const milestones = mockDB.where('milestones', 'project_id', id)
    const transactions = mockDB.where('transactions', 'project_id', id)

    const fullData = {
        ...project,
        milestones: milestones.map(m => {
            const votes = mockDB.where('votes', 'milestone_id', m.id)
            const yesWeight = votes.filter(v => v.vote === true).reduce((s, v) => s + (v.token_amount || 0), 0)
            const noWeight = votes.filter(v => v.vote === false).reduce((s, v) => s + (v.token_amount || 0), 0)
            return {
                ...m,
                voteYes: yesWeight,
                voteNo: noWeight,
                voteTotal: yesWeight + noWeight,
                isApproved: m.approved || (yesWeight + noWeight > 0 && yesWeight / (yesWeight + noWeight) > 0.5)
            }
        }),
        transactions
    }

    return { data: fullData, error: null }
}

export async function updateRaisedAmount(id, amount) {
    await delay();
    const project = mockDB.getById(TABLE, id)
    if (!project) return { data: null, error: { message: 'Not found' } }

    const updated = mockDB.update(TABLE, id, {
        raised_amount: (project.raised_amount || 0) + Number(amount)
    })
    return { data: updated, error: null }
}

export const updateFundedAmount = updateRaisedAmount

export async function updateProjectStatus(id, status) {
    await delay();
    if (!VALID_STATUSES.includes(status)) return { data: null, error: { message: 'Invalid status' } }
    const updated = mockDB.update(TABLE, id, { status })
    return { data: updated, error: null }
}

export async function deleteProject(id) {
    await delay();
    const ok = mockDB.delete(TABLE, id)
    return { error: ok ? null : { message: 'Delete failed' } }
}

export async function testInsertProject() {
    return createProject({
        title: '[TEST] Dummy Project',
        description: 'Auto test',
        goal_amount: 0.1,
        owner_wallet: 'dummy_wallet',
    })
}
