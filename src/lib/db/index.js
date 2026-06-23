export { upsertUser, getUserByWallet } from './users'
export {
    createProject,
    fetchProjects,
    fetchProjectById,
    updateRaisedAmount,
    updateFundedAmount,   // ← alias of updateRaisedAmount, both available
    updateProjectStatus,
    deleteProject,        // ← delete a project by UUID
    testInsertProject,    // ← dev/debug helper
} from './projects'
export {
    createMilestone, createMilestoneBatch,
    fetchMilestonesByProject, updateMilestoneStatus
} from './milestones'
export { voteOnMilestone, getVotesByMilestone, hasUserVoted } from './votes'
export {
    insertTransaction, fetchTransactionsByProject,
    getProjectFundingTotal
} from './transactions'