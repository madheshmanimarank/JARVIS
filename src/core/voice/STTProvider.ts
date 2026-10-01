export interface STTProvider {
  start(): Promise<void>;
  stop(): Promise<string | void>;
  onResult(callback: (text: string, isFinal: boolean) => void): () => void;
  onError(callback: (error: Error) => void): () => void;
}

export class WebSpeechSTTProvider implements STTProvider {
  private recognition: any = null;
  private resultCallback: ((text: string, isFinal: boolean) => void) | null = null;
  private errorCallback: ((error: Error) => void) | null = null;

  constructor(private language: string = 'en-US') {}

  async start(): Promise<void> {
    if (typeof window === 'undefined') throw new Error('WebSpeechSTTProvider only works in renderer process');

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) throw new Error('Speech recognition not supported');

    this.recognition = new SpeechRecognition();
    this.recognition.lang = this.language;
    this.recognition.continuous = true;
    this.recognition.interimResults = true;

    this.recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      if (this.resultCallback) {
        if (finalTranscript) this.resultCallback(finalTranscript, true);
        if (interimTranscript) this.resultCallback(interimTranscript, false);
      }
    };

    this.recognition.onerror = (event: any) => {
      if (this.errorCallback) {
        this.errorCallback(new Error(event.error));
      }
    };

    this.recognition.start();
  }

  async stop(): Promise<void> {
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }
  }

  onResult(callback: (text: string, isFinal: boolean) => void): () => void {
    this.resultCallback = callback;
    return () => { this.resultCallback = null; };
  }

  onError(callback: (error: Error) => void): () => void {
    this.errorCallback = callback;
    return () => { this.errorCallback = null; };
  }
}

export class WhisperSTTProvider implements STTProvider {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(apiKey: string, baseUrl: string = 'https://api.openai.com/v1', model: string = 'whisper-1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async start(): Promise<void> {
    if (typeof navigator === 'undefined') throw new Error('WhisperSTTProvider only works in renderer process');

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(stream);
    this.audioChunks = [];

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.audioChunks.push(event.data);
    };

    this.mediaRecorder.start(1000);
  }

  async stop(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) return reject(new Error('Not recording'));

      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        try {
          const formData = new FormData();
          formData.append('file', audioBlob, 'audio.webm');
          formData.append('model', this.model);

          const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.apiKey}` },
            body: formData,
          });

          const data = await response.json();
          resolve(data.text || '');
        } catch (error) {
          reject(error);
        }
      };

      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(t => t.stop());
      this.mediaRecorder = null;
    });
  }

  onResult(callback: (text: string, isFinal: boolean) => void): () => void {
    return () => {};
  }

  onError(callback: (error: Error) => void): () => void {
    return () => {};
  }
}