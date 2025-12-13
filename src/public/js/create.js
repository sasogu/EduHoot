var socket = io();

socket.on('connect', function(){
    socket.emit('requestDbNames');//Get database names to display to user
});

socket.on('gameNamesData', function(data){
    if(currentFilters.tags.length){
        fetchWithFilters();
    }else{
        renderGames(data || []);
    }
});

var currentFilters = {
    tags: []
};

function fetchWithFilters(){
    var query = '';
    if(currentFilters.tags.length){
        var parts = currentFilters.tags.map(function(t){ return 'tags=' + encodeURIComponent(t); });
        query = '?' + parts.join('&');
    }
    fetch('/api/quizzes' + query)
        .then(function(res){ return res.json(); })
        .then(function(data){
            renderGames(data || []);
        })
        .catch(function(){
            renderGames([]);
        });
}

function toggleTagFilter(tag){
    var idx = currentFilters.tags.indexOf(tag);
    if(idx === -1){
        currentFilters.tags.push(tag);
    }else{
        currentFilters.tags.splice(idx, 1);
    }
    fetchWithFilters();
}

function renderGames(data){
    var div = document.getElementById('game-list');
    var count = document.getElementById('game-count');
    var filterInfo = document.getElementById('filter-info');
    if(!div) return;

    div.innerHTML = '';
    var quizzes = [];
    for(var i = 0; i < Object.keys(data || {}).length; i++){
        quizzes.push(data[i]);
    }

    if(count){
        count.textContent = quizzes.length + (quizzes.length === 1 ? ' juego' : ' juegos');
    }
    if(filterInfo){
        var activeTags = currentFilters.tags;
        filterInfo.textContent = activeTags.length ? ('Filtrando por: ' + activeTags.join(', ')) : 'Sin filtros';
    }

    if(quizzes.length === 0){
        var empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.innerHTML = '<p>No hay juegos importados aún.</p><p>Sube un CSV o crea uno nuevo para verlo aquí.</p>';
        div.appendChild(empty);
        return;
    }

    quizzes.forEach(function(quiz){
        var card = document.createElement('div');
        card.className = 'game-card';

        var head = document.createElement('div');
        head.className = 'game-card-head';

        var title = document.createElement('div');
        title.className = 'game-title';
        title.textContent = quiz.name || 'Quiz sin nombre';

        var badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = 'ID ' + quiz.id;

        head.appendChild(title);
        head.appendChild(badge);

        var subtitle = document.createElement('p');
        subtitle.className = 'game-subtitle';
        subtitle.textContent = 'Listo para jugar';

        var meta = document.createElement('div');
        meta.className = 'game-meta';
        var visibilityLabel = quiz.visibility === 'private' ? 'Solo yo' : (quiz.visibility === 'unlisted' ? 'Por enlace' : 'Público');
        meta.textContent = (quiz.ownerEmail ? ('Creado por ' + quiz.ownerEmail) : 'Creador desconocido') + ' · ' + visibilityLabel;
        if(quiz.sourceQuizId){
            meta.textContent += ' · Basado en ID ' + quiz.sourceQuizId;
        }

        var canEdit = false;
        if(authState.user){
            if(authState.user.role === 'admin') canEdit = true;
            else if(!quiz.ownerId) canEdit = true;
            else if(authState.user.id && quiz.ownerId && authState.user.id === quiz.ownerId.toString()) canEdit = true;
        }
        var canStart = quiz.visibility !== 'private' || canEdit;
        var canClone = authState.user && (quiz.allowClone || canEdit);

        var tagWrap = document.createElement('div');
        tagWrap.className = 'tag-wrap';
        var tags = Array.isArray(quiz.tags) ? quiz.tags : [];
        if(tags.length){
            tags.forEach(function(t){
                var tag = document.createElement('span');
                tag.className = 'tag';
                tag.textContent = t;
                tag.onclick = function(){ toggleTagFilter(t); };
                tagWrap.appendChild(tag);
            });
        }

        var actions = document.createElement('div');
        actions.className = 'game-actions';

        var playBtn = document.createElement('button');
        playBtn.className = 'btn btn-primary';
        playBtn.textContent = 'Iniciar juego';
        playBtn.onclick = function(){ startGame(quiz.id); };
        playBtn.disabled = !canStart;
        if(!canStart){
            playBtn.title = 'Solo el propietario puede usar un quiz privado.';
        }

        var editBtn = document.createElement('button');
        editBtn.className = 'btn btn-ghost';
        editBtn.textContent = 'Editar';
        editBtn.onclick = function(){
            window.location.href = '/create/quiz-creator/?id=' + quiz.id;
        };
        editBtn.disabled = !canEdit;

        var downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn btn-ghost';
        downloadBtn.textContent = 'Descargar CSV';
        downloadBtn.onclick = function(){
            downloadCsv(quiz.id);
        };

        var renameBtn = document.createElement('button');
        renameBtn.className = 'btn btn-ghost';
        renameBtn.textContent = 'Renombrar';
        renameBtn.onclick = function(){
            var newName = prompt('Nuevo nombre', quiz.name);
            if(newName && newName.trim()){
                renameQuiz(quiz.id, newName.trim());
            }
        };
        renameBtn.disabled = !canEdit;

        var deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-danger';
        deleteBtn.textContent = 'Eliminar';
        deleteBtn.onclick = function(){
            if(confirm('¿Eliminar este quiz?')){
                deleteQuiz(quiz.id);
            }
        };
        deleteBtn.disabled = !canEdit;

        actions.appendChild(playBtn);
        actions.appendChild(editBtn);
        actions.appendChild(downloadBtn);
        actions.appendChild(renameBtn);
        actions.appendChild(deleteBtn);

        if(canClone){
            var cloneBtn = document.createElement('button');
            cloneBtn.className = 'btn btn-ghost';
            cloneBtn.textContent = 'Hacer una copia';
            cloneBtn.onclick = function(){
                cloneQuiz(quiz.id);
            };
            actions.appendChild(cloneBtn);
        }

        var share = document.createElement('div');
        share.className = 'share-controls';
        var shareTitle = document.createElement('div');
        shareTitle.className = 'share-row';
        shareTitle.innerHTML = '<strong>Permisos de uso y copias</strong>';

        var shareRow = document.createElement('div');
        shareRow.className = 'share-row';
        var select = document.createElement('select');
        var optPrivate = document.createElement('option');
        optPrivate.value = 'private';
        optPrivate.textContent = 'Solo yo (privado)';
        var optUnlisted = document.createElement('option');
        optUnlisted.value = 'unlisted';
        optUnlisted.textContent = 'Por enlace/ID';
        var optPublic = document.createElement('option');
        optPublic.value = 'public';
        optPublic.textContent = 'Público';
        select.appendChild(optPrivate);
        select.appendChild(optUnlisted);
        select.appendChild(optPublic);
        select.value = quiz.visibility || 'public';
        select.disabled = !canEdit;

        var cloneLabel = document.createElement('label');
        cloneLabel.className = 'checkbox-label';
        var cloneCheck = document.createElement('input');
        cloneCheck.type = 'checkbox';
        cloneCheck.checked = !!quiz.allowClone;
        cloneCheck.disabled = !canEdit;
        cloneLabel.appendChild(cloneCheck);
        cloneLabel.appendChild(document.createTextNode('Permitir que otros hagan una copia'));

        var shareBtn = document.createElement('button');
        shareBtn.className = 'btn btn-ghost';
        shareBtn.textContent = 'Guardar permisos';
        shareBtn.disabled = !canEdit;
        shareBtn.onclick = function(){
            updateSharing(quiz.id, select.value, cloneCheck.checked);
        };

        shareRow.appendChild(select);
        shareRow.appendChild(cloneLabel);
        shareRow.appendChild(shareBtn);
        share.appendChild(shareTitle);
        share.appendChild(shareRow);

        card.appendChild(head);
        card.appendChild(subtitle);
        card.appendChild(meta);
        card.appendChild(tagWrap);
        card.appendChild(share);
        card.appendChild(actions);
        div.appendChild(card);
    });
}

function startGame(data){
    window.location.href="/host/" + "?id=" + data;
}

async function renameQuiz(id, name){
    try{
        var res = await fetch('/api/quizzes/' + id, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name: name })
        });
        var result = await res.json();
        if(!res.ok){
            alert(result.error || 'No se pudo renombrar.');
            return;
        }
        socket.emit('requestDbNames');
    }catch(err){
        alert('No se pudo renombrar.');
    }
}

async function deleteQuiz(id){
    try{
        var res = await fetch('/api/quizzes/' + id, { method: 'DELETE', credentials: 'include' });
        var result = await res.json();
        if(!res.ok){
            alert(result.error || 'No se pudo eliminar.');
            return;
        }
        socket.emit('requestDbNames');
    }catch(err){
        alert('No se pudo eliminar.');
    }
}

async function updateSharing(id, visibility, allowClone){
    try{
        var res = await fetch('/api/quizzes/' + id + '/sharing', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ visibility: visibility, allowClone: allowClone })
        });
        var result = await res.json();
        if(!res.ok){
            alert(result.error || 'No se pudieron guardar los permisos.');
            return;
        }
        socket.emit('requestDbNames');
    }catch(err){
        alert('No se pudieron guardar los permisos.');
    }
}

async function cloneQuiz(id){
    if(!authState.user){
        alert('Inicia sesión para clonar un quiz.');
        return;
    }
    try{
        var res = await fetch('/api/quizzes/' + id + '/clone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        var result = await res.json();
        if(!res.ok){
            alert(result.error || 'No se pudo clonar.');
            return;
        }
        alert('Copia creada en tu biblioteca.');
        socket.emit('requestDbNames');
    }catch(err){
        alert('No se pudo clonar.');
    }
}

function downloadCsv(id){
    fetch('/api/quizzes/' + id + '/csv')
        .then(function(res){
            if(!res.ok){
                return res.json().then(function(body){
                    alert((body && body.error) || 'No se pudo descargar el CSV.');
                    throw new Error('Download failed');
                }).catch(function(){
                    alert('No se pudo descargar el CSV.');
                    throw new Error('Download failed');
                });
            }
            var name = res.headers.get('Content-Disposition') || '';
            var match = name.match(/filename=\"?([^\";]+)\"?/i);
            var filename = match && match[1] ? match[1] : ('quiz-' + id + '.csv');
            return res.blob().then(function(blob){
                var url = window.URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            });
        })
        .catch(function(){
            // ya se alertó
        });
}

var csvForm = document.getElementById('csv-form');
if (csvForm) {
    csvForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        var fileInput = document.getElementById('csv-file');
        var nameInput = document.getElementById('csv-name');
        var status = document.getElementById('csv-status');

        if (!fileInput.files || fileInput.files.length === 0) {
            status.textContent = 'Selecciona un archivo CSV.';
            return;
        }

        var formData = new FormData();
        formData.append('file', fileInput.files[0]);
        if (nameInput.value && nameInput.value.trim()) {
            formData.append('name', nameInput.value.trim());
        }

        status.textContent = 'Subiendo...';
        try {
            var response = await fetch('/api/upload-csv', {
                method: 'POST',
                body: formData
            });
            var result = await response.json();
            if (!response.ok) {
                status.textContent = result.error || 'No se pudo importar el CSV.';
                return;
            }
            status.innerHTML = 'Importado: ' + result.name + ' (' + result.count + ' preguntas). ';
            var startBtn = document.createElement('button');
            startBtn.textContent = 'Iniciar ahora';
            startBtn.onclick = function() { startGame(result.id); };
            status.appendChild(startBtn);
            csvForm.reset();
        } catch (err) {
            status.textContent = 'No se pudo importar el CSV.';
        }
    });
}

// --- Generador IA ---
function buildPrompt(params){
    var idioma = params.idioma === 'otro' && params.idiomaCustom ? params.idiomaCustom : params.idioma;
    var prompt = {
        objetivo: "Generar un cuestionario en CSV con separador ';' siguiendo el formato: tipo;pregunta;r1;r2;r3;r4;tiempo;correcta;imagen",
        nivel: params.nivel || '',
        tema: params.tema || '',
        idioma: idioma || 'Español',
        numero_preguntas: params.num,
        tipos: ["quiz"],
        instrucciones: params.extra || '',
        notas: [
            "Usa el punto y coma ';' como separador.",
            "Columna 'tipo': usa 'quiz' (una correcta).",
            "Columna 'correcta': índice de la respuesta correcta (1-4).",
            "Columna 'imagen': URL opcional o vacío.",
            "Tiempo: en segundos (ej: 20)."
        ]
    };
    return JSON.stringify(prompt, null, 2);
}

var iaGenerate = document.getElementById('ia-generate');
var iaCopy = document.getElementById('ia-copy');
var iaPrompt = document.getElementById('ia-prompt');
var iaIdioma = document.getElementById('ia-idioma');
var iaIdiomaCustom = document.getElementById('ia-idioma-custom');

// --- Auth ---
var authEmail = document.getElementById('auth-email');
var authPass = document.getElementById('auth-pass');
var authStatus = document.getElementById('auth-status');
var authMsg = document.getElementById('auth-message');
var authLoginBtn = document.getElementById('auth-login');
var authLogoutBtn = document.getElementById('auth-logout');
var adminPanel = document.getElementById('user-admin');
var newUserEmail = document.getElementById('new-user-email');
var newUserPass = document.getElementById('new-user-pass');
var newUserRole = document.getElementById('new-user-role');
var createUserBtn = document.getElementById('create-user-btn');
var createUserStatus = document.getElementById('create-user-status');
var authState = { user: null };

function updateAuthUI(){
    if(!authStatus) return;
    if(authState.user){
        authStatus.textContent = authState.user.email + ' (' + authState.user.role + ')';
        authStatus.classList.remove('pill-muted');
    }else{
        authStatus.textContent = 'No has iniciado sesión';
        authStatus.classList.add('pill-muted');
    }
    if(adminPanel){
        if(authState.user && authState.user.role === 'admin'){
            adminPanel.classList.remove('hidden');
        }else{
            adminPanel.classList.add('hidden');
        }
    }
}

function fetchMe(){
    return fetch('/api/auth/me', { credentials: 'include' })
        .then(function(res){
            if(!res.ok) throw new Error();
            return res.json();
        })
        .then(function(user){
            authState.user = user;
            updateAuthUI();
            fetchWithFilters();
        })
        .catch(function(){
            authState.user = null;
            updateAuthUI();
            fetchWithFilters();
        });
}

function login(){
    if(!authEmail || !authPass) return;
    var email = authEmail.value.trim();
    var pass = authPass.value;
    authMsg.textContent = 'Iniciando sesión...';
    fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email, password: pass })
    }).then(async function(res){
        var body = {};
        try { body = await res.json(); } catch(e){}
        if(!res.ok){
            authMsg.textContent = body.error || 'Error al iniciar sesión.';
            return;
        }
        authMsg.textContent = 'Sesión iniciada.';
        authPass.value = '';
        fetchMe();
    }).catch(function(){
        authMsg.textContent = 'Error al iniciar sesión.';
    });
}

function logout(){
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
        .then(function(){
            authState.user = null;
            updateAuthUI();
            fetchWithFilters();
        })
        .catch(function(){});
}

async function createUser(){
    if(!authState.user || authState.user.role !== 'admin') return;
    if(!newUserEmail || !newUserPass || !newUserRole) return;
    var email = newUserEmail.value.trim();
    var pass = newUserPass.value;
    var role = newUserRole.value;
    if(!email || !pass){
        if(createUserStatus) createUserStatus.textContent = 'Introduce email y contraseña.';
        return;
    }
    if(createUserStatus) createUserStatus.textContent = 'Creando usuario...';
    try{
        var res = await fetch('/api/auth/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email: email, password: pass, role: role })
        });
        var body = {};
        try { body = await res.json(); } catch(e){}
        if(!res.ok){
            if(createUserStatus) createUserStatus.textContent = body.error || 'No se pudo crear.';
            return;
        }
        if(createUserStatus) createUserStatus.textContent = 'Usuario creado.';
        newUserEmail.value = '';
        newUserPass.value = '';
    }catch(err){
        if(createUserStatus) createUserStatus.textContent = 'No se pudo crear.';
    }
}

if(authLoginBtn){
    authLoginBtn.addEventListener('click', login);
}
if(authLogoutBtn){
    authLogoutBtn.addEventListener('click', logout);
}
if(createUserBtn){
    createUserBtn.addEventListener('click', createUser);
}

if (iaIdioma) {
    iaIdioma.addEventListener('change', function(){
        if (iaIdioma.value === 'otro') {
            iaIdiomaCustom.classList.remove('hidden');
        } else {
            iaIdiomaCustom.classList.add('hidden');
            iaIdiomaCustom.value = '';
        }
    });
}

if (iaGenerate) {
    iaGenerate.addEventListener('click', function(){
        var params = {
            nombre: document.getElementById('ia-name').value.trim(),
            nivel: document.getElementById('ia-nivel').value.trim(),
            tema: document.getElementById('ia-tema').value.trim(),
            idioma: iaIdioma ? iaIdioma.value : 'Español',
            idiomaCustom: iaIdiomaCustom ? iaIdiomaCustom.value.trim() : '',
            num: parseInt(document.getElementById('ia-num').value, 10) || 10,
            extra: document.getElementById('ia-extra').value.trim()
        };
        iaPrompt.textContent = buildPrompt(params);
    });
}

if (iaCopy) {
    iaCopy.addEventListener('click', function(){
        if (!iaPrompt || !iaPrompt.textContent.trim()) return;
        navigator.clipboard.writeText(iaPrompt.textContent).catch(function(){});
    });
}

var iaUpload = document.getElementById('ia-upload');
if (iaUpload) {
    iaUpload.addEventListener('click', async function(){
        var status = document.getElementById('ia-status');
        var csvText = document.getElementById('ia-csv').value.trim();
        var quizName = document.getElementById('ia-name').value.trim();
        if (!csvText) {
            status.textContent = 'Pega primero el CSV generado por la IA.';
            return;
        }
        status.textContent = 'Importando...';
        try{
            var blob = new Blob([csvText], { type: 'text/csv' });
            var file = new File([blob], 'ia.csv', { type: 'text/csv' });
            var formData = new FormData();
            formData.append('file', file);
            if (quizName) formData.append('name', quizName);

            var response = await fetch('/api/upload-csv', { method: 'POST', body: formData });
            var result = await response.json();
            if (!response.ok) {
                status.textContent = result.error || 'No se pudo importar el CSV.';
                return;
            }
            status.textContent = 'Importado: ' + result.name + ' (' + result.count + ' preguntas).';
            socket.emit('requestDbNames');
        }catch(err){
            status.textContent = 'No se pudo importar el CSV.';
        }
    });
}

// Start auth check on load
fetchMe();
