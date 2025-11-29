# StrudelJam

StrudelJam è un’applicazione web progettata per creare musica elettronica in tempo reale.
Combina una UI semplice e visuale con la potenza del linguaggio Strudel, permettendo sia l’uso totalmente grafico sia la modifica opzionale del codice generato.

## Caratteristiche principali

### UI Visuale

- Aggiunta e rimozione immediata di tracce (Kick, Bass, Hi-Hat, Clap, Synth ecc.)
- Step sequencer a 16 step per costruire pattern ritmici
- Ogni step acceso può avere un parametro velocity regolabile da 1 a 100 tramite slider o menu elegante
- Ogni traccia può essere silenziata, regolata nel volume o eliminata completamente
- Interfaccia progettata per essere essenziale, chiara e immediata

### Sistema di Sequenze

- Ogni gruppo di tracce e pattern può essere salvato come sequenza
- Le sequenze scorrono orizzontalmente
- L’utente può:
	- creare una nuova sequenza
	- rinominarla
	- duplicarla
	- eliminarla
	- aprirla e modificarla
- Possibilità di riprodurre:
	- una sola sequenza attiva
	- tutte le sequenze in ordine, da sinistra verso destra

### Connessione con Strudel (Dual Mode)

- Ogni modifica nella UI aggiorna automaticamente il codice Strudel corrispondente
- È possibile modificare manualmente il codice nel pannello laterale: la UI rifletterà le modifiche
- Relazione 1–1 tra elementi grafici e codice generato

### Motore Audio

- Riproduzione in tempo reale nel browser
- BPM sincronizzato
- Velocity per step convertita in .gain() proporzionale nella generazione del codice Strudel
- Step spenti rimangono invariati
- Ampia libreria di suoni adatti anche a generi come psytrance

### Registrazione delle sessioni

- Pulsante per registrare in tempo reale
- Possibilità di scaricare la sessione in formato .webm

## Installazione locale

### Prerequisiti

- Node.js
- Yarn o npm

### Passaggi

1. Scarica o clona il repository.
2. Installa le dipendenze:
	```
	yarn install
	# oppure:
	# npm install
	```
3. Avvia l’applicazione:
	```
	yarn run dev
	# oppure:
	# npm run dev
	```
4. Apri il browser su `http://localhost:5173` e inizia a suonare.

## Tecnologie utilizzate

- React
- TypeScript
- Tone.js
- Tailwind CSS
- Vite

## Licenza

Questo progetto è distribuito sotto licenza MIT. Puoi usarlo, modificarlo e ridistribuirlo liberamente.