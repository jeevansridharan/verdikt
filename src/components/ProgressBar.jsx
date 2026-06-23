import React from 'react'

export default function ProgressBar({ current, target }) {
    const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0
    const displayPct = percentage.toFixed(2)

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-300">Funding Progress</span>
                <span className="text-sm font-bold" style={{ color: percentage >= 100 ? '#10b981' : '#34d399' }}>
                    {displayPct}%
                </span>
            </div>
            <div className="progress-track" style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '999px', height: '8px', overflow: 'hidden' }}>
                <div
                    className="progress-fill"
                    style={{ width: `${displayPct}%`, background: 'linear-gradient(90deg, #10b981, #06b6d4)', height: '100%', borderRadius: '999px', transition: 'width 0.6s ease' }}
                    role="progressbar"
                    aria-valuenow={displayPct}
                    aria-valuemin="0"
                    aria-valuemax="100"
                />
            </div>
            <div className="flex justify-between mt-2 text-xs text-slate-500">
                <span>{current.toFixed(8)} CSPR raised</span>
                <span>Goal: {target.toFixed(8)} CSPR</span>
            </div>
        </div>
    )
}

