/**
 * Plugin: Italian localization for TypeDoc
 * File: typedoc-plugin-italian.cjs
 */

module.exports = {
  load(app) {
    // Tutte le stringhe italiane
    app.i18n.addTranslations("it", {
      // Generali
      "theme.default.title": "Documentazione",
      "theme.default.readme": "Introduzione",
      "theme.default.index": "Indice",

      // Etichette sezioni
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

      // Classi / componenti
      "label.constructors": "Costruttori",
      "label.constructor": "Costruttore",
      "label.properties": "Proprietà",
      "label.property": "Proprietà",
      "label.methods": "Metodi",
      "label.method": "Metodo",
      "label.accessors": "Accessor",
      "label.getter": "Getter",
      "label.setter": "Setter",

      // Eventi
      "label.events": "Eventi",
      "label.event": "Evento",

      // Altro
      "label.signatures": "Firme",
      "label.signature": "Firma",
      "label.parameters": "Parametri",
      "label.parameter": "Parametro",
      "label.typeParameters": "Parametri di tipo",
      "label.sources": "Sorgente",
      "label.implements": "Implementa",
      "label.implementedBy": "Implementato da",
      "label.extends": "Estende",
      "label.extendedBy": "Esteso da",
      "label.externalLink": "Link esterno",

      // Ricerca
      "search.placeholder": "Cerca...",
      "search.noResults": "Nessun risultato trovato.",
      "search.results": "Risultati della ricerca",

      // Navigazione
      "theme.default.menu": "Menu",
      "theme.default.tableOfContents": "Sommario",

      // Footer
      "theme.default.footer": "Generato con TypeDoc",
    });

    // Imposta l'italiano come lingua predefinita
    app.i18n.setDefaultLanguage("it");
  },
};
