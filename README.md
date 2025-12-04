# StrudelJam

StrudelJam è un’applicazione web progettata per creare musica elettronica in tempo reale tramite un’interfaccia visiva intuitiva e un motore basato su Strudel.  
L’obiettivo è permettere a chiunque, anche senza esperienza musicale o di programmazione, di comporre ritmi, melodie e sequenze attraverso uno step–sequencer sincronizzato con codice Strudel generato automaticamente.

---

## Caratteristiche principali

### Interfaccia visiva
- Aggiunta e rimozione di tracce con una vasta selezione di strumenti Strudel  
  (Kick, Snare, Hi-Hat, Clap, Crash, Percussioni, Bass, Noise, Synth e altri).
- Ogni traccia può utilizzare qualsiasi strumento disponibile, incluso ogni variante di synth per waveform.
- Step sequencer configurabile (default 16 step).
- Attivazione e disattivazione rapida degli step.
- Slider di velocity per ogni step attivo, con valori da 1 a 100.
- La velocity viene convertita automaticamente in `.gain()` proporzionale nel codice Strudel generato.
- Controlli disponibili per ogni traccia:
  - Volume
  - Mute
  - Cambio dello strumento
- Interfaccia semplice, chiara e progettata per una creazione musicale immediata.

---

## Collegamento UI ↔ Strudel (Dual Mode)
- Ogni modifica nella UI aggiorna istantaneamente il codice Strudel generato.
- Ogni modifica valida nel pannello di codice si riflette nella UI.
- Rapporto 1:1 tra la rappresentazione visiva e la struttura del codice.
- Sincronizzazione completa tra codice e interfaccia.

---

## Sequenze
- Creazione di un numero illimitato di sequenze indipendenti.
- Step count personalizzabile per ogni sequenza.
- Operazioni disponibili:
  - Creare nuove sequenze
  - Rinominare
  - Duplicare
  - Eliminare
  - Aprire e modificare
- Modalità di riproduzione:
  - Loop della sequenza corrente
  - Riproduzione sequenziale di tutte le sequenze da sinistra a destra
- Barra delle sequenze fissa (sticky), sempre accessibile, che permette di modificare qualsiasi sequenza anche mentre un’altra è in riproduzione.

---

## Motore audio
- Generazione audio in tempo reale tramite Tone.js.
- BPM sincronizzato tra tutte le tracce.
- Gestione accurata di gain, volume e velocity.
- Ampia gamma di strumenti disponibili tramite Strudel.
- Riproduzione stabile e performante nel browser.

---

## Registrazione
- Registrazione integrata della sessione audio.
- Esportazione in formato `.webm` o altri formati supportati dal browser.

---

## Installazione locale

### Prerequisiti
- Node.js
- npm

### Passaggi
1. Clonare o scaricare il repository.
2. Installare le dipendenze:
   ```
   npm install
   ```
3. Avviare il server di sviluppo:
   ```
   npm run dev
   ```
4. Aprire il browser all’indirizzo:
	```
	http://localhost:5173
	```

---

## Deploy su Netlify

StrudelJam utilizza Vite (basato su Rollup).
Per garantire compatibilità con Netlify (Linux/x64), si consiglia l’uso di npm, che installa correttamente gli optionalDependencies necessari ai binari di Rollup.

### Comando di build consigliato

```
npm run build
```

### Nota importante

L’uso di npm install evita l’errore:

```
Cannot find module @rollup/rollup-linux-x64-gnu
```

---

## Tecnologie utilizzate

- React
- TypeScript
- Vite
- Tone.js
- TailwindCSS
- Strudel con integrazione in Dual Mode


