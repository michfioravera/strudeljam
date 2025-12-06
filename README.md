# Documentazione

**StrudelJam** è un sequencer musicale step-based costruito con React, TypeScript e Tone.js, ispirato alla sintassi di [Strudel](https://strudel.cc/).

## Caratteristiche Principali

- **Sequencer Multi-Traccia**: Supporta fino a 32 step per traccia
- **17 Strumenti**: Batteria, sintetizzatori e generatori di rumore
- **Effetti Audio**: Delay, Reverb, Distortion, Pan
- **Modalità Playback**: Riproduzione singola o sequenziale di tutte le sequenze
- **Codice Strudel**: Generazione e parsing bidirezionale del codice
- **Recording**: Registra le tue sessioni in formato WebM

## Architettura

### Componenti principali

- **App.tsx**: Componente principale che gestisce lo stato globale
- **TrackList**: Visualizzazione e controllo delle tracce
- **SequenceList**: Gestione delle sequenze multiple
- **ErrorBoundary**: Gestione degli errori React

### Motore audio

- **audio-engine.ts**: Motore audio ibrido basato su Tone.js
  - Gestione polyphony intelligente
  - Hot-swapping delle Parts durante playback
  - Gain limiting automatico per prevenire clipping

### Funzioni Hook

- **useAudioEngine**: Hook per interfacciarsi con l'audio engine
- **useClickOutside**: Gestione click fuori dai popup
- **useDeepCompareMemo**: Memorizzazione con confronto profondo

### Utilità

- **strudel-gen.ts**: Generazione e parsing del codice Strudel
- **constants.ts**: Configurazioni e tipi globali
- **id.ts**: Generazione ID univoci

## Installazione

```bash
# Installa dipendenze
npm install

# Avvia dev server (con generazione docs)
npm run dev

# Avvia dev server (senza docs)
npm run dev:no-docs

# Genera solo la documentazione
npm run docs

# Watch mode per docs
npm run docs:watch

# Build per produzione
npm run build
```

## Sintassi Codice Strudel

Il codice generato segue questo formato:

```
// StrudelJam v3.0 - Codice Generato
// BPM: 120

setcps(0.5000)

// Traccia 1: Kick
note("C2 ~ ~ ~ C2 ~ ~ ~")
  .sound("bd")
  .gain(0.80)

// Traccia 2: Snare
note("~ ~ D2 ~ ~ ~ D2 ~")
  .sound("sd")
  .gain(0.70)
  .delay(0.20)
  .room(0.30)
```

### Parametri Supportati

- **note()**: Pattern di note (usa `~` per pause)
- **sound()**: Tipo di strumento
- **gain()**: Volume (0.0 - 1.0)
- **pan()**: Bilanciamento stereo (0.0 - 1.0)
- **delay()**: Effetto delay (0.0 - 1.0)
- **room()**: Effetto reverb (0.0 - 1.0)
- **distort()**: Distorsione (0.0 - 1.0)

## Configurazione

### SEQUENCER_CONFIG
- `STEPS_PER_MEASURE`: 16 (default)
- `MIN_STEPS`: 1
- `MAX_STEPS`: 32
- `MIN_BPM`: 40
- `MAX_BPM`: 300

### POLYPHONY_CONFIG
- `MAX_TOTAL_VOICES`: 32
- `MAX_VOICES_PER_TRACK`: 8
- `MAX_ACTIVE_PARTS`: 16

### SAFE_MODE_CONFIG
- `FILTER_FREQ`: 8000 Hz (low-pass anti-aliasing)
- `REDUCE_HARMONICS`: true

## Debug Mode

Abilita logging dettagliato in `constants.ts`:

```typescript
export const DEBUG_CONFIG = {
  ENABLED: true,
  LOG_INTERVAL_MS: 2000,
} as const;
```

## Licenza

AGPL-3.0 - Vedi [LICENSE](https://www.gnu.org/licenses/agpl-3.0.html)

## Collegamenti

- [Strudel Live Coding](https://strudel.cc/)
- [Tone.js Documentation](https://tonejs.github.io/)
