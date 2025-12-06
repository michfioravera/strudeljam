# Documentazione

**StrudelJam** è un sequencer musicale step-based costruito con React, TypeScript e Tone.js, ispirato alla sintassi di [Strudel](https://strudel.cc/).

---

## Come Funziona

StrudelJam ti permette di creare musica componendo **pattern ritmici** su una griglia di step (passi). Ogni traccia rappresenta uno strumento e puoi attivare/disattivare i singoli step per creare il tuo beat.

### Concetti Base

| Concetto | Descrizione |
|----------|-------------|
| **Step** | Un singolo "passo" nella sequenza. Può essere attivo (suona) o inattivo (silenzio) |
| **Traccia** | Una riga di step associata a uno strumento (es. Kick, Snare, Synth) |
| **Sequenza** | Un insieme di tracce che suonano insieme. Puoi creare più sequenze e concatenarle |
| **BPM** | Battiti per minuto — la velocità di riproduzione |

---

## Guida Rapida

### 1. Aggiungi una Traccia
Premi il pulsante **+** in basso a destra e scegli uno strumento dal menu.

### 2. Attiva gli Step
Clicca sui quadrati della griglia per attivare/disattivare i suoni. Gli step attivi si illuminano.

### 3. Modifica uno Step
Clicca su uno step **già attivo** per aprire l'editor:
- **Nota**: Cambia la nota musicale (C, D, E... e l'ottava)
- **Velocità**: Regola l'intensità del suono (0-100)

### 4. Avvia la Riproduzione
Premi **▶ Avvia** nella barra superiore. Lo step corrente viene evidenziato mentre scorre.

### 5. Regola gli Effetti
Clicca sull'icona **⚙ Sliders** di una traccia per aprire il pannello effetti:
- **Panoramica (Pan)**: Sposta il suono tra sinistra e destra
- **Ritardo (Delay)**: Aggiunge un eco
- **Riverbero (Reverb)**: Simula uno spazio acustico
- **Distorsione**: Aggiunge grinta al suono

### 6. Gestisci più Sequenze
Usa la barra delle sequenze per:
- **Creare** nuove sequenze (pulsante +)
- **Duplicare** una sequenza esistente
- **Rinominare** cliccando sul nome
- **Eliminare** sequenze non necessarie

### 7. Modalità di Riproduzione
- **Singola**: Ripete solo la sequenza attiva
- **Tutte**: Riproduce tutte le sequenze in ordine, ciclicamente

---

## Interfaccia

```
┌──────────────────────────────────────────────────────────────┐
│ [Logo]  STRUDELJAM        BPM [120]  STEPS [16]   ▶  🎤  </> │ ← Header
├──────────────────────────────────────────────────────────────┤
│ [Seq A]   [Seq B]   [Seq C]   [+]        [Singola ▼]         │ ← Sequenze
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ⚙  🗑   Kick ▼     [■][□][□][□][■][□][□][□][■]…             │ ← Traccia 1
│        🔊 ━━━━━━━                                            │
│                                                              │
│  ⚙  🗑   Snare ▼    [□][□][■][□][□][□][■][□][□]…             │ ← Traccia 2
│        🔊 ━━━━━━━                                            │
│                                                              │
│  ⚙  🗑   HiHat ▼    [■][■][■][■][■][■][■][■][■]…             │ ← Traccia 3
│        🔊 ━━━━━━━                                            │
│                                                              │
└──────────────────────────────────────────────────────────────┘

                                                        [+] ← Aggiungi Traccia
```


### Legenda Controlli Traccia

| Icona | Funzione |
|-------|----------|
| ⚙ (Sliders) | Apre il pannello effetti e imposta il numero di step |
| 🗑 (Trash) | Elimina la traccia |
| Nome ▼ | Cambia lo strumento |
| 🔊/🔇 | Muta/Smuta la traccia |
| Slider | Regola il volume |

---

## Strumenti Disponibili

### Casse (Drums)

| Nome | Descrizione |
|------|-------------|
| Kick | Cassa classica |
| Snare | Rullante |
| HiHat Closed | Charleston chiuso |
| HiHat Open | Charleston aperto |
| Clap | Battito di mani |
| Rim | Colpo sul bordo |
| Tom Low | Tom basso |
| Tom Mid | Tom medio |
| Tom High | Tom alto |
| Crash | Piatto crash |

### Sintetizzatori

| Nome | Descrizione |
|------|-------------|
| Synth Lead | Synth melodico principale |
| Synth Pad | Synth per accordi/atmosfere |
| Synth Bass | Basso sintetico |
| Synth Pluck | Suono pizzicato |

### Rumori

| Nome | Descrizione |
|------|-------------|
| White Noise | Rumore bianco |
| Pink Noise | Rumore rosa |
| Brown Noise | Rumore marrone |

---

## Codice Strudel

StrudelJam genera automaticamente codice compatibile con [Strudel](https://strudel.cc/). Premi l'icona **</>** per visualizzarlo.

### Esempio di Codice Generato

```strudeljam
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

| Parametro | Descrizione | Range |
|-----------|-------------|-------|
| `note()` | Pattern di note (`~` = pausa) | C0-B8 |
| `sound()` | Tipo di strumento | — |
| `gain()` | Volume | 0.0 - 1.0 |
| `pan()` | Bilanciamento stereo | 0.0 - 1.0 |
| `delay()` | Effetto delay | 0.0 - 1.0 |
| `room()` | Effetto reverb | 0.0 - 1.0 |
| `distort()` | Distorsione | 0.0 - 1.0 |


> **Nota**: Puoi modificare il codice e premere "Applica" per aggiornare la UI.

---

## Registrazione

1. Premi l'icona **🎤** per avviare la registrazione
2. L'icona lampeggia durante la registrazione
3. Premi di nuovo per fermare e scaricare il file `.webm`

---

## Scorciatoie

| Tasto | Azione |
|-------|--------|
| `Spazio` | Play/Stop (quando non sei in un input) |
| `Esc` | Chiudi popup/editor |
| `Enter` | Conferma valore input |

---

## Sviluppo

### Architettura

```
src/
├── components/
│ ├── App.tsx # Componente principale, stato globale
│ ├── TrackList.tsx # Lista tracce e step editor
│ ├── SequenceList.tsx # Gestione sequenze
│ └── ErrorBoundary.tsx # Gestione errori React
├── hooks/
│ ├── useAudioEngine.ts # Interfaccia con audio engine
│ ├── useClickOutside.ts# Gestione click fuori popup
│ └── useDeepCompareMemo.ts # Memoizzazione profonda
├── lib/
│ ├── audio-engine.ts # Motore audio Tone.js
│ ├── strudel-gen.ts # Generatore/parser codice
│ └── constants.ts # Configurazioni globali
└── utils/
└── id.ts # Generazione ID univoci
```

### Motore Audio

Il motore audio (`audio-engine.ts`) è basato su Tone.js con:
- **Gestione polifonia intelligente**: Limita le voci attive per prevenire sovraccarico
- **Hot-swapping**: Aggiorna le Parts durante la riproduzione senza glitch
- **Gain limiting**: Previene automaticamente il clipping audio

### Installazione

```bash
# Clona il repository
git clone https://github.com/michfioravera/strudeljam.git
cd strudeljam

# Installa dipendenze
npm install

# Avvia dev server
npm run dev

# Build produzione
npm run build
```

### Configurazione

``` typescript
// constants.ts

export const SEQUENCER_CONFIG = {
  STEPS_PER_MEASURE: 16,  // Step di default
  MIN_STEPS: 1,
  MAX_STEPS: 32,
  MIN_BPM: 40,
  MAX_BPM: 300,
};

export const POLYPHONY_CONFIG = {
  MAX_TOTAL_VOICES: 32,
  MAX_VOICES_PER_TRACK: 8,
  MAX_ACTIVE_PARTS: 16,
};
```

### Localizzazione Errori

```typescript
// constants.ts
export const DEBUG_CONFIG = {
  ENABLED: true,
  LOG_INTERVAL_MS: 2000,
};
```

---

## Licenza

AGPL-3.0 - Vedi [LICENSE](https://www.gnu.org/licenses/agpl-3.0.html)

---

## Collegamenti

- [Strudel Live Coding](https://strudel.cc/)
- [Tone.js Documentation](https://tonejs.github.io/)
