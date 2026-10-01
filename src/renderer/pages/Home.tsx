import { Bot, MessageSquare, Mic, Monitor, Settings, Sparkles, Zap, Shield, Database } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAIStatus } from '../hooks/useElectron';

const features = [
  { icon: MessageSquare, title: 'Chat', desc: 'AI-powered conversations with local & cloud models', path: '/chat' },
  { icon: Mic, title: 'Voice', desc: 'Speech-to-text and text-to-speech capabilities', path: '/voice' },
  { icon: Monitor, title: 'System', desc: 'Real-time system monitoring and control', path: '/system' },
  { icon: Settings, title: 'Settings', desc: 'Configure providers, models, and preferences', path: '/settings' },
];

const stats = [
  { icon: Sparkles, label: 'Providers', value: '2', desc: 'Ollama + Groq' },
  { icon: Zap, label: 'Latency', value: '<100ms', desc: 'Local inference' },
  { icon: Shield, label: 'Privacy', value: '100%', desc: 'Local-first' },
  { icon: Database, label: 'Storage', value: 'SQLite', desc: 'Encrypted local' },
];

export default function Home() {
  const { status, loading } = useAIStatus();

  const ollamaStatus = status.find(s => s.type === 'ollama');
  const groqStatus = status.find(s => s.type === 'groq');

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-3 p-4 bg-gradient-to-r from-blue-500/20 to-purple-600/20 rounded-2xl border border-blue-500/30">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Bot className="w-8 h-8 text-white" />
          </div>
          <div className="text-left">
            <h1 className="text-3xl font-bold text-white">J.A.R.V.I.S.</h1>
            <p className="text-slate-400">Just A Rather Very Intelligent System</p>
          </div>
        </div>
        <p className="text-slate-300 text-lg max-w-2xl mx-auto">
          Your desktop AI assistant for reasoning, productivity, system interaction, and automation.
          Powered by local Ollama models and cloud Groq inference with full privacy control.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Link key={i} to="/settings" className="group p-4 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors">
            <stat.icon className="w-6 h-6 text-blue-400 mb-2" />
            <div className="text-2xl font-bold text-white">{stat.value}</div>
            <div className="text-sm text-slate-400">{stat.label}</div>
            <div className="text-xs text-slate-500 mt-1">{stat.desc}</div>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-400" />
            AI Provider Status
          </h2>
          <div className="space-y-3">
            <ProviderStatusCard
              name="Ollama (Local)"
              status={ollamaStatus}
              models={ollamaStatus?.models.length || 0}
              loading={loading}
            />
            <ProviderStatusCard
              name="Groq (Cloud)"
              status={groqStatus}
              models={groqStatus?.models.length || 0}
              loading={loading}
            />
          </div>
        </div>

        <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-400" />
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {features.map((feature, i) => (
              <Link
                key={i}
                to={feature.path}
                className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg hover:border-blue-500/50 hover:bg-blue-500/10 transition-colors group"
              >
                <feature.icon className="w-6 h-6 text-slate-400 group-hover:text-blue-400 transition-colors mb-2" />
                <div className="font-medium text-white">{feature.title}</div>
                <div className="text-sm text-slate-500">{feature.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-green-400" />
          Privacy & Security
        </h2>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2 text-slate-300">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            <span>All conversations stored locally in encrypted SQLite</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            <span>No telemetry or data collection by default</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            <span>Local-first: Ollama runs entirely on your machine</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="w-2 h-2 bg-yellow-500 rounded-full" />
            <span>Groq API key stored locally, never transmitted elsewhere</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            <span>Sandboxed renderer with context isolation</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            <span>Preload script allowlist enforces IPC security</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProviderStatusCard({ name, status, models, loading }: {
  name: string;
  status: any;
  models: number;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg animate-pulse">
        <div className="w-3 h-3 bg-slate-700 rounded-full" />
        <div className="flex-1 h-4 bg-slate-700 rounded" />
        <div className="w-20 h-4 bg-slate-700 rounded" />
      </div>
    );
  }

  const connected = status?.connected;
  const latency = status?.latency;

  return (
    <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
      <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-white truncate">{name}</div>
        <div className="text-xs text-slate-400">
          {connected ? `Connected • ${models} models • ${latency}ms` : 'Disconnected'}
        </div>
      </div>
      <div className="text-sm text-slate-400">
        {connected ? '●' : '○'}
      </div>
    </div>
  );
}