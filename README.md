
# EduHoot

## Valencià
**EduHoot** és una aplicació tipus Kahoot per a l’aula: pots crear, importar i llançar qüestionaris amb imatges, vídeos i temps configurables. Admet CSV (inclosos els generats per IA) i importació de Kahoot públic. Està inspirada i reutilitza idees de [llixhoot](https://github.com/llixhoot/llixhoot), [llixhoot en lliurex](https://github.com/lliurex/llixhoot) i [qplay](https://github.com/jjdeharo/qplay).

- Modes: **Només jo** (efímer sense login), **Per enllaç/Públic** (persistents, encara que no hi haja sessió), amb control de permisos per a clonar.
- Idiomes: valencià, castellà i anglés (autodetecta el navegador; es pot canviar).
- Host: botó de “Saltar pregunta”, marcador de progrés i reentrada ràpida dels jugadors si es talla la connexió.
- Importació Kahoot: pega l’URL pública i juga des d’EduHoot.

**Llicència:** Attribution-ShareAlike 4.0 International (CC BY-SA 4.0).

## Castellano
**EduHoot** es una aplicación tipo Kahoot para el aula: crea, importa y lanza quizzes con imágenes, vídeos y tiempos configurables. Admite CSV (también generados por IA) e importación de Kahoot público. Se inspira y reutiliza ideas de [llixhoot](https://github.com/llixhoot/llixhoot), [llixhoot en lliurex](https://github.com/lliurex/llixhoot) y [qplay](https://github.com/jjdeharo/qplay).

- Modos: **Solo yo** (efímero sin login), **Por enlace/Público** (persisten aunque no haya sesión), con control de permisos para clonar.
- Idiomas: valenciano, castellano e inglés (autodetecta el navegador; se puede cambiar).
- Host: botón de “Saltar pregunta”, marcador de progreso y reentrada rápida de jugadores si se cae la conexión.
- Importación Kahoot: pega la URL pública y juega desde EduHoot.

**Licencia:** Attribution-ShareAlike 4.0 International (CC BY-SA 4.0).

## English
**EduHoot** is a Kahoot-like app for classrooms: create, import, and launch quizzes with images, videos, and configurable timers. Supports CSV (including AI-generated) and public Kahoot import. It’s inspired by and reuses ideas from [llixhoot](https://github.com/llixhoot/llixhoot), [llixhoot on lliurex](https://github.com/lliurex/llixhoot), and [qplay](https://github.com/jjdeharo/qplay).

- Modes: **Only me** (ephemeral without login), **By link/Public** (persist even without login), with clone-permission control.
- Languages: Valencian, Spanish, English (auto-detects browser; switchable).
- Host: “Skip question” button, progress counter, and quick player rejoin after connection drops.
- Kahoot import: paste a public URL and play it from EduHoot.

**License:** Attribution-ShareAlike 4.0 International (CC BY-SA 4.0).

## Quick start
1. `cd src && npm install`
2. Inicia MongoDB local (`sudo systemctl start mongod`) o define `MONGO_URL`.
3. Arranca el servidor: `node server/server.js`
4. Obri: `http://localhost:3000/create/`

## Funcions clau / Features
- Importa CSV des de la interfície (o enganxa CSV generat per IA).
- Importa Kahoot públic per URL/ID.
- Control de permisos: visibilitat (privat, per enllaç, públic) i permetre còpies.
- Botó de “Saltar pregunta” i marcador de progrés x/y.
- Reincorporació ràpida de jugadors si perden la connexió.
