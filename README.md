# StrudelJam 🎹

**Crea musica elettronica in tempo reale senza scrivere una sola riga di codice!**

StrudelJam è un’applicazione web (Single Page App) progettata per democratizzare la creazione di musica dal vivo (Live Coding). Utilizza la potenza del linguaggio **Strudel**, ma offre un’interfaccia visiva intuitiva che permette a chiunque di costruire beat, linee di basso e melodie in stile *Psytrance* e *Techno* in pochi secondi.

---

## 📖 Descrizione

L’obiettivo di StrudelJam è semplice: permetterti di "suonare" il codice.  
Invece di scrivere comandi complessi, utilizzi pulsanti, slider e una griglia visiva.

La magia sta nel fatto che tutto ciò che fai nell’interfaccia **genera codice Strudel reale in background**. Puoi vedere questo codice, imparare da esso o semplicemente ignorarlo e concentrarti sul ritmo. È lo strumento perfetto per improvvisare jam musicali, provare idee rapidamente o avvicinarsi al mondo del Live Coding.

---

## ✨ Caratteristiche principali

*   **Interfaccia Visuale Intuitiva**:
    *   **Aggiungi/Rimuovi Tracce**: Aggiungi elementi come Kick, Bassi Psy, Hi-Hats, Clap e Sintetizzatori con un solo clic.
    *   **Step Sequencer**: Una griglia a 16 step per disegnare i tuoi ritmi in modo visuale.
    *   **Controlli di Mixaggio**: Modifica il volume e silenzia (Mute) le singole tracce all’istante.

*   **Motore Audio Potente**:
    *   Riproduzione in tempo reale direttamente nel browser (senza download aggiuntivi).
    *   Sincronizzazione perfetta del BPM.

*   **Connessione con il Codice (Dual Mode)**:
    *   **Generazione in Tempo Reale**: Ogni pulsante che premi aggiorna il pannello del codice Strudel.
    *   **Pannello del Codice**: Apri il pannello laterale per vedere cosa succede "sotto il cofano".

*   **Registra la Tua Sessione**:
    *   Pulsante di registrazione integrato.
    *   Scarica automaticamente la tua jam session in formato audio di alta qualità (.webm) per condividerla.

---

## 🚀 Come iniziare (Installazione locale)

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

Questo progetto è stato realizzato con tecnologie web moderne e robuste:

*   **React**: Per un’interfaccia utente reattiva e modulare.
*   **TypeScript**: Per un codice sicuro e manutenibile.
*   **Tone.js**: Motore audio web che gestisce i suoni.
*   **Tailwind CSS**: Per un design elegante, scuro e responsive.
*   **Vite**: Per un ambiente di sviluppo ultrarapido.

---

## 🤝 Contribuire

Le contribuzioni sono benvenute! Se hai idee per nuovi strumenti, miglioramenti dell’interfaccia o correzioni di bug:

1.  Fai un fork del progetto.
2.  Crea un branch per la tua funzionalità (`git checkout -b feature/NuovoStrumento`).
3.  Fai le tue modifiche e committale.
4.  Pusha il branch e apri una Pull Request.

---

## 📄 Licenza

Questo progetto è distribuito sotto licenza **MIT**. Sei libero di usarlo, modificarlo e ridistribuirlo.

---

*Creato con ❤️ e codice.*
