import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import Groq from 'groq-sdk'
import { evaluateSubmission } from './ai/evaluator.js'

dotenv.config()

const app = express()
const port = Number(process.env.PORT || 3001)
const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null

app.use(cors())
app.use(express.json({ limit: '64kb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, aiConfigured: Boolean(groq) })
})

app.post('/api/evaluate', async (req, res) => {
  const submission = String(req.body?.submission || req.body?.workDescription || '').trim()
  const threshold = Math.max(0, Math.min(100, Number(req.body?.threshold ?? 75)))

  if (!submission) return res.status(400).json({ error: 'Submission is required.' })
  if (!groq) return res.status(503).json({ error: 'GROQ_API_KEY is not configured.' })

  try {
    const evaluation = await evaluateSubmission({
      groq,
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      submission,
      threshold,
    })
    return res.json({ ...evaluation, score: evaluation.overallScore, threshold })
  } catch (error) {
    console.error('[evaluation]', error)
    return res.status(502).json({ error: 'The AI evaluation failed. Please retry.' })
  }
})

app.listen(port, () => {
  console.log(`Arbit API listening on http://localhost:${port}`)
})
