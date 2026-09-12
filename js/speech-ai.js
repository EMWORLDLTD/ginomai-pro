// Ginomia Pro - Web Speech AI & Intelligent Bible / Song Detection Engine
'use strict';

class SpeechAiEngine {
  constructor(options = {}) {
    // Support either options object or legacy positional arguments
    if (typeof options === 'function') {
      this.onVerseDetected = arguments[0] || null;
      this.onTranscript = arguments[1] || null;
      this.onParaphraseDetected = arguments[2] || null;
      this.onSongDetected = arguments[3] || null;
    } else {
      this.onVerseDetected = options.onVerseDetected || null;
      this.onSongDetected = options.onSongDetected || null;
      this.onTranscript = options.onTranscript || null;
      this.onParaphraseDetected = options.onParaphraseDetected || null;
    }

    this.recognition = null;
    this.isListening = false;
    this.restartTimer = null;
    this.lastProcessedText = '';
    this.lastVerseDetectedTime = 0;
    this.lastSongDetectedTime = 0;

    // AI Speech Provider Configuration
    this.provider = (typeof localStorage !== 'undefined' && localStorage.getItem('sf_ai_provider')) || 'deepgram';
    this.deepgramApiKey = (typeof localStorage !== 'undefined' && localStorage.getItem('sf_deepgram_api_key')) || '';
    this.deepgramModel = (typeof localStorage !== 'undefined' && localStorage.getItem('sf_deepgram_model')) || 'nova-2';
    this.churchCustomTerms = (typeof localStorage !== 'undefined' && localStorage.getItem('sf_church_custom_terms')) || '';
    this.selectedDeviceId = (typeof localStorage !== 'undefined' && localStorage.getItem('sf_selected_mic_device')) || 'default';
    this.deepgramSocket = null;
    this.mediaRecorder = null;
    this.audioStream = null;
    this.processedAudioStream = null;
    this.audioProcessingContext = null;

    // Number word dictionary for speech-to-integer conversion
    this.wordToNumMap = {
      'zero': 0, 'one': 1, 'first': 1, '1st': 1,
      'two': 2, 'second': 2, '2nd': 2,
      'three': 3, 'third': 3, '3rd': 3,
      'four': 4, 'fourth': 4, '4th': 4,
      'five': 5, 'fifth': 5, '5th': 5,
      'six': 6, 'sixth': 6, '6th': 6,
      'seven': 7, 'seventh': 7, '7th': 7,
      'eight': 8, 'eighth': 8, '8th': 8,
      'nine': 9, 'ninth': 9, '9th': 9,
      'ten': 10, 'tenth': 10, '10th': 10,
      'eleven': 11, 'eleventh': 11, '11th': 11,
      'twelve': 12, 'twelfth': 12, '12th': 12,
      'thirteen': 13, 'thirteenth': 13,
      'fourteen': 14, 'fourteenth': 14,
      'fifteen': 15, 'fifteenth': 15,
      'sixteen': 16, 'sixteenth': 16,
      'seventeen': 17, 'seventeenth': 17,
      'eighteen': 18, 'eighteenth': 18,
      'nineteen': 19, 'nineteenth': 19,
      'twenty': 20, 'twentieth': 20,
      'thirty': 30, 'thirtieth': 30,
      'forty': 40, 'fourty': 40, 'fortieth': 40,
      'fifty': 50, 'fiftieth': 50,
      'sixty': 60, 'sixtieth': 60,
      'seventy': 70, 'seventieth': 70,
      'eighty': 80, 'eightieth': 80,
      'ninety': 90, 'ninetieth': 90,
      'hundred': 100, 'hundredth': 100
    };

    // Standardized Bible Books Map with all aliases, abbreviations, max chapters, and spoken forms
    this.bibleBooks = [
      { name: 'Genesis', maxChapters: 50, aliases: ['genesis', 'gen', 'ge', 'gn'] },
      { name: 'Exodus', maxChapters: 40, aliases: ['exodus', 'exod', 'exo', 'ex'] },
      { name: 'Leviticus', maxChapters: 27, aliases: ['leviticus', 'lev', 'le', 'lv'] },
      { name: 'Numbers', maxChapters: 36, aliases: ['numbers', 'num', 'nu', 'nm', 'nb'] },
      { name: 'Deuteronomy', maxChapters: 34, aliases: ['deuteronomy', 'deut', 'deu', 'de', 'dt'] },
      { name: 'Joshua', maxChapters: 24, aliases: ['joshua', 'josh', 'jos', 'jsh'] },
      { name: 'Judges', maxChapters: 21, aliases: ['judges', 'judg', 'jdg', 'jgs'] },
      { name: 'Ruth', maxChapters: 4, aliases: ['ruth', 'rth', 'ru'] },
      { name: '1 Samuel', maxChapters: 31, aliases: ['1 samuel', 'first samuel', '1st samuel', '1 sam', '1st sam', '1sa', 'first sam'] },
      { name: '2 Samuel', maxChapters: 24, aliases: ['2 samuel', 'second samuel', '2nd samuel', '2 sam', '2nd sam', '2sa', 'second sam'] },
      { name: '1 Kings', maxChapters: 22, aliases: ['1 kings', 'first kings', '1st kings', '1 kgs', '1st kgs', '1ki', 'first kgs'] },
      { name: '2 Kings', maxChapters: 25, aliases: ['2 kings', 'second kings', '2nd kings', '2 kgs', '2nd kgs', '2ki', 'second kgs'] },
      { name: '1 Chronicles', maxChapters: 29, aliases: ['1 chronicles', 'first chronicles', '1st chronicles', '1 chron', '1st chron', '1ch', '1 chr'] },
      { name: '2 Chronicles', maxChapters: 36, aliases: ['2 chronicles', 'second chronicles', '2nd chronicles', '2 chron', '2nd chron', '2ch', '2 chr'] },
      { name: 'Ezra', maxChapters: 10, aliases: ['ezra', 'ezr'] },
      { name: 'Nehemiah', maxChapters: 13, aliases: ['nehemiah', 'neh', 'ne'] },
      { name: 'Esther', maxChapters: 10, aliases: ['esther', 'esth', 'est'] },
      { name: 'Job', maxChapters: 42, aliases: ['job', 'jb'] },
      { name: 'Psalms', maxChapters: 150, aliases: ['psalms', 'psalm', 'psa', 'ps', 'psm', 'pss'] },
      { name: 'Proverbs', maxChapters: 31, aliases: ['proverbs', 'proverb', 'prov', 'pro', 'prv', 'pr'] },
      { name: 'Ecclesiastes', maxChapters: 12, aliases: ['ecclesiastes', 'eccles', 'ecc', 'ec', 'qoh', 'qoheleth'] },
      { name: 'Song of Solomon', maxChapters: 8, aliases: ['song of solomon', 'song of songs', 'canticle of canticles', 'canticles', 'song'] },
      { name: 'Isaiah', maxChapters: 66, aliases: ['isaiah', 'isa', 'is'] },
      { name: 'Jeremiah', maxChapters: 52, aliases: ['jeremiah', 'jer', 'je', 'jr'] },
      { name: 'Lamentations', maxChapters: 5, aliases: ['lamentations', 'lam', 'la'] },
      { name: 'Ezekiel', maxChapters: 48, aliases: ['ezekiel', 'ezek', 'eze', 'ezk'] },
      { name: 'Daniel', maxChapters: 12, aliases: ['daniel', 'dan', 'da', 'dn'] },
      { name: 'Hosea', maxChapters: 14, aliases: ['hosea', 'hos', 'ho'] },
      { name: 'Joel', maxChapters: 3, aliases: ['joel', 'joe', 'jl'] },
      { name: 'Amos', maxChapters: 9, aliases: ['amos', 'am'] },
      { name: 'Obadiah', maxChapters: 1, aliases: ['obadiah', 'obad', 'ob'] },
      { name: 'Jonah', maxChapters: 4, aliases: ['jonah', 'jnh', 'jon'] },
      { name: 'Micah', maxChapters: 7, aliases: ['micah', 'mic', 'mc'] },
      { name: 'Nahum', maxChapters: 3, aliases: ['nahum', 'nah', 'na'] },
      { name: 'Habakkuk', maxChapters: 3, aliases: ['habakkuk', 'hab', 'hb'] },
      { name: 'Zephaniah', maxChapters: 3, aliases: ['zephaniah', 'zeph', 'zep', 'zp'] },
      { name: 'Haggai', maxChapters: 2, aliases: ['haggai', 'hag', 'hg'] },
      { name: 'Zechariah', maxChapters: 14, aliases: ['zechariah', 'zech', 'zec', 'zc'] },
      { name: 'Malachi', maxChapters: 4, aliases: ['malachi', 'mal', 'ml'] },
      { name: 'Matthew', maxChapters: 28, aliases: ['matthew', 'matt', 'mat', 'mt'] },
      { name: 'Mark', maxChapters: 16, aliases: ['mark', 'mrk', 'mar', 'mk', 'mr'] },
      { name: 'Luke', maxChapters: 24, aliases: ['luke', 'luk', 'lu', 'lk'] },
      { name: 'John', maxChapters: 21, aliases: ['john', 'jhn', 'joh', 'jn'] },
      { name: 'Acts', maxChapters: 28, aliases: ['acts', 'act', 'ac', 'acts of the apostles'] },
      { name: 'Romans', maxChapters: 16, aliases: ['romans', 'roman', 'rom', 'ro', 'rm'] },
      { name: '1 Corinthians', maxChapters: 16, aliases: ['1 corinthians', 'first corinthians', '1st corinthians', '1 cor', '1st cor', '1co', 'first cor'] },
      { name: '2 Corinthians', maxChapters: 13, aliases: ['2 corinthians', 'second corinthians', '2nd corinthians', '2 cor', '2nd cor', '2co', 'second cor'] },
      { name: 'Galatians', maxChapters: 6, aliases: ['galatians', 'galatian', 'gal', 'ga'] },
      { name: 'Ephesians', maxChapters: 6, aliases: ['ephesians', 'ephesian', 'eph', 'ep'] },
      { name: 'Philippians', maxChapters: 4, aliases: ['philippians', 'philippian', 'phil', 'php', 'pp'] },
      { name: 'Colossians', maxChapters: 4, aliases: ['colossians', 'colossian', 'col', 'co'] },
      { name: '1 Thessalonians', maxChapters: 5, aliases: ['1 thessalonians', 'first thessalonians', '1st thessalonians', '1 thess', '1st thess', '1th', 'first thess'] },
      { name: '2 Thessalonians', maxChapters: 3, aliases: ['2 thessalonians', 'second thessalonians', '2nd thessalonians', '2 thess', '2nd thess', '2th', 'second thess'] },
      { name: '1 Timothy', maxChapters: 6, aliases: ['1 timothy', 'first timothy', '1st timothy', '1 tim', '1st tim', '1ti', 'first tim'] },
      { name: '2 Timothy', maxChapters: 4, aliases: ['2 timothy', 'second timothy', '2nd timothy', '2 tim', '2nd tim', '2ti', 'second tim'] },
      { name: 'Titus', maxChapters: 3, aliases: ['titus', 'tit', 'ti'] },
      { name: 'Philemon', maxChapters: 1, aliases: ['philemon', 'phlm', 'phm', 'pm'] },
      { name: 'Hebrews', maxChapters: 13, aliases: ['hebrews', 'hebrew', 'heb', 'he'] },
      { name: 'James', maxChapters: 5, aliases: ['james', 'jas', 'jm'] },
      { name: '1 Peter', maxChapters: 5, aliases: ['1 peter', 'first peter', '1st peter', '1 pet', '1st pet', '1pe', '1pt', 'first pet'] },
      { name: '2 Peter', maxChapters: 3, aliases: ['2 peter', 'second peter', '2nd peter', '2 pet', '2nd pet', '2pe', '2pt', 'second pet'] },
      { name: '1 John', maxChapters: 5, aliases: ['1 john', 'first john', '1st john', '1 jn', '1st jn', '1jhn', '1jo', 'first jn'] },
      { name: '2 John', maxChapters: 1, aliases: ['2 john', 'second john', '2nd john', '2 jn', '2nd jn', '2jhn', '2jo', 'second jn'] },
      { name: '3 John', maxChapters: 1, aliases: ['3 john', 'third john', '3rd john', '3 jn', '3rd jn', '3jhn', '3jo', 'third jn'] },
      { name: 'Jude', maxChapters: 1, aliases: ['jude', 'jud', 'jd'] },
      { name: 'Revelation', maxChapters: 22, aliases: ['revelation', 'revelations', 'rev', 're', 'the revelation'] }
    ];

    // Semantic AI Paraphrase Knowledge Base
    this.paraphraseDatabase = [
      {
        keywords: ['god so loved the world', 'gave his only begotten son', 'whosoever believeth in him', 'everlasting life'],
        reference: 'John 3:16',
        text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.'
      },
      {
        keywords: ['lord is my shepherd', 'i shall not want', 'still waters', 'green pastures', 'leadeth me beside'],
        reference: 'Psalms 23:1',
        text: 'The LORD is my shepherd; I shall not want. He maketh me to lie down in green pastures: he leadeth me beside the still waters.'
      },
      {
        keywords: ['valley of the shadow of death', 'fear no evil', 'thy rod and thy staff', 'thou art with me'],
        reference: 'Psalms 23:4',
        text: 'Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me.'
      },
      {
        keywords: ['in the beginning was the word', 'word was with god', 'word was god'],
        reference: 'John 1:1',
        text: 'In the beginning was the Word, and the Word was with God, and the Word was God.'
      },
      {
        keywords: ['i am the way', 'the truth and the life', 'no man cometh unto the father'],
        reference: 'John 14:6',
        text: 'Jesus saith unto him, I am the way, the truth, and the life: no man cometh unto the Father, but by me.'
      },
      {
        keywords: ['all things work together for good', 'called according to his purpose', 'them that love god'],
        reference: 'Romans 8:28',
        text: 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.'
      },
      {
        keywords: ['if god be for us', 'who can be against us', 'what shall we say to these things'],
        reference: 'Romans 8:31',
        text: 'What shall we then say to these things? If God be for us, who can be against us?'
      },
      {
        keywords: ['i can do all things', 'through christ which strengtheneth me', 'christ who strengthens me'],
        reference: 'Philippians 4:13',
        text: 'I can do all things through Christ which strengtheneth me.'
      },
      {
        keywords: ['trust in the lord with all thine heart', 'lean not unto thine own understanding', 'acknowledge him'],
        reference: 'Proverbs 3:5',
        text: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.'
      },
      {
        keywords: ['faith is the substance', 'things hoped for', 'evidence of things not seen'],
        reference: 'Hebrews 11:1',
        text: 'Now faith is the substance of things hoped for, the evidence of things not seen.'
      },
      {
        keywords: ['be strong and of a good courage', 'be not afraid neither be thou dismayed', 'lord thy god is with thee'],
        reference: 'Joshua 1:9',
        text: 'Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.'
      },
      {
        keywords: ['they that wait upon the lord', 'renew their strength', 'mount up with wings as eagles', 'run and not be weary'],
        reference: 'Isaiah 40:31',
        text: 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.'
      },
      {
        keywords: ['nicodemus', 'born again', 'enter the second time', 'born of water and spirit'],
        reference: 'John 3:3',
        text: 'Jesus answered and said unto him, Verily, verily, I say unto thee, Except a man be born again, he cannot see the kingdom of God.'
      },
      {
        keywords: ['charity suffereth long', 'is kind', 'envieth not', 'love never fails'],
        reference: '1 Corinthians 13:4',
        text: 'Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up,'
      },
      {
        keywords: ['light of the world', 'city on a hill', 'cannot be hid'],
        reference: 'Matthew 5:14',
        text: 'Ye are the light of the world. A city that is set on an hill cannot be hid.'
      },
      {
        keywords: ['wipe away all tears', 'no more death', 'neither sorrow nor crying'],
        reference: 'Revelation 21:4',
        text: 'And God shall wipe away all tears from their eyes; and there shall be no more death, neither sorrow, nor crying, neither shall there be any more pain.'
      },
      {
        keywords: ['all glory to jesus', 'all glory to god', 'glory and honour and power', 'thou art worthy o lord', 'created all things'],
        reference: 'Revelation 4:11',
        text: 'Thou art worthy, O Lord, to receive glory and honour and power: for thou hast created all things, and for thy pleasure they are and were created.'
      },
      {
        keywords: ['by his stripes we are healed', 'wounded for our transgressions', 'bruised for our iniquities', 'chastisement of our peace'],
        reference: 'Isaiah 53:5',
        text: 'But he was wounded for our transgressions, he was bruised for our iniquities: the chastisement of our peace was upon him; and with his stripes we are healed.'
      },
      {
        keywords: ['no weapon formed against you shall prosper', 'no weapon formed against thee shall prosper', 'heritage of the servants of the lord'],
        reference: 'Isaiah 54:17',
        text: 'No weapon that is formed against thee shall prosper; and every tongue that shall rise against thee in judgment thou shalt condemn.'
      },
      {
        keywords: ['seek ye first the kingdom of god', 'and his righteousness', 'all these things shall be added'],
        reference: 'Matthew 6:33',
        text: 'But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you.'
      },
      {
        keywords: ['god hath not given us the spirit of fear', 'spirit of fear', 'power and of love and of a sound mind'],
        reference: '2 Timothy 1:7',
        text: 'For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.'
      },
      {
        keywords: ['the lord is my light and my salvation', 'whom shall i fear', 'strength of my life'],
        reference: 'Psalms 27:1',
        text: 'The LORD is my light and my salvation; whom shall I fear? the LORD is the strength of my life; of whom shall I be afraid?'
      },
      {
        keywords: ['thoughts of peace and not of evil', 'to give you an expected end', 'i know the thoughts that i think toward you'],
        reference: 'Jeremiah 29:11',
        text: 'For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.'
      },
      {
        keywords: ['ask and it shall be given you', 'seek and ye shall find', 'knock and it shall be opened'],
        reference: 'Matthew 7:7',
        text: 'Ask, and it shall be given you; seek, and ye shall find; knock, and it shall be opened unto you:'
      },
      {
        keywords: ['come unto me all ye that labour', 'heavy laden', 'i will give you rest'],
        reference: 'Matthew 11:28',
        text: 'Come unto me, all ye that labour and are heavy laden, and I will give you rest.'
      },
      {
        keywords: ['great is thy faithfulness', 'mercies of the lord', 'they are new every morning'],
        reference: 'Lamentations 3:22-23',
        text: 'It is of the LORD\'s mercies that we are not consumed, because his compassions fail not. They are new every morning: great is thy faithfulness.'
      },
      {
        keywords: ['name of the lord is a strong tower', 'righteous runneth into it and is safe', 'strong tower'],
        reference: 'Proverbs 18:10',
        text: 'The name of the LORD is a strong tower: the righteous runneth into it, and is safe.'
      }
    ];

    this.initNativeSpeech();
  }

  initNativeSpeech() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Web Speech API is not supported in this browser. Deepgram Live Streaming and Simulation mode remain available.');
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
      this.hasSelectedAudioEnergy = false;

      this.recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const isFinal = Boolean(finalTranscript && finalTranscript.trim());
        const fullText = (finalTranscript || interimTranscript || '').trim();
        if (fullText && (fullText !== this.lastProcessedText || isFinal)) {
          this.lastProcessedText = fullText;
          this.processSpokenText(fullText, isFinal);
        }
      };

      this.recognition.onerror = (event) => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          console.warn('Microphone permission denied.');
          this.isListening = false;
          const transcriptBox = document.getElementById('ai-transcript-text');
          if (transcriptBox) transcriptBox.textContent = 'Mic access blocked. Please click the mic/lock icon in your browser address bar to allow microphone access.';
          if (typeof showToast === 'function') showToast('Microphone permission blocked. Please allow mic access.', 'error');
          const btn = document.getElementById('ai-mic-btn');
          if (btn) {
            btn.classList.remove('active');
            const span = btn.querySelector('span:not(.ai-dot)');
            if (span) span.textContent = 'AI Mic: Off';
            const dot = btn.querySelector('.ai-dot');
            if (dot) dot.style.background = '#EF4444';
          }
        } else if (event.error !== 'no-speech') {
          console.warn('Speech recognition error:', event.error);
        }
      };

      this.recognition.onend = () => {
        if (this.isListening && this.provider === 'native') {
          clearTimeout(this.restartTimer);
          this.restartTimer = setTimeout(() => {
            if (this.isListening && this.provider === 'native') {
              try { this.recognition.start(); } catch (e) {}
            }
          }, 300);
        }
      };
    } catch (err) {
      console.warn('Could not initialize SpeechRecognition', err);
    }
  }

  // ── Start Audio & Recognition Engine (Provider Dispatched) ───────────────────
  start() {
    this.isListening = true;
    const provider = this.provider || (typeof localStorage !== 'undefined' && localStorage.getItem('sf_ai_provider')) || 'deepgram';

    if (provider === 'deepgram') {
      this.startDeepgram();
    } else {
      this.startNative();
    }
  }

  // ── Stop Audio & Recognition Engine ──────────────────────────────────────────
  stop() {
    this.isListening = false;
    clearTimeout(this.restartTimer);
    this.stopDeepgram();
    this.stopNative();
  }

  // ── Native Speech Start/Stop ────────────────────────────────────────────────
  startNative() {
    if (this.recognition) {
      try { 
        this.recognition.start(); 
      } catch (e) {
        // Recognition might already be running
      }
    }
  }

  stopNative() {
    if (this.recognition) {
      try { this.recognition.stop(); } catch (e) {}
    }
  }

  // ── Deepgram Live Streaming WebSocket Pipeline ──────────────────────────────
  async startDeepgram() {
    const apiKey = this.deepgramApiKey || (typeof localStorage !== 'undefined' && localStorage.getItem('sf_deepgram_api_key')) || '';
    if (!apiKey) {
      this.isListening = false;
      if (typeof showToast === 'function') {
        showToast('Deepgram API Key is required. Please configure in Settings.', 'warning');
      }
      const transcriptBox = document.getElementById('ai-transcript-text');
      if (transcriptBox) {
        transcriptBox.textContent = 'Deepgram API Key required. Open Studio Preferences → AI Speech Engine.';
      }
      if (typeof window.openAiSettingsTab === 'function') {
        window.openAiSettingsTab();
      }
      return;
    }

    try {
      // 1. Capture Microphone Stream with Selected Hardware Device
      const targetDeviceId = this.selectedDeviceId || (typeof localStorage !== 'undefined' && localStorage.getItem('sf_selected_mic_device')) || 'default';
      this.selectedDeviceId = targetDeviceId;

      const audioConstraints = {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: true
      };
      if (targetDeviceId && targetDeviceId !== 'default') {
        audioConstraints.deviceId = { ideal: targetDeviceId };
      }

      try {
        this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      } catch (devErr) {
        console.warn('Could not capture audio with ideal deviceId, falling back to default input stream:', devErr);
        this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      // 1b. Create Web Audio Downmixer: Mixes multi-channel USB soundboard inputs (Channel 1 Left + Channel 2 Right)
      // This guarantees that whether the church soundboard is plugged into Left, Right, or Stereo, Deepgram hears it loud and clear.
      let streamToSend = this.audioStream;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.audioProcessingContext = new AudioCtx();
          if (this.audioProcessingContext.state === 'suspended') {
            await this.audioProcessingContext.resume();
          }
          const srcNode = this.audioProcessingContext.createMediaStreamSource(this.audioStream);
          const destNode = this.audioProcessingContext.createMediaStreamDestination();
          srcNode.connect(destNode);
          if (destNode.stream && destNode.stream.getAudioTracks().length > 0) {
            this.processedAudioStream = destNode.stream;
            streamToSend = this.processedAudioStream;
          }
        }
      } catch (audioMixErr) {
        console.warn('Web Audio downmix pass-through, using direct hardware stream:', audioMixErr);
        streamToSend = this.audioStream;
      }

      // 2. Build Deepgram Live WebSocket Endpoint with Church Keywords
      const model = this.deepgramModel || (typeof localStorage !== 'undefined' && localStorage.getItem('sf_deepgram_model')) || 'nova-2';
      const params = new URLSearchParams({
        model: model,
        smart_format: 'true',
        punctuate: 'true',
        interim_results: 'true',
        endpointing: '300',
        language: 'en'
      });

      // Pass Bible Books to Deepgram Keywords Booster
      if (this.bibleBooks && Array.isArray(this.bibleBooks)) {
        this.bibleBooks.forEach(b => {
          params.append('keywords', `${b.name}:2`);
        });
      }

      // Pass Custom Church Terms to Deepgram Keywords Booster
      const termsStr = this.churchCustomTerms || (typeof localStorage !== 'undefined' && localStorage.getItem('sf_church_custom_terms')) || '';
      if (termsStr) {
        const customList = termsStr.split(',').map(t => t.trim()).filter(Boolean);
        customList.forEach(t => params.append('keywords', `${t}:2`));
      }

      // Pass Active Service Agenda Songs to Deepgram Keywords Booster (Highest Weight :3)
      const agendaSongs = (typeof state !== 'undefined' && Array.isArray(state.agendaItems))
        ? state.agendaItems.filter(i => i.type === 'song' || i.songId)
        : [];
      agendaSongs.slice(0, 15).forEach(s => {
        if (s.title) params.append('keywords', `${s.title}:3`);
      });

      // Pass Top Active Church Song Titles to Deepgram Keywords Booster (:2)
      if (typeof SONGS_DATABASE !== 'undefined' && Array.isArray(SONGS_DATABASE)) {
        SONGS_DATABASE.slice(0, 30).forEach(s => {
          if (s.title) params.append('keywords', `${s.title}:2`);
        });
      }

      const wsUrl = `wss://api.deepgram.com/v1/listen?${params.toString()}`;
      this.deepgramSocket = new WebSocket(wsUrl, ['token', apiKey]);

      const transcriptBox = document.getElementById('ai-transcript-text');
      if (transcriptBox) {
        transcriptBox.textContent = `Connecting to Deepgram Live (${model})...`;
      }

      this.deepgramSocket.onopen = () => {
        if (!this.isListening) {
          this.stopDeepgram();
          return;
        }

        if (transcriptBox) {
          transcriptBox.textContent = `Listening with Deepgram (${model})... Speak scripture or sing lyrics.`;
        }

        // Determine best supported MediaRecorder mimeType
        let mimeType = 'audio/webm';
        if (typeof MediaRecorder !== 'undefined') {
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            mimeType = 'audio/webm;codecs=opus';
          } else if (MediaRecorder.isTypeSupported('audio/webm')) {
            mimeType = 'audio/webm';
          } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
            mimeType = 'audio/ogg;codecs=opus';
          }
        }

        try {
          this.mediaRecorder = new MediaRecorder(streamToSend, { mimeType: mimeType });
          this.mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0 && this.deepgramSocket && this.deepgramSocket.readyState === WebSocket.OPEN) {
              this.deepgramSocket.send(event.data);
            }
          };
          this.mediaRecorder.start(250); // Stream 250ms chunks for sub-second live STT
        } catch (recErr) {
          console.warn('Could not start MediaRecorder for Deepgram', recErr);
        }
      };

      this.deepgramSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const transcript = data.channel?.alternatives?.[0]?.transcript || '';
          const isFinal = Boolean(data.is_final || data.speech_final);
          if (transcript && transcript.trim()) {
            const cleanText = transcript.trim();
            if (cleanText !== this.lastProcessedText || isFinal) {
              this.lastProcessedText = cleanText;
              this.processSpokenText(cleanText, isFinal);
            }
          }
        } catch (parseErr) {
          console.warn('Deepgram message parse error', parseErr);
        }
      };

      this.deepgramSocket.onerror = (errEvent) => {
        console.warn('Deepgram WebSocket error:', errEvent);
        if (transcriptBox && this.isListening) {
          transcriptBox.textContent = 'Deepgram Connection Error. Please verify your API Key in Studio Preferences.';
        }
        if (typeof showToast === 'function') {
          showToast('Deepgram streaming connection error. Check API key and internet.', 'error');
        }
      };

      this.deepgramSocket.onclose = () => {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
          try { this.mediaRecorder.stop(); } catch(e) {}
        }
      };

    } catch (micErr) {
      console.warn('Microphone stream error for Deepgram:', micErr);
      this.isListening = false;
      if (typeof showToast === 'function') {
        showToast(`Could not access microphone: ${micErr.message}`, 'error');
      }
      const transcriptBox = document.getElementById('ai-transcript-text');
      if (transcriptBox) {
        transcriptBox.textContent = 'Microphone access failed. Please check device permissions.';
      }
    }
  }

  stopDeepgram() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try { this.mediaRecorder.stop(); } catch (e) {}
    }
    this.mediaRecorder = null;

    if (this.deepgramSocket) {
      try {
        if (this.deepgramSocket.readyState === WebSocket.OPEN) {
          this.deepgramSocket.send(JSON.stringify({ type: 'CloseStream' }));
        }
        this.deepgramSocket.close();
      } catch (e) {}
    }
    this.deepgramSocket = null;

    if (this.audioProcessingContext) {
      try { this.audioProcessingContext.close(); } catch(e) {}
      this.audioProcessingContext = null;
    }

    if (this.processedAudioStream) {
      try {
        this.processedAudioStream.getTracks().forEach(track => track.stop());
      } catch (e) {}
      this.processedAudioStream = null;
    }

    if (this.audioStream) {
      try {
        this.audioStream.getTracks().forEach(track => track.stop());
      } catch (e) {}
      this.audioStream = null;
    }
  }

  setAudioDeviceId(deviceId) {
    this.selectedDeviceId = deviceId;
    if (this.isListening) {
      this.stop();
      setTimeout(() => this.start(), 300);
    }
  }

  setAudioActivity(isActive) {
    this.hasSelectedAudioEnergy = !!isActive;
  }

  setProviderConfig(cfg = {}) {
    if (cfg.provider) this.provider = cfg.provider;
    if (cfg.deepgramApiKey !== undefined) this.deepgramApiKey = cfg.deepgramApiKey;
    if (cfg.deepgramModel) this.deepgramModel = cfg.deepgramModel;
    if (cfg.churchCustomTerms !== undefined) this.churchCustomTerms = cfg.churchCustomTerms;
    if (cfg.selectedDeviceId !== undefined) this.selectedDeviceId = cfg.selectedDeviceId;
  }

  toggle() {
    if (this.isListening) {
      this.stop();
    } else {
      this.start();
    }
    return this.isListening;
  }

  // Process live or simulated speech text through all detection pipelines
  processSpokenText(text, isFinal = false) {
    if (!text || typeof text !== 'string') return;
    const cleanText = text.trim();
    if (!cleanText) return;

    if (this.onTranscript) {
      this.onTranscript(cleanText, isFinal);
    }

    // 1. Bible Reference & Quote Detection
    this.parseScriptureReferences(cleanText);

    // 2. Song Title & Lyrics Matching (Worldwide Church Adaptive Index)
    this.parseSongLyrics(cleanText);

    // 3. Semantic Paraphrases
    this.parseSemanticParaphrases(cleanText);
  }

  // Simulation harness for testing from dashboard UI or scripts
  simulateTranscript(text) {
    this.processSpokenText(text, true);
  }

  // Helper: Normalize speech text converting word numbers into digit integers
  normalizeSpokenNumbers(text) {
    if (!text) return '';
    let lower = text.toLowerCase().replace(/[-_]/g, ' ');

    // Normalize ordinal prefixes e.g. "1 st" -> "1st", "2 nd" -> "2nd"
    lower = lower.replace(/\b(1|2|3)\s*(st|nd|rd|th)\b/g, '$1$2');

    // Replace composite number words like "twenty three" -> "23", "one hundred nineteen" -> "119"
    const tokens = lower.split(/\s+/);
    const resultTokens = [];
    let i = 0;

    while (i < tokens.length) {
      const token = tokens[i];

      if (this.wordToNumMap[token] !== undefined) {
        let val = this.wordToNumMap[token];

        if (i + 1 < tokens.length) {
          const next = tokens[i + 1];
          if (val >= 20 && val < 100 && this.wordToNumMap[next] !== undefined && this.wordToNumMap[next] < 10) {
            val += this.wordToNumMap[next];
            i++;
          } else if (val < 10 && (next === 'hundred' || next === 'hundreds')) {
            val = val * 100;
            i++;
            if (i + 1 < tokens.length && tokens[i + 1] === 'and') {
              i++;
            }
            if (i + 1 < tokens.length && this.wordToNumMap[tokens[i + 1]] !== undefined) {
              val += this.wordToNumMap[tokens[i + 1]];
              i++;
              if (i + 1 < tokens.length && this.wordToNumMap[tokens[i + 1]] !== undefined && this.wordToNumMap[tokens[i + 1]] < 10) {
                val += this.wordToNumMap[tokens[i + 1]];
                i++;
              }
            }
          }
        }
        resultTokens.push(val.toString());
      } else {
        resultTokens.push(token);
      }
      i++;
    }

    return resultTokens.join(' ');
  }

  // Bible Reference Recognition
  parseScriptureReferences(text) {
    if (!text) return;
    const normalized = this.normalizeSpokenNumbers(text);

    // Common spoken cues to clean out: "turn with me to", "book of", "let's read from", "open your bible to"
    const cleaned = normalized.replace(/\b(turn to|turn with me to|open to|open your bibles? to|let us read|reading from|the book of|look at|in the scripture|in the book of)\b/gi, ' ');

    // Detect spoken Bible translation indicator if present (e.g. "in the NIV", "KJV", "NLT", "NKJV", "ESV")
    let detectedVersion = null;
    const versionMatch = cleaned.match(/\b(in the\s+)?(kjv|niv|nkjv|nlt|esv|nasb|amp|msg|asv)\b/i);
    if (versionMatch && versionMatch[2]) {
      detectedVersion = versionMatch[2].toUpperCase();
    }

    for (const b of this.bibleBooks) {
      for (const alias of b.aliases) {
        const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(
          `\\b${escapedAlias}\\b(?:\\s*(?:chapter|chap|ch)?\\s*(\\d+))?(?:(?:\\s*(?:verses?|vs?|from verse|:)|\\s+)\\s*(\\d+)(?:\\s*(?:to|-|through|and|until)\\s*(\\d+))?)?`,
          'i'
        );

        const match = cleaned.match(pattern);
        if (match && (match[1] || match[2])) {
          const rawBook = b.name;
          const maxCh = b.maxChapters || 150;
          let chapter = match[1] ? parseInt(match[1], 10) : 1;
          let verse = match[2] ? parseInt(match[2], 10) : 1;
          const endVerse = match[3] ? parseInt(match[3], 10) : null;

          if (maxCh === 1) {
            if (!match[2] && match[1]) {
              verse = chapter;
              chapter = 1;
            } else if (!match[1] && match[2]) {
              chapter = 1;
              verse = parseInt(match[2], 10);
            } else if (chapter === 1) {
              verse = match[2] ? parseInt(match[2], 10) : 1;
            } else {
              continue;
            }
          }

          if (chapter < 1 || chapter > maxCh) continue;
          if (verse < 1 || verse > 176) continue;
          if (endVerse && (endVerse <= verse || endVerse > 176)) continue;

          let rawRef = `${rawBook} ${chapter}:${verse}`;
          if (endVerse && endVerse > verse) {
            rawRef = `${rawBook} ${chapter}:${verse}-${endVerse}`;
          }

          let confidence = 85;
          if (match[1] && match[2]) confidence = 98;
          else if (match[1]) confidence = 90;

          if (this.onVerseDetected) {
            this.onVerseDetected({
              book: rawBook,
              chapter: chapter,
              verse: verse,
              endVerse: endVerse,
              rawReference: rawRef,
              confidence: confidence,
              version: detectedVersion,
              matchedQuery: match[0],
              timestamp: Date.now()
            });
          }
          return;
        }
      }
    }
  }

  // ── Song Titles, Lyrics, & Stanzas Auto-Detection (Worldwide Adaptive Index) ────
  parseSongLyrics(text) {
    if (!text || typeof text !== 'string') return;

    const cleanInput = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleanInput.length < 5) return;

    // Filter out filler words for density calculation
    const musicalFillers = new Set(['oh', 'yeah', 'woah', 'amen', 'hallelujah', 'we', 'you', 'and', 'the', 'is', 'are', 'in', 'of', 'to', 'for']);
    const inputWords = cleanInput.split(' ').filter(w => w.length > 2);
    const meaningfulInputWords = inputWords.filter(w => !musicalFillers.has(w));
    if (inputWords.length === 0) return;

    // Collect active Agenda song IDs for priority weighting
    const agendaSongIds = new Set();
    if (typeof state !== 'undefined' && Array.isArray(state.agendaItems)) {
      state.agendaItems.forEach(item => {
        if (item.songId) agendaSongIds.add(item.songId);
      });
    }

    let bestMatch = null;
    let highestScore = 0;

    const songsList = (typeof SONGS_DATABASE !== 'undefined' && Array.isArray(SONGS_DATABASE)) ? SONGS_DATABASE : [];

    for (let sIdx = 0; sIdx < songsList.length; sIdx++) {
      const song = songsList[sIdx];
      if (!song || !song.title) continue;

      const isAgenda = agendaSongIds.has(song.id);
      const agendaBoost = isAgenda ? 15 : 0;

      if (!song._cleanTitle) {
        song._cleanTitle = song.title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
      }
      const songTitle = song._cleanTitle;

      // 1. Direct Title Match Check
      if (cleanInput.includes(songTitle) || (songTitle.length > 5 && songTitle.includes(cleanInput))) {
        const firstStanza = song.stanzas && song.stanzas.length > 0 ? song.stanzas[0] : null;
        const score = Math.min(99, 94 + agendaBoost);
        if (score > highestScore) {
          highestScore = score;
          bestMatch = {
            songId: song.id,
            title: song.title,
            author: song.author || '',
            songbook: song.songbook || 'Library',
            stanzaIndex: 0,
            stanzaType: firstStanza ? (firstStanza.type || 'Verse 1') : 'Verse 1',
            fullStanzaText: firstStanza ? firstStanza.text : '',
            matchedSnippet: `Matched Title: "${song.title}"`,
            confidence: score,
            isAgenda: isAgenda
          };
        }
      }

      // 2. Fast Stanza & Lyric Lines Matching (N-Gram & Line Substrings)
      if (song.stanzas && Array.isArray(song.stanzas)) {
        for (let stIdx = 0; stIdx < song.stanzas.length; stIdx++) {
          const stanza = song.stanzas[stIdx];
          if (!stanza || !stanza.text) continue;

          if (!stanza._clean) {
            stanza._clean = stanza.text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ');
            stanza._words = stanza._clean.split(' ').filter(w => w.length > 2);
            stanza._lines = stanza.text.split('\n').map(l => l.trim()).filter(Boolean);
            stanza._cleanLines = stanza._lines.map(l => l.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim());
          }

          // Exact line or large substring match
          let lineMatched = false;
          for (let lIdx = 0; lIdx < stanza._cleanLines.length; lIdx++) {
            const cl = stanza._cleanLines[lIdx];
            if (cl.length >= 8 && (cleanInput.includes(cl) || cl.includes(cleanInput))) {
              const score = Math.min(99, 95 + agendaBoost);
              if (score > highestScore) {
                highestScore = score;
                bestMatch = {
                  songId: song.id,
                  title: song.title,
                  author: song.author || '',
                  songbook: song.songbook || 'Library',
                  stanzaIndex: stIdx,
                  stanzaType: stanza.type || `Verse ${stIdx + 1}`,
                  fullStanzaText: stanza.text,
                  matchedSnippet: stanza._lines[lIdx] || stanza.text.slice(0, 40),
                  confidence: score,
                  isAgenda: isAgenda
                };
              }
              lineMatched = true;
              break;
            }
          }

          if (!lineMatched) {
            // Token overlap ratio on meaningful words
            let matchedCount = 0;
            const stanzaWords = stanza._words;
            for (let wIdx = 0; wIdx < meaningfulInputWords.length; wIdx++) {
              if (stanzaWords.includes(meaningfulInputWords[wIdx])) matchedCount++;
            }

            const minWordsNeeded = Math.min(3, meaningfulInputWords.length);
            const ratio = meaningfulInputWords.length > 0 ? (matchedCount / meaningfulInputWords.length) : 0;

            if (matchedCount >= minWordsNeeded && ratio >= 0.4) {
              const score = Math.min(99, Math.round(55 + (ratio * 35) + (matchedCount * 3) + agendaBoost));
              if (score > highestScore) {
                highestScore = score;
                bestMatch = {
                  songId: song.id,
                  title: song.title,
                  author: song.author || '',
                  songbook: song.songbook || 'Library',
                  stanzaIndex: stIdx,
                  stanzaType: stanza.type || `Verse ${stIdx + 1}`,
                  fullStanzaText: stanza.text,
                  matchedSnippet: stanza._lines[0] || stanza.text.slice(0, 40),
                  confidence: score,
                  isAgenda: isAgenda
                };
              }
            }
          }
        }
      }
    }

    if (bestMatch && highestScore >= 55) {
      if (this.onSongDetected) {
        this.onSongDetected({
          ...bestMatch,
          timestamp: Date.now()
        });
      }
      return;
    }

    // 3. Uncataloged Spontaneous Worship Song Detector
    // If no song in the local library matched, but strong worship cues were sung
    const worshipKeywords = ['hallelujah', 'glory', 'jesus', 'lord', 'god', 'worship', 'praise', 'holy', 'reign', 'savior', 'grace', 'worthy', 'majesty', 'mercy', 'hosanna', 'king', 'almighty'];
    const hasWorshipCue = meaningfulInputWords.some(w => worshipKeywords.includes(w));
    if (meaningfulInputWords.length >= 4 && hasWorshipCue) {
      if (this.onSongDetected) {
        this.onSongDetected({
          songId: null,
          title: 'Uncataloged Worship Song',
          author: 'Spontaneous / Online',
          songbook: 'Search',
          stanzaIndex: 0,
          stanzaType: 'Spoken / Sung Phrase',
          fullStanzaText: text,
          matchedSnippet: `"${text}"`,
          confidence: 60,
          isUncataloged: true,
          query: text,
          timestamp: Date.now()
        });
      }
    }
  }

  // Fuzzy phrase word-overlap calculation
  fuzzyPhraseOverlap(inputPhrase, targetPhrase) {
    if (!inputPhrase || !targetPhrase) return 0;
    const inputWords = inputPhrase.split(' ').filter(w => w.length > 2);
    const targetWords = targetPhrase.split(' ').filter(w => w.length > 2);
    if (inputWords.length === 0 || targetWords.length === 0) return 0;

    let matchCount = 0;
    for (const word of targetWords) {
      if (inputWords.includes(word)) {
        matchCount++;
      }
    }

    return matchCount / Math.min(inputWords.length, targetWords.length);
  }

  // Parse semantic paraphrases and famous bible quotes
  parseSemanticParaphrases(text) {
    if (!text) return;
    const lower = text.toLowerCase();

    for (const item of this.paraphraseDatabase) {
      const matchCount = item.keywords.filter(kw => lower.includes(kw.toLowerCase())).length;
      if (matchCount > 0) {
        const confidence = Math.min(99, 70 + (matchCount * 10));
        if (this.onParaphraseDetected) {
          this.onParaphraseDetected({
            reference: item.reference,
            text: item.text,
            matchScore: matchCount,
            confidence: confidence,
            timestamp: Date.now()
          });
        }
      }
    }
  }
}

window.SpeechAiEngine = SpeechAiEngine;
