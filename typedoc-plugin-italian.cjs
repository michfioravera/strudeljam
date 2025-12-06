/**
 * Plugin diagnostico - vediamo le traduzioni esistenti
 */

module.exports = {
  load(app) {
    const i18n = app.internationalization;

    console.log("[DIAG] Lingue supportate:", i18n.getSupportedLanguages());
    console.log("[DIAG] Locale caricato:", i18n.loadedLocale);
    console.log("[DIAG] Locales disponibili:", Object.keys(i18n.locales || {}));
    
    // Vediamo cosa c'è dentro locales
    if (i18n.locales) {
      const firstLocale = Object.keys(i18n.locales)[0];
      if (firstLocale && i18n.locales[firstLocale]) {
        console.log("[DIAG] Chiavi della prima lingua (" + firstLocale + "):");
        const keys = Object.keys(i18n.locales[firstLocale]);
        console.log("[DIAG] Totale chiavi:", keys.length);
        console.log("[DIAG] Prime 30 chiavi:", keys.slice(0, 30));
      }
    }

    // Proviamo ad aggiungere italiano e vedere se funziona
    i18n.addTranslations("it", {
      "kind_plural_function": "FUNZIONI_TEST",
    });

    console.log("[DIAG] Dopo addTranslations, locales:", Object.keys(i18n.locales || {}));
    
    // Proviamo a cambiare locale
    try {
      i18n.setLocale("it");
      console.log("[DIAG] setLocale('it') eseguito");
      console.log("[DIAG] loadedLocale dopo setLocale:", i18n.loadedLocale);
    } catch (e) {
      console.log("[DIAG] Errore setLocale:", e.message);
    }
  },
};