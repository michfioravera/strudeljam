/**
 * Plugin: Title and favicon for TypeDoc
 * File: typedoc-plugin.js
 */

const fs = require('fs');
const path = require('path');

const FAVICON_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Cdefs%3E%3Cfilter id='glow'%3E%3CfeGaussianBlur stdDeviation='2' result='blur'/%3E%3CfeMerge%3E%3CfeMergeNode in='blur'/%3E%3CfeMergeNode in='SourceGraphic'/%3E%3C/feMerge%3E%3C/filter%3E%3C/defs%3E%3Ctext x='50%25' y='50%25' font-size='42' font-family='serif' text-anchor='middle' dominant-baseline='middle' fill='cyan' filter='url(%23glow)'%3Eꜱᴊ%3C/text%3E%3C/svg%3E`;

exports.load = function(app) {
  app.renderer.on('endRender', () => {
    const docsDir = path.join(__dirname, 'public', 'docs');
    
    // Trova tutti i file HTML nella cartella docs (ricorsivamente)
    function processHtmlFiles(dir) {
      const files = fs.readdirSync(dir);
      
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          processHtmlFiles(filePath);
        } else if (file.endsWith('.html')) {
          let html = fs.readFileSync(filePath, 'utf8');
          let modified = false;
          
          // Aggiungi favicon se non c'è già
          if (!html.includes('ꜱᴊ') || !html.includes('favicon')) {
            html = html.replace(
              '</head>',
              `<link rel="icon" type="image/svg+xml" href="${FAVICON_SVG}"></head>`
            );
            modified = true;
          }
          
          // Cambia il title per renderlo consistente
          if (html.includes('<title>') && !html.includes('ꜱᴛʀᴜᴅᴇʟᴊᴀᴍ³')) {
            html = html.replace(
              /<title>.*?<\/title>/,
              '<title>ꜱᴛʀᴜᴅᴇʟᴊᴀᴍ</title>'
            );
            modified = true;
          }
          
          if (modified) {
            fs.writeFileSync(filePath, html);
          }
        }
      });
    }
    
    if (fs.existsSync(docsDir)) {
      processHtmlFiles(docsDir);
      console.log('✓ Favicon e titoli personalizzati applicati a tutti i file HTML');
    }
  });
};
