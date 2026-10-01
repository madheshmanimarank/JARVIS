import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Send, Loader2, Settings, Download, Trash2, Play, Pause } from 'lucide-react';
import { useVoiceState, useSettings, useElectron } from '../hooks/useElectron';
import { VoiceState } from '@shared/types';

export default function Voice() {
  const { state, start, stop, speak } = useVoiceState();
  const { settings, updateSettings } = useSettings();
  const electron = useElectron();
  const [inputText, setInputText] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (state === VoiceState.SPEAKING) setSpeaking(true);
    else if (state === VoiceState.IDLE) setSpeaking(false);
  }, [state]);

  const handleStartListening = async () => {
    try {
      await start();
      setIsRecording(true);
      await setupAudioVisualizer();
    } catch (error) {
      console.error('Failed to start listening:', error);
      setIsRecording(false);
    }
  };

  const handleStopListening = async () => {
    try {
      await stop();
      setIsRecording(false);
      cleanupAudioVisualizer();
    } catch (error) {
      console.error('Failed to stop listening:', error);
    }
  };

  const setupAudioVisualizer = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      animateAudioLevel();
    } catch (error) {
      console.error('Audio visualizer setup failed:', error);
    }
  };

  const animateAudioLevel = () => {
    if (!analyserRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    setAudioLevel(average / 255);
    animationRef.current = requestAnimationFrame(animateAudioLevel);
  };

  const cleanupAudioVisualizer = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  };

  const handleSpeak = async () => {
    if (!inputText.trim()) return;
    setSpeaking(true);
    try {
      await speak(inputText);
    } catch (error) {
      console.error('TTS failed:', error);
    } finally {
      setSpeaking(false);
    }
  };

  useEffect(() => {
    return () => cleanupAudioVisualizer();
  }, []);

  const voiceEnabled = settings?.voice.enabled;
  const ttsProvider = settings?.voice.ttsProvider;
  const sttProvider = settings?.voice.sttProvider;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Voice</h1>
        <p className="text-slate-400">Speech-to-text and text-to-speech capabilities</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Mic className="w-5 h-5 text-blue-400" />
            Speech to Text
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <div className={`relative w-32 h-32 rounded-full border-4 flex items-center justify-center ${
                isRecording ? 'border-blue-500 bg-blue-500/10 animate-pulse' : 'border-slate-700'
              }`}>
                <div className="absolute inset-0 rounded-full border-4 border-blue-500/30 animate-ping" />
                <button
                  onClick={isRecording ? handleStopListening : handleStartListening}
                  disabled={!voiceEnabled}
                  className="w-20 h-20 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-white hover:bg-blue-600 hover:border-blue-500 transition-colors disabled:opacity-50"
                >
                  {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                </button>
              </div>
            </div>
            <div className="text-center">
              <p className={`text-lg font-medium ${isRecording ? 'text-blue-400' : 'text-slate-400'}`}>
                {isRecording ? 'Listening...' : 'Click to start listening'}
              </p>
              <div className="h-2 bg-slate-800 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-100"
                  style={{ width: `${audioLevel * 100}%` }}
                />
              </div>
            </div>
            {transcript && (
              <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                <p className="text-sm text-slate-300">{transcript}</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-purple-400" />
            Text to Speech
          </h2>
          <div className="space-y-4">
            <textarea
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Enter text to speak..."
              rows={4}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={handleSpeak}
                disabled={!inputText.trim() || speaking || !voiceEnabled}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                {speaking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {speaking ? 'Speaking...' : 'Speak'}
              </button>
              <button
                onClick={() => electron.voice.stop()}
                disabled={!speaking}
                className="px-4 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                <Pause className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-slate-400" />
          Voice Settings
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={voiceEnabled}
              onChange={e => updateSettings({ voice: { ...settings!.voice, enabled: e.target.checked } })}
              className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-300">Enable Voice</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-sm text-slate-400">TTS Provider</span>
            <select
              value={ttsProvider}
              onChange={e => updateSettings({ voice: { ...settings!.voice, ttsProvider: e.target.value as any } })}
              className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="fish-audio">Fish Audio</option>
              <option value="system">System TTS</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-sm text-slate-400">STT Provider</span>
            <select
              value={sttProvider}
              onChange={e => updateSettings({ voice: { ...settings!.voice, sttProvider: e.target.value as any } })}
              className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="whisper">Whisper (API)</option>
              <option value="web-speech">Web Speech API</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Speed</span>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={settings?.voice.speed || 1}
              onChange={e => updateSettings({ voice: { ...settings!.voice, speed: parseFloat(e.target.value) } })}
              className="flex-1 accent-blue-500"
            />
          </label>
          {ttsProvider === 'fish-audio' && (
            <div className="md:col-span-2 lg:col-span-4 space-y-2">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-slate-400">Fish Audio API Key</span>
                <input
                  type="password"
                  value={settings?.voice.fishAudioApiKey || ''}
                  onChange={e => updateSettings({ voice: { ...settings!.voice, fishAudioApiKey: e.target.value } })}
                  placeholder="Enter API key"
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-slate-400">Voice ID</span>
                <input
                  value={settings?.voice.fishAudioVoiceId || ''}
                  onChange={e => updateSettings({ voice: { ...settings!.voice, fishAudioVoiceId: e.target.value } })}
                  placeholder="Voice ID"
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}