# StrudelJam 🎹

**Crea musica elettronica in tempo reale!**

StrudelJam è un’applicazione web progettata per la creazione di musica dal vivo. Utilizza la potenza del linguaggio **Strudel** in un’interfaccia visiva intuitiva.

---

## ✨ Caratteristiche principali

*   **Interfaccia Visuale**:
    *   **Aggiungi/Rimuovi Tracce**: Aggiungi elementi come Kick, Bassi Psy, Hi-Hats, Clap e Sintetizzatori con un clic.
    *   **Step Sequencer**: Una griglia a 16 step per disegnare ritmi.
    *   **Controlli**: Modifica il volume e silenzia le singole tracce all’istante.

*   **Motore Audio**:
    *   Riproduzione in tempo reale nel browser.
    *   Sincronizzazione del BPM.

*   **Connessione con il Codice (Dual Mode)**:
    *   **Generazione in Tempo Reale**: Ogni pulsante che premuto aggiorna il pannello del codice Strudel.
    *   **Pannello del Codice**: modifiche attuate nel pannello a comparsa aggiornano l'interfaccia.

*   **Registrazione di sessione**:
    *   Pulsante di registrazione integrato.
    *   Pulsante per scaricare la sessione in formato .webm.

---

## 🚀 Installazione locale

Segui questi passaggi per eseguire il progetto sul tuo computer:

### Prerequisiti
Assicurati di avere installato **Node.js** e un gestore di pacchetti come **Yarn** o **NPM**.

### Passaggi

1.  **Clona o Scarica**:  
    Scarica i file del progetto nella cartella desiderata.

2.  **Installa le Dipendenze**:  
    Apri il terminale nella cartella del progetto ed esegui:
    ```bash
    yarn install
    # oppure se usi npm:
    # npm install
    ```

3.  **Avvia il Server di Sviluppo**:  
    Avvia l’applicazione in locale:
    ```bash
    yarn run dev
    # oppure se usi npm:
    # npm run dev
    ```

4.  **Inizia a Creare!**  
    Apri il browser all’indirizzo indicato nel terminale (di solito `http://localhost:5173`) e comincia a fare musica.

---

## 🛠️ Tecnologie Utilizzate

Questo progetto è stato realizzato con:

*   **React**: Per un’interfaccia utente reattiva e modulare.
*   **TypeScript**: Per un codice sicuro e manutenibile.
*   **Tone.js**: Motore audio web che gestisce i suoni.
*   **Tailwind CSS**: Per un design elegante, scuro e responsive.
*   **Vite**: Per un ambiente di sviluppo ultrarapido.

---

## 📄 Licenza

Questo progetto è distribuito sotto licenza **MIT**. Sei libero di usarlo, modificarlo e ridistribuirlo.

---
