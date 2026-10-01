import { useState, useEffect } from 'react';
import { Save, Loader2, Download, Upload, Trash2, RefreshCw, ExternalLink, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useSettings, useAIStatus, useModels, useElectron } from '../hooks/useElectron';
import { AIProviderType, OLLAMA_MODELS, GROQ_MODELS } from '@shared/constants';

export default function Settings() {
  const { settings, loading, updateSettings, resetSettings } = useSettings();
  const { status, refetch: refetchStatus } = useAIStatus();
  const { models, refetch: refetchModels } = useModels();
  const electron = useElectron();
  const [saving, setSaving] = useState(false);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ provider: string; success: boolean; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'ai' | 'voice' | 'privacy' | 'ui' | 'advanced'>('ai');
  const [ollamaModelInput, setOllamaModelInput] = useState('');
  const [groqApiKey, setGroqApiKey] = useState('');

  useEffect(() => {
    if (settings) {
      setOllamaModelInput(settings.ai.ollamaModel);
      setGroqApiKey(settings.ai.groqApiKey);
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({
        ai: {
          ...settings!.ai,
          ollamaModel: ollamaModelInput,
          groqApiKey,
        },
      });
      setTestResult({ provider: 'settings', success: true, message: 'Settings saved successfully' });
      refetchStatus();
      refetchModels();
    } catch (error) {
      setTestResult({ provider: 'settings', success: false, message: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async (provider: AIProviderType) => {
    setTestingProvider(provider);
    setTestResult(null);
    try {
      if (provider === 'ollama') {
        const res = await fetch(`${settings?.ai.ollamaUrl || 'http://localhost:11434'}/api/tags`);
        if (res.ok) {
          setTestResult({ provider: 'Ollama', success: true, message: 'Connected successfully' });
        } else {
          setTestResult({ provider: 'Ollama', success: false, message: `HTTP ${res.status}` });
        }
      } else if (provider === 'groq') {
        if (!groqApiKey) {
          setTestResult({ provider: 'Groq', success: false, message: 'API key required' });
          return;
        }
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { 'Authorization': `Bearer ${groqApiKey}` },
        });
        if (res.ok) {
          setTestResult({ provider: 'Groq', success: true, message: 'Connected successfully' });
        } else {
          setTestResult({ provider: 'Groq', success: false, message: `HTTP ${res.status}` });
        }
      }
    } catch (error) {
      setTestResult({ provider, success: false, message: (error as Error).message });
    } finally {
      setTestingProvider(null);
    }
  };

  const pullOllamaModel = async (model: string) => {
    try {
      await electron.ai.pullModel(model);
      refetchModels();
      setTestResult({ provider: 'Ollama', success: true, message: `Model ${model} pulled successfully` });
    } catch (error) {
      setTestResult({ provider: 'Ollama', success: false, message: (error as Error).message });
    }
  };

  const ollamaStatus = status.find(s => s.type === 'ollama');
  const groqStatus = status.find(s => s.type === 'groq');

  const tabs = [
    { id: 'ai', label: 'AI Providers', icon: '🤖' },
    { id: 'voice', label: 'Voice', icon: '🎙️' },
    { id: 'privacy', label: 'Privacy', icon: '🔒' },
    { id: 'ui', label: 'Interface', icon: '🎨' },
    { id: 'advanced', label: 'Advanced', icon: '⚙️' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-slate-400">Configure JARVIS to your preferences</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg flex items-center gap-2 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Settings
        </button>
      </div>

      {testResult && (
        <div className={`p-4 rounded-lg border flex items-center gap-3 ${testResult.success ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          {testResult.success ? <CheckCircle className="w-5 h-5 text-green-400" /> : <XCircle className="w-5 h-5 text-red-400" />}
          <div>
            <p className="font-medium">{testResult.provider}</p>
            <p className="text-sm text-slate-400">{testResult.message}</p>
          </div>
        </div>
      )}

      <div className="flex gap-2 border-b border-slate-800 overflow-x-auto pb-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-slate-800 text-white border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {activeTab === 'ai' && <AITab
          settings={settings!}
          status={status}
          models={models}
          ollamaModelInput={ollamaModelInput}
          setOllamaModelInput={setOllamaModelInput}
          groqApiKey={groqApiKey}
          setGroqApiKey={setGroqApiKey}
          testConnection={testConnection}
          testingProvider={testingProvider}
          pullOllamaModel={pullOllamaModel}
          updateSettings={updateSettings}
          refetchModels={refetchModels}
          electron={electron}
        />}
        {activeTab === 'voice' && <VoiceTab settings={settings!} updateSettings={updateSettings} />}
        {activeTab === 'privacy' && <PrivacyTab settings={settings!} updateSettings={updateSettings} />}
        {activeTab === 'ui' && <UITab settings={settings!} updateSettings={updateSettings} />}
        {activeTab === 'advanced' && <AdvancedTab settings={settings!} updateSettings={updateSettings} electron={electron} resetSettings={resetSettings} />}
      </div>
    </div>
  );
}

function AITab({ settings, status, models, ollamaModelInput, setOllamaModelInput, groqApiKey, setGroqApiKey, testConnection, testingProvider, pullOllamaModel, updateSettings, refetchModels, electron }: any) {
  const ollamaStatus = status.find((s: any) => s.type === 'ollama');
  const groqStatus = status.find((s: any) => s.type === 'groq');
  const ollamaModels = models.filter((m: any) => !m.name.includes('groq') && !m.name.includes('mixtral') && !m.name.includes('gemma'));
  const groqModels = models.filter((m: any) => m.name.includes('groq') || m.name.includes('mixtral') || m.name.includes('gemma') || m.name.includes('llama-3'));

  return (
    <div className="space-y-6">
      <section className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl space-y-6">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">AI Provider Selection</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {['auto', 'ollama', 'groq'].map(provider => (
            <label key={provider} className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
              settings.ai.provider === provider
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-slate-700 hover:border-slate-600'
            }`}>
              <input
                type="radio"
                name="ai-provider"
                value={provider}
                checked={settings.ai.provider === provider}
                onChange={e => updateSettings({ ai: { ...settings.ai, provider: e.target.value as AIProviderType } })}
                className="sr-only"
              />
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${provider === 'auto' ? 'bg-gradient-to-br from-blue-500 to-purple-600' : provider === 'ollama' ? 'bg-green-500/20' : 'bg-orange-500/20'}`}>
                  {provider === 'auto' && <span className="text-white font-bold">Auto</span>}
                  {provider === 'ollama' && <span className="text-green-400 text-lg">🦙</span>}
                  {provider === 'groq' && <span className="text-orange-400 text-lg">⚡</span>}
                </div>
                <div>
                  <p className="font-medium text-white capitalize">{provider}</p>
                  <p className="text-xs text-slate-400">
                    {provider === 'auto' ? 'Automatically select best available' : provider === 'ollama' ? 'Local models only' : 'Cloud inference via Groq'}
                  </p>
                </div>
              </div>
            </label>
          ))}
        </div>
      </section>

      <section className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl space-y-6">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">Ollama (Local)</h2>
        <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
          <div className={`w-3 h-3 rounded-full ${ollamaStatus?.connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-slate-300">
            {ollamaStatus?.connected ? `Connected (${ollamaStatus.latency}ms) • ${ollamaModels.length} models` : 'Disconnected'}
          </span>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Ollama URL</label>
            <input
              type="text"
              value={settings.ai.ollamaUrl}
              onChange={e => updateSettings({ ai: { ...settings.ai, ollamaUrl: e.target.value } })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
              placeholder="http://localhost:11434"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Default Model</label>
            <div className="relative">
              <select
                value={ollamaModelInput}
                onChange={e => setOllamaModelInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500 appearance-none pr-10"
              >
                {OLLAMA_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                {ollamaModels.map((m: any) => <option key={m.name} value={m.name}>{m.name} (installed)</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => testConnection('ollama')}
            disabled={testingProvider === 'ollama'}
            className="px-4 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {testingProvider === 'ollama' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Test Connection
          </button>
        </div>
      </section>

      <section className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl space-y-6">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">Groq (Cloud)</h2>
        <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
          <div className={`w-3 h-3 rounded-full ${groqStatus?.connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-slate-300">
            {groqStatus?.connected ? `Connected (${groqStatus.latency}ms) • ${groqModels.length} models` : 'Not configured'}
          </span>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">API Key</label>
            <div className="relative">
              <input
                type="password"
                value={groqApiKey}
                onChange={e => setGroqApiKey(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500 pr-10"
                placeholder="gsk_..."
              />
              {groqApiKey && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400">
                  <CheckCircle className="w-4 h-4" />
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">Get your API key from <a href="https://console.groq.com" target="_blank" rel="noopener" className="text-blue-400 hover:underline">Groq Console</a></p>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Default Model</label>
            <select
              value={settings.ai.groqModel}
              onChange={e => updateSettings({ ai: { ...settings.ai, groqModel: e.target.value } })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
            >
              {GROQ_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <button
          onClick={() => testConnection('groq')}
          disabled={testingProvider === 'groq' || !groqApiKey}
          className="px-4 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {testingProvider === 'groq' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Test Connection
        </button>
      </section>

      <section className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">Model Management</h2>
        <div className="space-y-2">
          {ollamaModels.map((model: any) => (
            <div key={model.name} className="flex items-center justify-between p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
              <div>
                <p className="font-medium text-white">{model.name}</p>
                <p className="text-xs text-slate-400">{model.size ? `${(model.size / 1e9).toFixed(1)} GB` : 'Unknown size'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => pullOllamaModel(model.name)}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                >
                  <Download className="w-3 h-3 mr-1" />
                  Pull
                </button>
                <button
                  onClick={() => electron.ai.deleteModel(model.name).then(refetchModels)}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Model name to pull (e.g., llama3.2:7b)"
            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
            onKeyDown={e => { if (e.key === 'Enter') { const input = e.target as HTMLInputElement; if (input.value) { pullOllamaModel(input.value); input.value = ''; } } }}
          />
          <button
            onClick={() => {
              const input = document.querySelector('input[placeholder*="Model name"]') as HTMLInputElement;
              if (input?.value) pullOllamaModel(input.value);
            }}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            Pull Model
          </button>
        </div>
      </section>

      <section className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">Generation Parameters</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Temperature: {settings.ai.temperature}</label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.ai.temperature}
              onChange={e => updateSettings({ ai: { ...settings.ai, temperature: parseFloat(e.target.value) } })}
              className="w-full accent-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Max Tokens: {settings.ai.maxTokens}</label>
            <input
              type="range"
              min="512"
              max="8192"
              step="512"
              value={settings.ai.maxTokens}
              onChange={e => updateSettings({ ai: { ...settings.ai, maxTokens: parseInt(e.target.value) } })}
              className="w-full accent-blue-500"
            />
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.ai.stream}
              onChange={e => updateSettings({ ai: { ...settings.ai, stream: e.target.checked } })}
              className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-300">Enable Streaming</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.ai.toolCalling}
              onChange={e => updateSettings({ ai: { ...settings.ai, toolCalling: e.target.checked } })}
              className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-300">Enable Tool Calling</span>
          </label>
        </div>
      </section>
    </div>
  );
}

function VoiceTab({ settings, updateSettings }: any) {
  return (
    <div className="space-y-6">
      <section className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">Voice Settings</h2>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.voice.enabled}
            onChange={e => updateSettings({ voice: { ...settings.voice, enabled: e.target.checked } })}
            className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-300">Enable Voice Features</span>
        </label>
      </section>

      <section className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">Text-to-Speech</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-400">TTS Provider</span>
            <select
              value={settings.voice.ttsProvider}
              onChange={e => updateSettings({ voice: { ...settings.voice, ttsProvider: e.target.value as any } })}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="fish-audio">Fish Audio (Cloud)</option>
              <option value="system">System TTS (Local)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-400">Speed: {settings.voice.speed}</span>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={settings.voice.speed}
              onChange={e => updateSettings({ voice: { ...settings.voice, speed: parseFloat(e.target.value) } })}
              className="accent-blue-500"
            />
          </label>
        </div>
        {settings.voice.ttsProvider === 'fish-audio' && (
          <div className="space-y-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-slate-400">Fish Audio API Key</span>
              <input
                type="password"
                value={settings.voice.fishAudioApiKey}
                onChange={e => updateSettings({ voice: { ...settings.voice, fishAudioApiKey: e.target.value } })}
                placeholder="Enter API key"
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-slate-400">Voice ID</span>
              <input
                value={settings.voice.fishAudioVoiceId}
                onChange={e => updateSettings({ voice: { ...settings.voice, fishAudioVoiceId: e.target.value } })}
                placeholder="Voice ID"
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </label>
          </div>
        )}
      </section>

      <section className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">Speech-to-Text</h2>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-400">STT Provider</span>
          <select
            value={settings.voice.sttProvider}
            onChange={e => updateSettings({ voice: { ...settings.voice, sttProvider: e.target.value as any } })}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="whisper">Whisper (API)</option>
            <option value="web-speech">Web Speech API (Browser)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-400">Language</span>
          <input
            value={settings.voice.language}
            onChange={e => updateSettings({ voice: { ...settings.voice, language: e.target.value } })}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </label>
      </section>
    </div>
  );
}

function PrivacyTab({ settings, updateSettings }: any) {
  return (
    <div className="space-y-6">
      <section className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">Data Privacy</h2>
        <div className="space-y-3">
          {[
            { key: 'localFirst', label: 'Local-First Mode', desc: 'Prefer local models over cloud' },
            { key: 'saveConversations', label: 'Save Conversations', desc: 'Store chat history locally' },
            { key: 'saveMemory', label: 'Save Memory', desc: 'Remember facts and preferences' },
            { key: 'telemetry', label: 'Telemetry', desc: 'Send anonymous usage data' },
          ].map(item => (
            <label key={item.key} className="flex items-center gap-3 p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
              <input
                type="checkbox"
                checked={settings.privacy[item.key as keyof typeof settings.privacy]}
                onChange={e => updateSettings({ privacy: { ...settings.privacy, [item.key]: e.target.checked } })}
                className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="font-medium text-white">{item.label}</p>
                <p className="text-xs text-slate-400">{item.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      <section className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">Data Management</h2>
        <div className="flex flex-wrap gap-3">
          <button className="px-4 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export Data
          </button>
          <button className="px-4 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Import Data
          </button>
          <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 transition-colors">
            <Trash2 className="w-4 h-4" />
            Clear All Data
          </button>
        </div>
      </section>
    </div>
  );
}

function UITab({ settings, updateSettings }: any) {
  return (
    <div className="space-y-6">
      <section className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">Appearance</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {['dark', 'light', 'system'].map(theme => (
            <label key={theme} className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
              settings.ui.theme === theme
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-slate-700 hover:border-slate-600'
            }`}>
              <input
                type="radio"
                name="theme"
                value={theme}
                checked={settings.ui.theme === theme}
                onChange={e => updateSettings({ ui: { ...settings.ui, theme: e.target.value as any } })}
                className="sr-only"
              />
              <div className="text-center">
                <p className="font-medium text-white capitalize">{theme}</p>
                <p className="text-xs text-slate-400">{theme === 'system' ? 'Follow system' : theme === 'dark' ? 'Dark mode' : 'Light mode'}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      <section className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">Behavior</h2>
        <div className="space-y-3">
          {[
            { key: 'animations', label: 'Animations', desc: 'Enable UI transitions' },
            { key: 'compactMode', label: 'Compact Mode', desc: 'Reduce spacing and padding' },
            { key: 'alwaysOnTop', label: 'Always on Top', desc: 'Keep window above others' },
          ].map(item => (
            <label key={item.key} className="flex items-center gap-3 p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
              <input
                type="checkbox"
                checked={settings.ui[item.key as keyof typeof settings.ui]}
                onChange={e => updateSettings({ ui: { ...settings.ui, [item.key]: e.target.checked } })}
                className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="font-medium text-white">{item.label}</p>
                <p className="text-xs text-slate-400">{item.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}

function AdvancedTab({ settings, updateSettings, electron, resetSettings }: any) {
  const [hotkeyModifier, setHotkeyModifier] = useState<string[]>(settings.hotkey.modifier);
  const [hotkeyKey, setHotkeyKey] = useState(settings.hotkey.key);

  return (
    <div className="space-y-6">
      <section className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">Global Hotkey</h2>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.hotkey.enabled}
            onChange={e => updateSettings({ hotkey: { ...settings.hotkey, enabled: e.target.checked } })}
            className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-300">Enable Global Hotkey</span>
        </label>
        <div className="flex items-center gap-2">
          <select
            value={hotkeyModifier.join('+')}
            onChange={e => {
              const mods = e.target.value.split('+');
              setHotkeyModifier(mods);
              updateSettings({ hotkey: { ...settings.hotkey, modifier: mods } });
            }}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="CommandOrControl+Shift">Cmd/Ctrl + Shift</option>
            <option value="CommandOrControl+Alt">Cmd/Ctrl + Alt</option>
            <option value="Alt+Shift">Alt + Shift</option>
            <option value="CommandOrControl">Cmd/Ctrl Only</option>
          </select>
          <span className="text-slate-400">+</span>
          <input
            type="text"
            value={hotkeyKey}
            onChange={e => {
              setHotkeyKey(e.target.value.toUpperCase());
              updateSettings({ hotkey: { ...settings.hotkey, key: e.target.value.toUpperCase() } });
            }}
            maxLength={1}
            className="w-12 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500 text-center"
          />
        </div>
        <p className="text-xs text-slate-500">Press the key combination to toggle JARVIS window</p>
      </section>

      <section className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">Tray</h2>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.tray.enabled}
            onChange={e => updateSettings({ tray: { ...settings.tray, enabled: e.target.checked } })}
            className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-300">Show in System Tray</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.tray.minimizeToTray}
            onChange={e => updateSettings({ tray: { ...settings.tray, minimizeToTray: e.target.checked } })}
            className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-300">Minimize to Tray instead of closing</span>
        </label>
      </section>

      <section className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">Danger Zone</h2>
        <button
          onClick={() => {
            if (confirm('This will reset all settings to defaults. Continue?')) {
              resetSettings();
            }
          }}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 transition-colors"
        >
          <AlertTriangle className="w-4 h-4" />
          Reset All Settings
        </button>
        <p className="text-xs text-slate-500">This action cannot be undone. All preferences will be restored to defaults.</p>
      </section>
    </div>
  );
}