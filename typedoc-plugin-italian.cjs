/**
 * Plugin: Italian localization for TypeDoc (Typedoc 0.28+ compatible)
 */

module.exports = {
  load(app) {
    app.converter.on("begin", () => {
      // Verifica sicurezza
      if (!app.i18n) {
        console.warn("[Typedoc Italian] i18n non disponibile, impossibile registrare le traduzioni.");
        return;
      }

      // Registrazione traduzioni italiane
      app.i18n.addTranslations("it", {
        "theme.default.title": "Documentazione",
        "theme.default.readme": "Introduzione",
        "theme.default.index": "Indice",

        "label.readme": "Introduzione",
        "label.index": "Indice",
        "label.reference": "Riferimenti",
        "label.references": "Riferimenti",
        "label.modules": "Moduli",
        "label.module": "Modulo",
        "label.namespaces": "Namespace",
        "label.namespace": "Namespace",
        "label.classes": "Classi",
        "label.class": "Classe",
        "label.interfaces": "Interfacce",
        "label.interface": "Interfaccia",
        "label.enums": "Enum",
        "label.enum": "Enum",
        "label.functions": "Funzioni",
        "label.function": "Funzione",
        "label.variables": "Variabili",
        "label.variable": "Variabile",
        "label.typeAliases": "Alias di Tipo",
        "label.typeAlias": "Alias di Tipo",

        "label.constructors": "Costruttori",
        "label.constructor": "Costruttore",
        "label.properties": "Proprietà",
        "label.property": "Proprietà",
        "label.methods": "Metodi",
        "label.method": "Metodo",

        "label.accessors": "Accessor",
        "label.getter": "Getter",
        "label.setter": "Setter",

        "label.signatures": "Firme",
        "label.parameters": "Parametri",
        "label.typeParameters": "Parametri di tipo",

        "label.sources": "Sorgente",
        "label.extends": "Estende",
        "label.implements": "Implementa",

        "search.placeholder": "Cerca...",
        "search.noResults": "Nessun risultato trovato.",
        "search.results": "Risultati della ricerca",

        "theme.default.menu": "Menu",
        "theme.default.tableOfContents": "Sommario",

        "theme.default.footer": "Generato con TypeDoc",
      });

      // Imposta lingua italiana di default
      app.i18n.setDefaultLanguage("it");

      console.log("[Typedoc Italian] Traduzione italiana caricata con successo.");
    });
  },
};
