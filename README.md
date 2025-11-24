# StrudelJam 🎹

**¡Crea música electrónica en tiempo real sin escribir una sola línea de código!**

StrudelJam es una aplicación web (Single Page App) diseñada para democratizar la creación de música en vivo (Live Coding). Utiliza la potencia del lenguaje **Strudel**, pero ofrece una interfaz visual intuitiva para que cualquiera pueda construir beats, líneas de bajo y melodías al estilo *Psytrance* y *Techno* en cuestión de segundos.

---

## 📖 Descripción

El objetivo de StrudelJam es simple: permitirte "tocar" el código. En lugar de escribir comandos complejos, utilizas botones, deslizadores y una cuadrícula visual.

Lo mágico es que todo lo que haces en la interfaz **genera código Strudel real en segundo plano**. Puedes ver este código, aprender de él o simplemente ignorarlo y concentrarte en el ritmo. Es la herramienta perfecta para improvisar jams musicales, probar ideas rápidas o introducirse en el mundo del Live Coding.

---

## ✨ Características Principales

*   **Interfaz Visual Intuitiva**:
    *   **Añadir/Quitar Pistas**: Agrega elementos como Kicks, Bajos Psy, Hi-Hats, Claps y Sintetizadores con un solo clic.
    *   **Secuenciador de Pasos**: Una cuadrícula de 16 pasos para dibujar tus ritmos visualmente.
    *   **Controles de Mezcla**: Ajusta el volumen y silencia (Mute) pistas individuales al instante.

*   **Motor de Audio Potente**:
    *   Reproducción en tiempo real basada en el navegador (sin descargas extra).
    *   Sincronización perfecta de BPM.

*   **Conexión con Código (Dual Mode)**:
    *   **Generación en Vivo**: Cada botón que tocas actualiza el panel de código Strudel.
    *   **Panel de Código**: Abre el panel lateral para ver qué está pasando "bajo el capó".

*   **Graba tu Sesión**:
    *   Botón de grabación integrado.
    *   Descarga tu jam session automáticamente en formato de audio de alta calidad (.webm) para compartirla.

---

## 🚀 Cómo empezar (Instalación Local)

Sigue estos pasos para ejecutar el proyecto en tu computadora:

### Prerrequisitos
Asegúrate de tener instalado **Node.js** y un gestor de paquetes como **Yarn** o **NPM**.

### Pasos

1.  **Clonar o Descargar**:
    Descarga los archivos del proyecto en tu carpeta preferida.

2.  **Instalar Dependencias**:
    Abre una terminal en la carpeta del proyecto y ejecuta:
    ```bash
    yarn install
    # o si usas npm:
    # npm install
    ```

3.  **Iniciar el Servidor de Desarrollo**:
    Arranca la aplicación localmente:
    ```bash
    yarn run dev
    # o si usas npm:
    # npm run dev
    ```

4.  **¡A crear!**:
    Abre tu navegador en la dirección que aparece en la terminal (usualmente `http://localhost:5173`) y empieza a hacer música.

---

## 🛠️ Tecnologías Utilizadas

Este proyecto ha sido construido con tecnologías web modernas y robustas:

*   **React**: Para una interfaz de usuario reactiva y modular.
*   **TypeScript**: Para un código seguro y mantenible.
*   **Tone.js**: El motor de audio web que impulsa los sonidos.
*   **Tailwind CSS**: Para un diseño elegante, oscuro y responsivo.
*   **Vite**: Para un entorno de desarrollo ultrarrápido.

---

## 🤝 Contribuir

¡Las contribuciones son bienvenidas! Si tienes ideas para nuevos instrumentos, mejoras en la interfaz o correcciones de errores:

1.  Haz un Fork del proyecto.
2.  Crea una rama para tu funcionalidad (`git checkout -b feature/NuevoInstrumento`).
3.  Haz tus cambios y commitealos.
4.  Sube tu rama y abre un Pull Request.

---

## 📄 Licencia

Este proyecto se distribuye bajo la licencia **MIT**. Eres libre de usarlo, modificarlo y distribuirlo.

---

*Hecho con ❤️ y código.*
