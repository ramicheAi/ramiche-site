import { FOOTBALL_CONFIG } from "@/app/apex-athlete/lib/sport-config";

export default function FootballDemo() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">METTLE Football Demo</h1>
        <p className="text-gray-400 mb-8">White‑label sport configuration in action</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Sport Config Card */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h2 className="text-2xl font-bold mb-4">Sport Configuration</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{FOOTBALL_CONFIG.sportIcon}</span>
                <div>
                  <div className="text-lg font-semibold">{FOOTBALL_CONFIG.sport}</div>
                  <div className="text-sm text-gray-400">Sport Icon</div>
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Terminology</h3>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(FOOTBALL_CONFIG.terminology).map(([key, value]) => (
                    <div key={key} className="bg-gray-900/50 p-3 rounded">
                      <div className="text-sm text-gray-400">{key}</div>
                      <div className="font-mono">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Metrics</h3>
                <div className="flex flex-wrap gap-2">
                  {FOOTBALL_CONFIG.metrics.slice(0, 8).map((metric, i) => (
                    <span key={i} className="px-3 py-1 bg-purple-900/30 text-purple-300 rounded-full text-sm">
                      {metric}
                    </span>
                  ))}
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Positions</h3>
                <div className="flex flex-wrap gap-2">
                  {FOOTBALL_CONFIG.positions.slice(0, 12).map((pos, i) => (
                    <span key={i} className="px-3 py-1 bg-blue-900/30 text-blue-300 rounded-full text-sm">
                      {pos}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          {/* Levels Card */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h2 className="text-2xl font-bold mb-4">Progression System</h2>
            <div className="space-y-6">
              {FOOTBALL_CONFIG.levels.map((level, i) => (
                <div 
                  key={level.name}
                  className="flex items-center justify-between p-4 rounded-lg"
                  style={{ backgroundColor: `${level.color}15`, border: `1px solid ${level.color}30` }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{level.icon}</span>
                    <div>
                      <div className="font-bold text-lg">{level.name}</div>
                      <div className="text-sm text-gray-300">{level.xpThreshold.toLocaleString()} XP threshold</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400">Level {i + 1}</div>
                    <div className="font-mono text-sm" style={{ color: level.color }}>
                      {i === FOOTBALL_CONFIG.levels.length - 1 ? 'MAX' : `→ ${FOOTBALL_CONFIG.levels[i + 1]?.name}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-8">
              <h3 className="font-semibold mb-3">Quest Templates</h3>
              <div className="space-y-2">
                {FOOTBALL_CONFIG.questTemplates.slice(0, 5).map((quest, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 bg-gray-900/50 rounded">
                    <div className="w-6 h-6 flex items-center justify-center bg-green-900/30 text-green-400 rounded text-xs font-bold">
                      {i + 1}
                    </div>
                    <div className="text-gray-300">{quest}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Comparison Card */}
          <div className="md:col-span-2 bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h2 className="text-2xl font-bold mb-4">Side‑by‑Side Comparison</h2>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <div className="text-lg font-semibold mb-4 text-center text-blue-400">🏊 Swimming</div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Meet:</span>
                    <span className="font-mono">Meet</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Event:</span>
                    <span className="font-mono">Event</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Personal Best:</span>
                    <span className="font-mono">Best Time</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Metrics:</span>
                    <span className="text-sm text-gray-300">50 Free, 100 Back, 200 IM...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Levels:</span>
                    <span className="text-sm text-gray-300">Rookie → Contender → Warrior...</span>
                  </div>
                </div>
              </div>
              
              <div>
                <div className="text-lg font-semibold mb-4 text-center text-amber-400">🏈 Football</div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Meet:</span>
                    <span className="font-mono">{FOOTBALL_CONFIG.terminology.meet}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Event:</span>
                    <span className="font-mono">{FOOTBALL_CONFIG.terminology.event}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Personal Best:</span>
                    <span className="font-mono">{FOOTBALL_CONFIG.terminology.personalBest}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Metrics:</span>
                    <span className="text-sm text-gray-300">Passing Yards, Tackles, Touchdowns...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Levels:</span>
                    <span className="text-sm text-gray-300">{FOOTBALL_CONFIG.levels.map(l => l.name).join(' → ')}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-8 pt-6 border-t border-gray-700">
              <h3 className="font-semibold mb-3">Implementation Status</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-green-900/20 border border-green-800 rounded">
                  <div className="text-green-400 font-semibold">✅ Config</div>
                  <div className="text-sm text-gray-300">Sport‑config.ts ready</div>
                </div>
                <div className="p-3 bg-yellow-900/20 border border-yellow-800 rounded">
                  <div className="text-yellow-400 font-semibold">🟡 Coach Portal</div>
                  <div className="text-sm text-gray-300">Sport‑aware levels active</div>
                </div>
                <div className="p-3 bg-red-900/20 border border-red-800 rounded">
                  <div className="text-red-400 font-semibold">🔴 UI Components</div>
                  <div className="text-sm text-gray-300">GameHUDHeader updated</div>
                </div>
                <div className="p-3 bg-red-900/20 border border-red-800 rounded">
                  <div className="text-red-400 font-semibold">🔴 Athlete Portal</div>
                  <div className="text-sm text-gray-300">Needs migration</div>
                </div>
                <div className="p-3 bg-red-900/20 border border-red-800 rounded">
                  <div className="text-red-400 font-semibold">🔴 Parent Portal</div>
                  <div className="text-sm text-gray-300">Needs migration</div>
                </div>
                <div className="p-3 bg-blue-900/20 border border-blue-800 rounded">
                  <div className="text-blue-400 font-semibold">🔵 Demo</div>
                  <div className="text-sm text-gray-300">This page — works!</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-8 text-center text-gray-500 text-sm">
          Football configuration loaded from <code className="bg-gray-900 px-2 py-1 rounded">/src/app/apex-athlete/lib/sport-config.ts</code>
        </div>
      </div>
    </div>
  );
}