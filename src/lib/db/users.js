/**
 * src/lib/db/users.js (REPLACED - MOCK DB VERSION)
 */

import { mockDB } from './mockDB'

const TABLE = 'users'

const delay = (ms = 100) => new Promise(resolve => setTimeout(resolve, ms))

export async function upsertUser(walletAddress) {
    await delay()
    if (!walletAddress) throw new Error('walletAddress is required')

    const data = mockDB.upsert(TABLE, { 
        wallet_address: walletAddress.toLowerCase(),
        gov_balance: 0,
    }, 'wallet_address')
    
    return data
}

export async function getUserByWallet(walletAddress) {
    await delay()
    if (!walletAddress) throw new Error('walletAddress is required')

    const data = mockDB.getAll(TABLE).find(u => u.wallet_address === walletAddress.toLowerCase()) || null
    return data
}

export async function updateGovBalance(walletAddress, amountChange) {
    await delay()
    if (!walletAddress) throw new Error('walletAddress is required')

    let user = await getUserByWallet(walletAddress)
    if (!user) {
        user = await upsertUser(walletAddress)
    }

    const currentBalance = Number(user.gov_balance || 0)
    const newBalance = currentBalance + Number(amountChange)

    const updated = mockDB.update(TABLE, user.id, { gov_balance: newBalance })
    if (!updated) throw new Error('Failed to update user balance')
    
    return updated
}
