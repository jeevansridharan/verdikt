/**
 * src/lib/db/mockDB.js
 *
 * In-memory database with localStorage persistence.
 *
 * NETWORK FIELD
 * ────────────
 * All project rows carry a `network` field to distinguish legacy EVM/BCH data
 * from current Casper projects:
 *
 *   network = 'casper'   → Casper Network (01... / 02... public keys)
 *   network = 'hashkey'  → Legacy HashKey/EVM rows  (0x... addresses)
 *   network = 'bch'      → Legacy BitcoinCash rows  (bitcoincash:q... addresses)
 *   network = 'unknown'  → Rows that predate the network field
 *
 * migrateData() runs on module load and backfills `network` on any rows that
 * lack it, based on the wallet address prefix — without deleting anything.
 */

const STORAGE_KEY = 'arbiter_mock_db';

const INITIAL_DATA = {
    projects: [
        {
            id: 'p-demo-1',
            title: 'Casper DeFi Bridge',
            description: 'A trustless bridge between Casper Network and other blockchains, enabling seamless cross-chain asset transfers.',
            goal_amount: 5.0,
            raised_amount: 1.25,
            owner_wallet: 'casper-wallet-not-connected',
            contract_address: '',
            network: 'casper',
            status: 'active',
            created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
        },
        {
            id: 'p-demo-2',
            title: 'AI-Powered Milestone Verifier',
            description: 'An open-source AI oracle that evaluates milestone completion proofs and automatically triggers on-chain fund releases via Casper smart contracts.',
            goal_amount: 8.0,
            raised_amount: 8.0,
            owner_wallet: 'casper-wallet-not-connected',
            contract_address: '',
            network: 'casper',
            status: 'funded',
            created_at: new Date(Date.now() - 86400000 * 12).toISOString(),
        },
        {
            id: 'p-demo-3',
            title: 'Casper NFT Marketplace SDK',
            description: 'A developer SDK for building NFT marketplaces on Casper, with built-in royalty enforcement and decentralized metadata storage.',
            goal_amount: 3.5,
            raised_amount: 0.8,
            owner_wallet: 'casper-wallet-not-connected',
            contract_address: '',
            network: 'casper',
            status: 'active',
            created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        }
    ],
    milestones: [
        {
            id: 'm-demo-1',
            project_id: 'p-demo-2',
            title: 'Core Evaluation Engine',
            description: 'Build and test the AI scoring pipeline against Casper milestone proof submissions.',
            amount: 3.0,
            approved: true,
            status: 'approved',
            created_at: new Date(Date.now() - 86400000 * 11).toISOString(),
        },
        {
            id: 'm-demo-2',
            project_id: 'p-demo-2',
            title: 'On-Chain Integration',
            description: 'Deploy Casper smart contract hooks that the AI oracle triggers on milestone approval.',
            amount: 5.0,
            approved: false,
            status: 'pending',
            created_at: new Date(Date.now() - 86400000 * 8).toISOString(),
        }
    ],
    users: [],
    votes: [],
    transactions: [
        {
            id: 't-demo-1',
            project_id: 'p-demo-1',
            wallet_address: 'casper-wallet-not-connected',
            amount: 1.25,
            type: 'funding',
            tx_hash: 'demo-tx-hash-1',
            created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
        },
    ],
};

// ── Network backfill ──────────────────────────────────────────────────────────
/**
 * resolveNetwork(walletAddress)
 *
 * Infers the network a project belongs to based on the wallet address format.
 *   '0x...'           → 'hashkey'  (EVM / HashKey Chain legacy rows)
 *   '01...' / '02...' → 'casper'   (Casper Network ed25519 / secp256k1 keys)
 *   'bitcoincash:...' → 'bch'      (Bitcoin Cash legacy rows)
 *   anything else     → 'unknown'
 */
function resolveNetwork(wallet) {
    if (!wallet || typeof wallet !== 'string') return 'unknown'
    const w = wallet.trim().toLowerCase()
    if (w.startsWith('0x'))                       return 'hashkey'
    if (w.startsWith('01') || w.startsWith('02')) return 'casper'
    if (w.startsWith('bitcoincash:'))             return 'bch'
    return 'unknown'
}

/**
 * migrateData(data)
 *
 * Backfills the `network` field on any project rows that lack it.
 * Does NOT delete or modify any other fields.
 * Runs once at module load on the data loaded from localStorage.
 */
function migrateData(data) {
    if (!data || !Array.isArray(data.projects)) return data
    let modified = false
    data.projects = data.projects.map(p => {
        if (p.network) return p  // already stamped
        modified = true
        return { ...p, network: resolveNetwork(p.owner_wallet) }
    })
    if (modified) {
        console.log('[mockDB] migrateData: backfilled network field on legacy project rows')
    }
    return data
}

// ── Load & persist ────────────────────────────────────────────────────────────

function loadDB() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            // If the stored data has legacy project IDs (p1/p2/p3 from the old
            // BCH / EVM era), wipe it and start fresh with the Casper seed data.
            const hasLegacyIds = (parsed.projects || []).some(p =>
                p.id === 'p1' || p.id === 'p2' || p.id === 'p3'
            )
            if (hasLegacyIds) {
                console.log('[mockDB] loadDB: detected legacy BCH project IDs — resetting to Casper seed data')
                return INITIAL_DATA
            }
            return migrateData(parsed);
        }
    } catch (e) {
        console.error('Failed to load mock DB from localStorage:', e);
    }
    return INITIAL_DATA;
}

function saveDB(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error('Failed to save mock DB to localStorage:', e);
    }
}

let db = loadDB();

// Persist the migrated/reset state immediately so stale data is removed
saveDB(db);

export const mockDB = {
    getAll: (table) => {
        return db[table] || [];
    },

    getById: (table, id) => {
        return (db[table] || []).find(item => item.id === id) || null;
    },

    where: (table, field, value) => {
        return (db[table] || []).filter(item => item[field] === value);
    },

    /**
     * insert(table, item)
     *
     * For the 'projects' table, automatically stamps network = 'casper' on all
     * new rows unless the caller has already set it explicitly.
     * This ensures every project created through the app UI is Casper-tagged.
     */
    insert: (table, item) => {
        const extra = table === 'projects' && !item.network
            ? { network: 'casper' }
            : {}
        const newItem = {
            id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
            created_at: new Date().toISOString(),
            ...extra,
            ...item,
        };
        db[table] = [...(db[table] || []), newItem];
        saveDB(db);
        return newItem;
    },

    upsert: (table, item, conflictField) => {
        const index = (db[table] || []).findIndex(i => i[conflictField] === item[conflictField]);
        if (index !== -1) {
            db[table][index] = { ...db[table][index], ...item };
            saveDB(db);
            return db[table][index];
        } else {
            return mockDB.insert(table, item);
        }
    },

    update: (table, id, updates) => {
        const index = (db[table] || []).findIndex(i => i.id === id);
        if (index !== -1) {
            db[table][index] = { ...db[table][index], ...updates };
            saveDB(db);
            return db[table][index];
        }
        return null;
    },

    delete: (table, id) => {
        const initialLength = (db[table] || []).length;
        db[table] = (db[table] || []).filter(i => i.id !== id);
        if (db[table].length !== initialLength) {
            saveDB(db);
            return true;
        }
        return false;
    }
};
