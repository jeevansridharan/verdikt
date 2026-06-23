const CRITERIA = ['innovation', 'feasibility', 'impact', 'clarity']

function clampScore(value) {
  const score = Number(value)
  if (!Number.isFinite(score)) return 0
  return Math.max(0, Math.min(100, Math.round(score)))
}

export function parseEvaluation(raw) {
  const cleaned = String(raw).replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
  const parsed = JSON.parse(cleaned)
  const criteria = Object.fromEntries(
    CRITERIA.map((name) => [name, clampScore(parsed.criteria?.[name])]),
  )
  const overallScore = Math.round(
    CRITERIA.reduce((total, name) => total + criteria[name], 0) / CRITERIA.length,
  )

  return {
    criteria,
    overallScore,
    passed: false,
    summary: String(parsed.summary || '').slice(0, 800),
  }
}

export async function evaluateSubmission({ groq, model, submission, threshold = 75 }) {
  const completion = await groq.chat.completions.create({
    model,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: [
          'You evaluate project and milestone submissions for an AI-gated funding protocol.',
          'Return strict JSON with this shape:',
          '{"criteria":{"innovation":0,"feasibility":0,"impact":0,"clarity":0},"summary":"brief evidence-based explanation"}',
          'Each criterion must be an integer from 0 to 100. Do not include markdown.',
        ].join(' '),
      },
      {
        role: 'user',
        content: submission,
      },
    ],
  })

  const result = parseEvaluation(completion.choices[0]?.message?.content || '{}')
  result.passed = result.overallScore >= threshold
  return result
}
