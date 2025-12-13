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

var browserLang = (navigator.language || 'es').slice(0,2);
var lang = localStorage.getItem('lang') || (['es','en','ca'].includes(browserLang) ? browserLang : 'es');
var i18n = {
    es: {
        back: 'Volver',
        title: 'Crea y lanza tu EduHoot',
        subtitle: 'Elige un juego importado o <a id="link" href="quiz-creator/">crea uno desde cero</a>',
        langLabel: 'Idioma',
        accessEyebrow: 'Acceso',
        accessTitle: 'Usuarios',
        accessDesc: 'Inicia sesión para crear, editar o borrar quizzes.',
        authStatus: 'No has iniciado sesión',
        labelEmail: 'Email',
        labelPass: 'Contraseña',
        labelRole: 'Rol',
        btnLogin: 'Entrar',
        btnLogout: 'Cerrar sesión',
        forgotPass: '¿Olvidaste la contraseña?',
        resetEyebrow: 'Recuperar acceso',
        resetDesc: 'Te enviaremos un token (se registra en el log del servidor si no hay correo configurado). Luego úsalo para poner una nueva contraseña.',
        btnGenToken: 'Generar token',
        labelToken: 'Token recibido',
        labelNewPass: 'Nueva contraseña',
        btnChangePass: 'Cambiar contraseña',
        adminOnly: 'Solo admins',
        createUser: 'Crea un usuario nuevo',
        roleEditor: 'Editor',
        roleAdmin: 'Admin',
        btnCreateUser: 'Crear usuario',
        labelEmailReset: 'Email a resetear',
        btnResetPass: 'Resetear contraseña',
        aiEyebrow: 'Ayuda IA',
        aiTitle: 'Generador IA (CSV)',
        aiDesc: 'Rellena los campos y copia el prompt para generar tu cuestionario por IA.',
        iaNameLabel: 'Nombre del quiz (opcional)',
        iaLevel: 'Nivel del alumnado',
        iaTopic: 'Tema del cuestionario',
        iaLang: 'Idioma del cuestionario',
        iaNum: 'Número de preguntas',
        iaExtra: 'Instrucciones adicionales',
        btnGenPrompt: 'Generar prompt',
        btnCopyPrompt: 'Copiar prompt',
        promptPlaceholder: 'El prompt aparecerá aquí...',
        iaCsvLabel: 'Contenido CSV generado por la IA',
        btnImportIa: 'Importar CSV en el juego',
        kahootTitle: 'Importar Kahoot público',
        btnImportKahoot: 'Importar desde Kahoot',
        importEyebrow: 'Importación',
        importTitle: 'Importar quiz desde CSV',
        importDesc: 'Sube un archivo CSV con tus preguntas para guardarlo en tu biblioteca.',
        btnUploadCsv: 'Subir CSV',
        libraryEyebrow: 'Biblioteca',
        libraryTitle: 'Juegos importados',
        libraryDesc: 'Selecciona un juego para hostearlo o gestiona su nombre y estado.',
        noFilters: 'Sin filtros',
        filterBy: 'Filtrando por: ',
        play: 'Iniciar juego',
        edit: 'Editar',
        download: 'Descargar CSV',
        rename: 'Renombrar',
        delete: 'Eliminar',
        clone: 'Hacer una copia',
        renamePrompt: 'Nuevo nombre',
        confirmDelete: '¿Eliminar este quiz?',
        cannotStartPrivate: 'Solo el propietario puede usar un quiz privado.',
        saveSharing: 'Guardar permisos',
        allowClone: 'Permitir que otros hagan una copia',
        visibilityPrivate: 'Solo yo (privado)',
        visibilityUnlisted: 'Por enlace/ID',
        visibilityPublic: 'Público',
        creatorUnknown: 'Creador desconocido',
        noGames: 'No hay juegos importados aún.',
        noGamesHint: 'Sube un CSV o crea uno nuevo para verlo aquí.',
        importSuccess: 'Importado',
        importing: 'Importando...',
        uploadCsv: 'Subiendo...',
        uploadCsvError: 'No se pudo importar el CSV.',
        loginError: 'Error al iniciar sesión.',
        loginWait: 'Iniciando sesión...',
        resetWaiting: 'Enviando...',
        resetTokenSent: 'Revisa tu correo (o el log del servidor) para ver el token.',
        resetTokenError: 'No se pudo generar el token.',
        resetNeedFields: 'Completa token y nueva contraseña.',
        resetUpdating: 'Actualizando...',
        resetUpdated: 'Contraseña actualizada. Inicia sesión.',
        resetUpdateError: 'No se pudo actualizar.',
        notLogged: 'Inicia sesión para clonar un quiz.',
        cloneOk: 'Copia creada en tu biblioteca.',
        cloneError: 'No se pudo clonar.',
        namePlaceholder: 'Nombre del quiz (opcional)'
    },
    en: {
        back: 'Back',
        title: 'Create and launch your EduHoot',
        subtitle: 'Pick an imported game or <a id="link" href="quiz-creator/">create one from scratch</a>',
        langLabel: 'Language',
        accessEyebrow: 'Access',
        accessTitle: 'Users',
        accessDesc: 'Sign in to create, edit or delete quizzes.',
        authStatus: 'Not signed in',
        labelEmail: 'Email',
        labelPass: 'Password',
        labelRole: 'Role',
        btnLogin: 'Log in',
        btnLogout: 'Log out',
        forgotPass: 'Forgot your password?',
        resetEyebrow: 'Recover access',
        resetDesc: 'We will generate a token (check server log if no email). Use it to set a new password.',
        btnGenToken: 'Generate token',
        labelToken: 'Received token',
        labelNewPass: 'New password',
        btnChangePass: 'Change password',
        adminOnly: 'Admins only',
        createUser: 'Create a new user',
        roleEditor: 'Editor',
        roleAdmin: 'Admin',
        btnCreateUser: 'Create user',
        labelEmailReset: 'Email to reset',
        btnResetPass: 'Reset password',
        aiEyebrow: 'AI helper',
        aiTitle: 'AI generator (CSV)',
        aiDesc: 'Fill the fields and copy the prompt to generate your quiz with AI.',
        iaNameLabel: 'Quiz name (optional)',
        iaLevel: 'Students level',
        iaTopic: 'Quiz topic',
        iaLang: 'Quiz language',
        iaNum: 'Number of questions',
        iaExtra: 'Extra instructions',
        btnGenPrompt: 'Generate prompt',
        btnCopyPrompt: 'Copy prompt',
        promptPlaceholder: 'Prompt will appear here...',
        iaCsvLabel: 'CSV content from AI',
        btnImportIa: 'Import CSV into the game',
        kahootTitle: 'Import public Kahoot',
        btnImportKahoot: 'Import from Kahoot',
        importEyebrow: 'Import',
        importTitle: 'Import quiz from CSV',
        importDesc: 'Upload a CSV with your questions to save it in your library.',
        btnUploadCsv: 'Upload CSV',
        libraryEyebrow: 'Library',
        libraryTitle: 'Imported games',
        libraryDesc: 'Pick a game to host or manage its name and status.',
        noFilters: 'No filters',
        filterBy: 'Filtering by: ',
        play: 'Start game',
        edit: 'Edit',
        download: 'Download CSV',
        rename: 'Rename',
        delete: 'Delete',
        clone: 'Make a copy',
        renamePrompt: 'New name',
        confirmDelete: 'Delete this quiz?',
        cannotStartPrivate: 'Only the owner can use a private quiz.',
        saveSharing: 'Save permissions',
        allowClone: 'Allow others to copy',
        visibilityPrivate: 'Only me (private)',
        visibilityUnlisted: 'By link/ID',
        visibilityPublic: 'Public',
        creatorUnknown: 'Unknown creator',
        noGames: 'No games yet.',
        noGamesHint: 'Upload a CSV or create one to see it here.',
        importSuccess: 'Imported',
        importing: 'Importing...',
        uploadCsv: 'Uploading...',
        uploadCsvError: 'Could not import CSV.',
        loginError: 'Login failed.',
        loginWait: 'Signing in...',
        resetWaiting: 'Sending...',
        resetTokenSent: 'Check your email or server log for the token.',
        resetTokenError: 'Could not generate the token.',
        resetNeedFields: 'Fill token and new password.',
        resetUpdating: 'Updating...',
        resetUpdated: 'Password updated. Sign in.',
        resetUpdateError: 'Could not update.',
        notLogged: 'Sign in to clone a quiz.',
        cloneOk: 'Copy created in your library.',
        cloneError: 'Could not clone.',
        namePlaceholder: 'Quiz name (optional)'
    },
    ca: {
        back: 'Tornar',
        title: 'Crea i llança el teu EduHoot',
        subtitle: 'Tria un joc importat o <a id="link" href="quiz-creator/">crea\'n un de zero</a>',
        langLabel: 'Idioma',
        accessEyebrow: 'Accés',
        accessTitle: 'Usuaris',
        accessDesc: 'Inicia sessió per crear, editar o esborrar qüestionaris.',
        authStatus: 'No has iniciat sessió',
        labelEmail: 'Email',
        labelPass: 'Contrasenya',
        labelRole: 'Rol',
        btnLogin: 'Entrar',
        btnLogout: 'Tancar sessió',
        forgotPass: 'Has oblidat la contrasenya?',
        resetEyebrow: 'Recuperar accés',
        resetDesc: 'Generarem un token (mira el log del servidor si no hi ha correu). Després fes-lo servir per posar una nova contrasenya.',
        btnGenToken: 'Generar token',
        labelToken: 'Token rebut',
        labelNewPass: 'Nova contrasenya',
        btnChangePass: 'Canviar contrasenya',
        adminOnly: 'Només admins',
        createUser: 'Crea un usuari nou',
        roleEditor: 'Editor',
        roleAdmin: 'Admin',
        btnCreateUser: 'Crear usuari',
        labelEmailReset: 'Email a restablir',
        btnResetPass: 'Restablir contrasenya',
        aiEyebrow: 'Ajuda IA',
        aiTitle: 'Generador IA (CSV)',
        aiDesc: 'Omple els camps i copia el prompt per generar el qüestionari amb IA.',
        iaNameLabel: 'Nom del quiz (opcional)',
        iaLevel: 'Nivell de l\'alumnat',
        iaTopic: 'Tema del qüestionari',
        iaLang: 'Idioma del qüestionari',
        iaNum: 'Nombre de preguntes',
        iaExtra: 'Instruccions addicionals',
        btnGenPrompt: 'Generar prompt',
        btnCopyPrompt: 'Copiar prompt',
        promptPlaceholder: 'El prompt apareixerà aquí...',
        iaCsvLabel: 'Contingut CSV generat per la IA',
        btnImportIa: 'Importar CSV al joc',
        kahootTitle: 'Importar Kahoot públic',
        btnImportKahoot: 'Importar des de Kahoot',
        importEyebrow: 'Importació',
        importTitle: 'Importar quiz des de CSV',
        importDesc: 'Puja un fitxer CSV amb les teves preguntes per desar-lo a la biblioteca.',
        btnUploadCsv: 'Pujar CSV',
        libraryEyebrow: 'Biblioteca',
        libraryTitle: 'Jocs importats',
        libraryDesc: 'Selecciona un joc per hostatjar-lo o gestiona el seu nom i estat.',
        noFilters: 'Sense filtres',
        filterBy: 'Filtrant per: ',
        play: 'Iniciar joc',
        edit: 'Editar',
        download: 'Descarregar CSV',
        rename: 'Reanomenar',
        delete: 'Eliminar',
        clone: 'Fer una còpia',
        renamePrompt: 'Nom nou',
        confirmDelete: 'Eliminar aquest quiz?',
        cannotStartPrivate: 'Només el propietari pot usar un quiz privat.',
        saveSharing: 'Desar permisos',
        allowClone: 'Permetre que altres en facin una còpia',
        visibilityPrivate: 'Només jo (privat)',
        visibilityUnlisted: 'Per enllaç/ID',
        visibilityPublic: 'Públic',
        creatorUnknown: 'Creador desconegut',
        noGames: 'Encara no hi ha jocs.',
        noGamesHint: 'Puja un CSV o crea\'n un per veure\'l aquí.',
        importSuccess: 'Importat',
        importing: 'Important...',
        uploadCsv: 'Pujant...',
        uploadCsvError: 'No s\'ha pogut importar el CSV.',
        loginError: 'Error en iniciar sessió.',
        loginWait: 'Iniciant sessió...',
        resetWaiting: 'Enviant...',
        resetTokenSent: 'Mira el correu o el log del servidor per al token.',
        resetTokenError: 'No s\'ha pogut generar el token.',
        resetNeedFields: 'Omple token i nova contrasenya.',
        resetUpdating: 'Actualitzant...',
        resetUpdated: 'Contrasenya actualitzada. Inicia sessió.',
        resetUpdateError: 'No s\'ha pogut actualitzar.',
        notLogged: 'Inicia sessió per clonar un quiz.',
        cloneOk: 'Còpia creada a la teva biblioteca.',
        cloneError: 'No s\'ha pogut clonar.',
        namePlaceholder: 'Nom del quiz (opcional)'
    }
};

function t(key){
    return (i18n[lang] && i18n[lang][key]) || i18n.es[key] || key;
}

function applyStaticTranslations(){
    document.querySelectorAll('[data-i18n]').forEach(function(el){
        var key = el.getAttribute('data-i18n');
        // Avoid touching labels with form controls to prevent hiding inputs
        if(el.tagName === 'LABEL' && el.querySelector('input,select,textarea')){
            return;
        }
        if(key === 'subtitle' || key === 'promptPlaceholder'){
            el.innerHTML = t(key);
        }else{
            el.textContent = t(key);
        }
    });
    var authEmail = document.getElementById('auth-email');
    if(authEmail) authEmail.placeholder = t('labelEmail');
    var authPass = document.getElementById('auth-pass');
    if(authPass) authPass.placeholder = '••••••••';
    var resetEmail = document.getElementById('reset-email');
    if(resetEmail) resetEmail.placeholder = t('labelEmail');
    var resetToken = document.getElementById('reset-token');
    if(resetToken) resetToken.placeholder = 'token';
    var resetPass = document.getElementById('reset-pass');
    if(resetPass) resetPass.placeholder = '••••••••';
    var iaName = document.getElementById('ia-name');
    if(iaName) iaName.placeholder = t('namePlaceholder');
    var csvName = document.getElementById('csv-name');
    if(csvName) csvName.placeholder = t('namePlaceholder');
    var langSelect = document.getElementById('lang-select');
    if(langSelect) langSelect.value = lang;
}

function setLang(newLang){
    lang = newLang;
    localStorage.setItem('lang', lang);
    applyStaticTranslations();
    socket.emit('requestDbNames');
}

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
        if(quizzes.length === 1){
            count.textContent = '1 ' + (lang === 'en' ? 'game' : (lang === 'ca' ? 'joc' : 'juego'));
        }else{
            count.textContent = quizzes.length + ' ' + (lang === 'en' ? 'games' : (lang === 'ca' ? 'jocs' : 'juegos'));
        }
    }
    if(filterInfo){
        var activeTags = currentFilters.tags;
        filterInfo.textContent = activeTags.length ? (t('filterBy') + activeTags.join(', ')) : t('noFilters');
    }

    if(quizzes.length === 0){
        var empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.innerHTML = '<p>'+t('noGames')+'</p><p>'+t('noGamesHint')+'</p>';
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
        subtitle.textContent = '';

        var meta = document.createElement('div');
        meta.className = 'game-meta';
        var visibilityLabel = quiz.visibility === 'private' ? t('visibilityPrivate') : (quiz.visibility === 'unlisted' ? t('visibilityUnlisted') : t('visibilityPublic'));
        var creatorText = quiz.ownerEmail ? ((lang === 'en' ? 'Created by ' : (lang === 'ca' ? 'Creat per ' : 'Creado por ')) + quiz.ownerEmail) : t('creatorUnknown');
        meta.textContent = creatorText + ' · ' + visibilityLabel;
        if(quiz.sourceQuizId){
            meta.textContent += ' · ' + (lang === 'en' ? 'Based on ' : (lang === 'ca' ? 'Basat en ' : 'Basado en ')) + 'ID ' + quiz.sourceQuizId;
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
        playBtn.textContent = t('play');
        playBtn.onclick = function(){ startGame(quiz.id); };
        playBtn.disabled = !canStart;
        if(!canStart){
            playBtn.title = t('cannotStartPrivate');
        }

        var editBtn = document.createElement('button');
        editBtn.className = 'btn btn-ghost';
        editBtn.textContent = t('edit');
        editBtn.onclick = function(){
            window.location.href = '/create/quiz-creator/?id=' + quiz.id;
        };
        editBtn.disabled = !canEdit;

        var downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn btn-ghost';
        downloadBtn.textContent = t('download');
        downloadBtn.onclick = function(){
            downloadCsv(quiz.id);
        };

        var renameBtn = document.createElement('button');
        renameBtn.className = 'btn btn-ghost';
        renameBtn.textContent = t('rename');
        renameBtn.onclick = function(){
            var newName = prompt(t('renamePrompt'), quiz.name);
            if(newName && newName.trim()){
                renameQuiz(quiz.id, newName.trim());
            }
        };
        renameBtn.disabled = !canEdit;

        var deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-danger';
        deleteBtn.textContent = t('delete');
        deleteBtn.onclick = function(){
            if(confirm(t('confirmDelete'))){
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
            cloneBtn.textContent = t('clone');
            cloneBtn.onclick = function(){
                cloneQuiz(quiz.id);
            };
            actions.appendChild(cloneBtn);
        }

        var share = document.createElement('div');
        share.className = 'share-controls';
        var shareTitle = document.createElement('div');
        shareTitle.className = 'share-row';
        shareTitle.innerHTML = '<strong>'+t('saveSharing')+'</strong>';

        var shareRow = document.createElement('div');
        shareRow.className = 'share-row';
        var select = document.createElement('select');
        var optPrivate = document.createElement('option');
        optPrivate.value = 'private';
        optPrivate.textContent = t('visibilityPrivate');
        var optUnlisted = document.createElement('option');
        optUnlisted.value = 'unlisted';
        optUnlisted.textContent = t('visibilityUnlisted');
        var optPublic = document.createElement('option');
        optPublic.value = 'public';
        optPublic.textContent = t('visibilityPublic');
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
        cloneLabel.appendChild(document.createTextNode(t('allowClone')));

        var shareBtn = document.createElement('button');
        shareBtn.className = 'btn btn-ghost';
        shareBtn.textContent = t('saveSharing');
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
var resetAdminEmail = document.getElementById('reset-admin-email');
var resetAdminPass = document.getElementById('reset-admin-pass');
var resetAdminBtn = document.getElementById('reset-admin-btn');
var resetAdminStatus = document.getElementById('reset-admin-status');
var toggleResetBtn = document.getElementById('toggle-reset');
var resetPanel = document.getElementById('reset-panel');
var resetEmail = document.getElementById('reset-email');
var resetToken = document.getElementById('reset-token');
var resetPass = document.getElementById('reset-pass');
var resetRequestBtn = document.getElementById('reset-request');
var resetConfirmBtn = document.getElementById('reset-confirm');
var resetStatus = document.getElementById('reset-status');
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

async function resetPasswordAsAdmin(){
    if(!authState.user || authState.user.role !== 'admin') return;
    if(!resetAdminEmail || !resetAdminPass) return;
    var email = resetAdminEmail.value.trim();
    var pass = resetAdminPass.value;
    if(!email || !pass){
        if(resetAdminStatus) resetAdminStatus.textContent = 'Introduce email y nueva contraseña.';
        return;
    }
    if(resetAdminStatus) resetAdminStatus.textContent = 'Actualizando...';
    try{
        var res = await fetch('/api/auth/reset-admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email: email, password: pass })
        });
        var body = {};
        try { body = await res.json(); } catch(e){}
        if(!res.ok){
            if(resetAdminStatus) resetAdminStatus.textContent = body.error || 'No se pudo actualizar.';
            return;
        }
        if(resetAdminStatus) resetAdminStatus.textContent = 'Contraseña actualizada.';
        resetAdminPass.value = '';
    }catch(err){
        if(resetAdminStatus) resetAdminStatus.textContent = 'No se pudo actualizar.';
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
if(resetAdminBtn){
    resetAdminBtn.addEventListener('click', resetPasswordAsAdmin);
}
if(toggleResetBtn && resetPanel){
    toggleResetBtn.addEventListener('click', function(){
        resetPanel.classList.toggle('hidden');
    });
}
if(resetRequestBtn){
    resetRequestBtn.addEventListener('click', async function(){
        if(!resetEmail) return;
        var email = resetEmail.value.trim();
        if(!email){
            if(resetStatus) resetStatus.textContent = 'Introduce tu email.';
            return;
        }
        if(resetStatus) resetStatus.textContent = 'Enviando...';
        try{
            var res = await fetch('/api/auth/request-reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email })
            });
            await res.json().catch(function(){});
            if(resetStatus) resetStatus.textContent = 'Revisa tu correo (o el log del servidor) para ver el token.';
        }catch(err){
            if(resetStatus) resetStatus.textContent = 'No se pudo generar el token.';
        }
    });
}
if(resetConfirmBtn){
    resetConfirmBtn.addEventListener('click', async function(){
        if(!resetToken || !resetPass) return;
        var token = resetToken.value.trim();
        var pass = resetPass.value;
        if(!token || !pass){
            if(resetStatus) resetStatus.textContent = 'Completa token y nueva contraseña.';
            return;
        }
        if(resetStatus) resetStatus.textContent = 'Actualizando...';
        try{
            var res = await fetch('/api/auth/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: token, password: pass })
            });
            var body = {};
            try { body = await res.json(); } catch(e){}
            if(!res.ok){
                if(resetStatus) resetStatus.textContent = body.error || 'No se pudo actualizar.';
                return;
            }
            if(resetStatus) resetStatus.textContent = 'Contraseña actualizada. Inicia sesión.';
            resetPass.value = '';
            resetToken.value = '';
        }catch(err){
            if(resetStatus) resetStatus.textContent = 'No se pudo actualizar.';
        }
    });
}

// Start auth check on load
fetchMe();

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

var langSelector = document.getElementById('lang-select');
if(langSelector){
    langSelector.value = lang;
    langSelector.addEventListener('change', function(){
        setLang(langSelector.value);
    });
}
applyStaticTranslations();

// Importar Kahoot público
var kahootForm = document.getElementById('kahoot-form');
var kahootUrlInput = document.getElementById('kahoot-url');
var kahootStatus = document.getElementById('kahoot-status');
var kahootVisSelect = document.getElementById('kahoot-visibility');
if(kahootForm){
    kahootForm.addEventListener('submit', async function(e){
        e.preventDefault();
        if(!kahootUrlInput || !kahootUrlInput.value.trim()){
            return;
        }
        if(kahootStatus) kahootStatus.textContent = t('importing');
        try{
            var res = await fetch('/api/import/kahoot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: kahootUrlInput.value.trim(),
                    visibility: kahootVisSelect ? kahootVisSelect.value : 'public'
                })
            });
            var body = {};
            try { body = await res.json(); } catch(e){}
            if(!res.ok){
                if(kahootStatus) kahootStatus.textContent = body.error || 'Error al importar.';
                return;
            }
            if(kahootStatus){
                kahootStatus.innerHTML = t('importSuccess') + ': ' + (body.name || '') + ' (' + body.count + ') ';
                var btn = document.createElement('button');
                btn.textContent = t('play');
                btn.onclick = function(){ startGame(body.id); };
                kahootStatus.appendChild(btn);
            }
            socket.emit('requestDbNames');
        }catch(err){
            if(kahootStatus) kahootStatus.textContent = 'Error al importar.';
        }
    });
}
