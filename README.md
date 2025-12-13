
# EduHoot

**EduHoot** es una aplicación que ofrece una experiencia de juego tipo Kahoot, con soporte para importación de cuestionarios en formato csv y mejoras en la gestión de partidas y quizzes. Se inspira y reutiliza ideas de [llixhoot](https://github.com/llixhoot/llixhoot), [llixhoot en lliurex](https://github.com/lliurex/llixhoot) y [qplay](https://github.com/jjdeharo/qplay).

**Licencia:** Attribution-ShareAlike 4.0 International (CC BY-SA 4.0).

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
