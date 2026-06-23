import { callContract } from './casperClient'

export const createProjectOnChain = ({ publicKey, threshold, recipient }) =>
  callContract({
    publicKey,
    entryPoint: 'create_project',
    args: {
      threshold: { type: 'u32', value: threshold },
      recipient: { type: 'string', value: recipient },
    },
  })

export const submitProofOnChain = ({ publicKey, projectId, proof }) =>
  callContract({
    publicKey,
    entryPoint: 'submit_proof',
    args: {
      project_id: { type: 'u32', value: projectId },
      proof: { type: 'string', value: proof },
    },
  })

export const submitScoreOnChain = ({ oraclePublicKey, projectId, score }) =>
  callContract({
    publicKey: oraclePublicKey,
    entryPoint: 'submit_score',
    args: {
      project_id: { type: 'u32', value: projectId },
      score: { type: 'u32', value: score },
    },
  })

export const releasePayoutOnChain = ({ publicKey, projectId }) =>
  callContract({
    publicKey,
    entryPoint: 'release',
    args: { project_id: { type: 'u32', value: projectId } },
  })
