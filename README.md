# EduHoot

## Valencià
**EduHoot** és una aplicació tipus Kahoot per a l’aula: pots crear, importar i llançar qüestionaris amb imatges, vídeos i temps configurables. Admet CSV (inclosos els generats per IA) i importació de Kahoot públic. Està inspirada i reutilitza idees de [llixhoot](https://github.com/llixhoot/llixhoot), [llixhoot en lliurex](https://github.com/lliurex/llixhoot) i [qplay](https://github.com/jjdeharo/qplay).

- Modes: **Només jo** (efímer sense login), **Per enllaç/Públic** (persistents encara que no hi haja sessió) i control de permisos per a clonar.
- Idiomes: valencià, castellà i anglès (autodetecta el navegador i es pot canviar).
- Host: botó de “Saltar pregunta”, indicador de progrés i reentrada ràpida quan algun jugador perd la connexió.
- Importació Kahoot: enganxa la URL pública i juga des d’EduHoot.

**Llicència:** Attribution-ShareAlike 4.0 International (CC BY-SA 4.0).

### Inici ràpid
1. `cd src && npm install`
2. Inicia MongoDB local (`sudo systemctl start mongod`) o defineix `MONGO_URL`.
3. Executa `node server/server.js`.
4. Obri `http://localhost:3000/create/`.

### Funcions clau
- Importació de CSV i de contingut generat per IA.
- Importació pública de Kahoot per URL o ID.
- Control de visibilitat (privat, per enllaç, públic) i permisos de clonació.
- Botó de “Saltar pregunta” i marcador de progrés.
- Recuperació ràpida de jugadors quan la connexió cau.

### Actualitzacions recents
- Landing principal redissenyada amb accessos separats, selector d’idioma i footer comú amb el logo d’EduTicTac.
- Biblioteca amb ordenació per data i alfabètica, tags rellevants i estadístiques de partides.
- El mode Solo ara registra partides i mostra estadístiques visibles al ranking i un feedback més clar.

## Castellano
**EduHoot** es una aplicación tipo Kahoot para el aula: crea, importa y lanza quizzes con imágenes, vídeos y tiempos configurables. Admite CSV (también generados por IA) e importación de Kahoot público. Se inspira y reutiliza ideas de [llixhoot](https://github.com/llixhoot/llixhoot), [llixhoot en lliurex](https://github.com/lliurex/llixhoot) y [qplay](https://github.com/jjdeharo/qplay).

- Modos: **Solo yo** (efímero sin login), **Por enlace/Público** (persisten aunque no haya sesión) y control de permisos para clonar.
- Idiomas: valenciano, castellano e inglés (autodetecta el navegador y se puede cambiar).
- Host: botón de “Saltar pregunta”, indicador de progreso y reincorporación rápida cuando los jugadores pierden la conexión.
- Importación Kahoot: pega la URL pública y juega desde EduHoot.

**Licencia:** Attribution-ShareAlike 4.0 International (CC BY-SA 4.0).

### Inicio rápido
1. `cd src && npm install`
2. Inicia MongoDB local (`sudo systemctl start mongod`) o configura `MONGO_URL`.
3. Ejecuta `node server/server.js`.
4. Abre `http://localhost:3000/create/`.

### Funciones clave
- Importación de CSV y de contenido generado por IA.
- Importación pública de Kahoot por URL o ID.
- Control de visibilidad (privado, por enlace, público) y permisos para clonar.
- Botón de “Saltar pregunta” y contador de progreso.
- Reincorporación ágil de jugadores si se cae la conexión.

### Actualizaciones recientes
- Landing principal renovada con accesos diferenciados, selector de idioma y footer compartido con el logo de EduTicTac.
- Biblioteca con orden por fecha y alfabético, etiquetas relevantes y estadísticas visibles en cada ficha.
- Modo Solo registra partidas y mejora el ranking/feedback, además de mostrar estadísticas de partidas jugadas.

## English
**EduHoot** is a Kahoot-like app for classrooms: create, import, and launch quizzes with images, videos, and configurable timers. Supports CSV (including AI-generated) and public Kahoot import. It’s inspired by and reuses ideas from [llixhoot](https://github.com/llixhoot/llixhoot), [llixhoot on lliurex](https://github.com/lliurex/llixhoot), and [qplay](https://github.com/jjdeharo/qplay).

- Modes: **Only me** (ephemeral without login), **By link/Public** (persist even without login), with clone-permission control.
- Languages: Valencian, Spanish, English (auto-detects browser and is switchable).
- Host: “Skip question” button, progress counter, and quick player rejoin when connections drop.
- Kahoot import: paste a public URL and play it from EduHoot.

**License:** Attribution-ShareAlike 4.0 International (CC BY-SA 4.0).

### Quick start
1. `cd src && npm install`
2. Start local MongoDB (`sudo systemctl start mongod`) or set `MONGO_URL`.
3. Run `node server/server.js`.
4. Open `http://localhost:3000/create/`.

### Key features
- CSV import and AI-generated content ingestion.
- Public Kahoot import via URL or ID.
- Visibility controls (private, by link, public) with clone permissions.
- “Skip question” button and progress tracking.
- Fast player rejoin if the connection drops.

### Recent updates
- Redesigned landing with separate entry points, language selector, and shared footer pointing to EduTicTac.
- Library now supports ordering by date/alpha, shows only related tags, and surfaces quiz stats.
- Solo mode logs plays so the ranking/counts include solo sessions, plus brighter feedback and stats.
