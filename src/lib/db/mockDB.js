/**
 * src/lib/db/mockDB.js
 * 
 * In-memory database with localStorage persistence to replace Supabase.
 */

const STORAGE_KEY = 'arbiter_mock_db';

const INITIAL_DATA = {
    projects: [
        {
            id: 'p1',
            title: 'Solar Powered Internet for Rural Schools',
            description: 'Providing sustainable energy and connectivity to 10 schools in underserved areas using solar panels and satellite internet.',
            goal_amount: 5.5,
            raised_amount: 2.1,
            owner_wallet: 'bitcoincash:qpm2qavv9p9z96xxdv3u3qzhpdkm3r6tpy9u36pks5',
            status: 'active',
            created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
        },
        {
            id: 'p2',
            title: 'Decentralized AI Governance Protocol',
            description: 'Building an open-source framework for AI agents to make collective decisions on funding and project management.',
            goal_amount: 12.0,
            raised_amount: 12.0,
            owner_wallet: 'bitcoincash:qr6m8a70z0kz927ue89as7m7zzh06e4a4u3m837k9v',
            status: 'funded',
            created_at: new Date(Date.now() - 86400000 * 15).toISOString(),
        },
        {
            id: 'p3',
            title: 'Clean Water Initiative',
            description: 'Installing water purification systems in communities with limited access to safe drinking water.',
            goal_amount: 3.0,
            raised_amount: 0.5,
            owner_wallet: 'bitcoincash:qzp4scsh7mq98pxmndm2z3zhpdkm3r6tpy7u36pks5',
            status: 'active',
            created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        }
    ],
    milestones: [
        {
            id: 'm1',
            project_id: 'p2',
            title: 'Architecture Design',
            description: 'Finalize the project architecture and documentation.',
            amount: 3.0,
            approved: true,
            created_at: new Date(Date.now() - 86400000 * 14).toISOString(),
        },
        {
            id: 'm2',
            project_id: 'p2',
            title: 'Smart Contract Development',
            description: 'Iterative design and testing of the core governance contracts.',
            amount: 5.0,
            approved: false,
            created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
        }
    ],
    users: [],
    votes: [],
    transactions: [
        {
            id: 't1',
            project_id: 'p1',
            wallet_address: 'bitcoincash:qzp4scsh7mq98pxmndm2z3zhpdkm3r6tpy7u36pks5',
            amount: 0.5,
            type: 'funding',
            tx_id: 'abc123...',
            created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
        },
        {
            id: 't2',
            project_id: 'p2',
            wallet_address: 'bitcoincash:qpm2qavv9p9z96xxdv3u3qzhpdkm3r6tpy9u36pks5',
            amount: 12.0,
            type: 'funding',
            tx_id: 'def456...',
            created_at: new Date(Date.now() - 86400000 * 14).toISOString(),
        }
    ],
};

function loadDB() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
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
    
    insert: (table, item) => {
        const newItem = {
            id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
            created_at: new Date().toISOString(),
            ...item
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
