/**
 * src/lib/db/transactions.js (REPLACED - MOCK DB VERSION)
 */

import { mockDB } from './mockDB'

const TABLE = 'transactions'

const delay = (ms = 150) => new Promise(resolve => setTimeout(resolve, ms))

export async function insertTransaction({ projectId, txHash, amount, type, walletAddress }) {
    await delay()
    if (!projectId || !txHash || !walletAddress) throw new Error('Missing required transaction fields')

    const data = mockDB.insert(TABLE, {
        project_id: projectId,
        tx_hash: txHash,
        wallet_address: walletAddress,
        amount: Number(amount),
        type,
    })
    return data
}

export async function fetchTransactionsByProject(projectId) {
    await delay()
    if (!projectId) throw new Error('projectId is required')

    const data = mockDB.where(TABLE, 'project_id', projectId)
    return data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

export async function getProjectFundingTotal(projectId) {
    await delay()
    if (!projectId) throw new Error('projectId is required')

    const data = mockDB.where(TABLE, 'project_id', projectId).filter(tx => tx.type === 'funding')
    const total = data.reduce((sum, tx) => sum + Number(tx.amount), 0)
    return parseFloat(total.toFixed(8))
}
