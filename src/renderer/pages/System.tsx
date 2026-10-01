import { useState, useEffect } from 'react';
import { Cpu, HardDrive, MemoryStick, Wifi, Activity, Loader2, RefreshCw } from 'lucide-react';
import { useSystemMetrics, useTools, useElectron } from '../hooks/useElectron';

export default function System() {
  const { metrics, loading, refetch } = useSystemMetrics();
  const { tools, executeTool } = useTools();
  const electron = useElectron();
  const [command, setCommand] = useState('');
  const [commandOutput, setCommandOutput] = useState('');
  const [runningCommand, setRunningCommand] = useState(false);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleRunCommand = async () => {
    if (!command.trim()) return;
    setRunningCommand(true);
    try {
      const result = await executeTool('execute_command', { command: command.trim() });
      if (result.success && result.result) {
        const output = result.result as { stdout?: string; stderr?: string };
        setCommandOutput(`${output.stdout || ''}${output.stderr || ''}`);
      } else {
        setCommandOutput(`Error: ${result.error}`);
      }
    } catch (error) {
      setCommandOutput(`Error: ${(error as Error).message}`);
    } finally {
      setRunningCommand(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">System</h1>
          <p className="text-slate-400">Real-time system monitoring and control</p>
        </div>
        <button onClick={refetch} disabled={loading} className="px-4 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl animate-pulse">
              <div className="h-4 bg-slate-700 rounded w-1/2 mb-2" />
              <div className="h-8 bg-slate-700 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : metrics ? (
        <>
          <div className="grid md:grid-cols-4 gap-4">
            <MetricCard
              icon={Cpu}
              label="CPU"
              value={`${metrics.cpu.usage.toFixed(1)}%`}
              sublabel={`${metrics.cpu.cores} cores • Load: ${metrics.cpu.loadAverage.map(l => l.toFixed(2)).join(', ')}`}
              color="blue"
            />
            <MetricCard
              icon={MemoryStick}
              label="Memory"
              value={`${metrics.memory.percentage.toFixed(1)}%`}
              sublabel={`${formatBytes(metrics.memory.used)} / ${formatBytes(metrics.memory.total)}`}
              color="green"
            />
            <MetricCard
              icon={HardDrive}
              label="Disk"
              value={`${metrics.disk.percentage.toFixed(1)}%`}
              sublabel={`${formatBytes(metrics.disk.used)} / ${formatBytes(metrics.disk.total)}`}
              color="orange"
            />
            <MetricCard
              icon={Wifi}
              label="Network"
              value={`${metrics.network.interfaces.filter(i => !i.internal).length} interfaces`}
              sublabel={metrics.network.interfaces.find(i => !i.internal)?.address || 'N/A'}
              color="purple"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-400" />
                System Info
              </h2>
              <div className="space-y-3 text-sm">
                <InfoRow label="Platform" value={`${metrics.platform} (${metrics.arch})`} />
                <InfoRow label="Hostname" value={metrics.hostname} />
                <InfoRow label="Uptime" value={formatUptime(metrics.uptime)} />
                <InfoRow label="CPU Cores" value={metrics.cpu.cores.toString()} />
                <InfoRow label="Load Average" value={metrics.cpu.loadAverage.map(l => l.toFixed(2)).join(', ')} />
              </div>
            </div>

            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-green-400" />
                Network Interfaces
              </h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {metrics.network.interfaces.map((iface, i) => (
                  <div key={i} className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white">{iface.name}</span>
                      <span className={`w-2 h-2 rounded-full ${iface.internal ? 'bg-gray-500' : 'bg-green-500'}`} />
                    </div>
                    <div className="text-xs text-slate-400 mt-1 space-y-1">
                      <div>{iface.address} / {iface.netmask}</div>
                      <div>{iface.family} • {iface.mac}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-400" />
              Command Execution
            </h2>
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={command}
                  onChange={e => setCommand(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleRunCommand()}
                  placeholder="Enter command (e.g., ls -la, ps aux, df -h)"
                  className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleRunCommand}
                  disabled={!command.trim() || runningCommand}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg flex items-center gap-2 transition-colors"
                >
                  {runningCommand ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                  Run
                </button>
              </div>
              {commandOutput && (
                <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 text-sm text-slate-300 overflow-x-auto max-h-96">
                  {commandOutput}
                </pre>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center text-slate-400 py-12">Failed to load system metrics</div>
      )}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, sublabel, color }: { icon: any; label: string; value: string; sublabel: string; color: 'blue' | 'green' | 'orange' | 'purple' }) {
  const colors: Record<'blue' | 'green' | 'orange' | 'purple', string> = {
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    green: 'text-green-400 bg-green-500/10 border-green-500/20',
    orange: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  };

  return (
    <div className={`p-6 bg-slate-900/50 border border-slate-800 rounded-xl ${colors[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-5 h-5" />
        <span className="text-xs text-slate-400 uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-3xl font-bold text-white">{value}</div>
      <div className="text-sm text-slate-400 mt-1">{sublabel}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-800/50">
      <span className="text-slate-400">{label}</span>
      <span className="text-white font-mono text-sm">{value}</span>
    </div>
  );
}

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}