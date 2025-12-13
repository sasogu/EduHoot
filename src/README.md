
# EduHoot

**EduHoot** es una aplicación derivada de los proyectos [llixhoot](https://github.com/llixhoot/llixhoot) y [qplay](https://github.com/llixhoot/qplay). Aprovecha funcionalidades y conceptos de ambos para ofrecer una experiencia de juego tipo Kahoot, con soporte para importación de cuestionarios en formato qplay y mejoras en la gestión de partidas y quizzes.

# kahoot-clone-nodejs

<h3>INSTRUCTIONS:</h3>
<ol>
  <li>Install dependencies: `cd src && npm install`</li>
  <li>Start MongoDB locally (`sudo systemctl start mongod`) or set `MONGO_URL` to your Mongo connection string.</li>
  <li>Start Server: `node server/server.js`</li>
<li>http://localhost:3000/create/<li>
</ol>
<h4>Importar CSV desde la interfaz</h4>
<ul>
  <li>En la pantalla "Create" ahora puedes subir un archivo CSV (formato qplay) y asignar un nombre opcional.</li>
  <li>Al importarlo se creará el quiz en MongoDB y se mostrará un botón para iniciarlo al instante.</li>
</ul>
<h4>Renombrar y borrar quizzes</h4>
<ul>
  <li>En la lista de quizzes (pantalla "Create") usa los botones "Renombrar" y "Eliminar" junto a cada ítem.</li>
  <li>Estas acciones actualizan/eliminan el documento en MongoDB y refrescan la lista.</li>
</ul>
<h4>Imágenes en preguntas</h4>
<ul>
  <li>Si la columna `imagen` del CSV trae una URL, se muestra en la vista del host y también en la vista del jugador durante la pregunta.</li>
  <li>Si el campo está vacío, simplemente no se renderiza la imagen.</li>
</ul>
<h4>Orden aleatorio</h4>
<ul>
  <li>En cada partida, las preguntas y las respuestas se barajan automáticamente; el índice correcto se ajusta al nuevo orden.</li>
</ul>
<br>
<h3>CSV (qplay) import</h3>
<ol>
  <li>Coloca el CSV (formato qplay con separador ';') en una ruta accesible, por ejemplo `cuestionario_generado.csv` en la raíz del repo.</li>
  <li>Ejecuta: `cd src && node server/importCsv.js ../cuestionario_generado.csv \"Nombre del quiz\"` (el nombre es opcional, si no se usa se tomará el nombre del fichero).</li>
  <li>El script leerá el CSV, lo convertirá a preguntas y lo insertará en `kahootDB.kahootGames` asignando el siguiente id disponible.</li>
</ol>
<br>
<h3>Description</h3>
<h5>This project is a kahoot clone that uses nodejs and mongodb</h5>
<h5>Multiple games can be ongoing at one time and works with many players per game</h5>
<h3>Screen Shots:</h3>
<img src="Screenshots/join.png" height="200" width="auto" alt="Player Join"/>
<img src="Screenshots/hostJoin.png" height="200" width="auto" alt="Host Lobby"/>
<img src="Screenshots/player.png" height="200" width="auto" alt="Player"/>
<img src="Screenshots/questionResults.png" height="200" width="auto" alt="Question Results"/>
<img src="Screenshots/hostQuestion.png" height="200" width="auto" alt="Host Question"/>
<img src="Screenshots/incorrect.png" height="200" width="auto" alt="Player Results"/>
