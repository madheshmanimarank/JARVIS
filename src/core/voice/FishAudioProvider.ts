export interface TTSProvider {
  speak(text: string, speed?: number): Promise<void>;
  stop(): void;
  setVoice(voiceId: string): void;
}

export class FishAudioProvider implements TTSProvider {
  private apiKey: string;
  private voiceId: string;
  private baseUrl = 'https://api.fish.audio/v1';
  private audioContext: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;

  constructor(apiKey: string, voiceId: string) {
    this.apiKey = apiKey;
    this.voiceId = voiceId;
  }

  async speak(text: string, speed = 1.0): Promise<void> {
    if (!this.apiKey) throw new Error('Fish Audio API key not configured');

    try {
      const response = await fetch(`${this.baseUrl}/tts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voice_id: this.voiceId,
          speed,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'TTS request failed');
      }

      const arrayBuffer = await response.arrayBuffer();
      await this.playAudio(arrayBuffer);
    } catch (error) {
      throw new Error(`TTS failed: ${(error as Error).message}`);
    }
  }

  private async playAudio(arrayBuffer: ArrayBuffer): Promise<void> {
    this.audioContext = new AudioContext();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    this.currentSource = this.audioContext.createBufferSource();
    this.currentSource.buffer = audioBuffer;
    this.currentSource.connect(this.audioContext.destination);
    this.currentSource.start();

    return new Promise(resolve => {
      this.currentSource!.onended = () => resolve();
    });
  }

  stop(): void {
    if (this.currentSource) {
      this.currentSource.stop();
      this.currentSource = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  setVoice(voiceId: string): void {
    this.voiceId = voiceId;
  }
}

export class SystemTTSProvider implements TTSProvider {
  private utterance: SpeechSynthesisUtterance | null = null;

  async speak(text: string, speed = 1.0): Promise<void> {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      throw new Error('Speech synthesis not supported');
    }

    return new Promise((resolve, reject) => {
      this.utterance = new SpeechSynthesisUtterance(text);
      this.utterance.rate = speed;
      this.utterance.onend = () => resolve();
      this.utterance.onerror = () => reject(new Error('Speech synthesis failed'));
      window.speechSynthesis.speak(this.utterance);
    });
  }

  stop(): void {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  setVoice(voiceId: string): void {
    if (this.utterance && typeof window !== 'undefined' && window.speechSynthesis) {
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find(v => v.name === voiceId || v.voiceURI === voiceId);
      if (voice) this.utterance.voice = voice;
    }
  }
}