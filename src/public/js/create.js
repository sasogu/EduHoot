var socket = io();

socket.on('connect', function(){
    socket.emit('requestDbNames');//Get database names to display to user
});

socket.on('gameNamesData', function(data){
    fetchWithFilters();
    fetchTags();
});

var currentFilters = {
    tags: [],
    mineOnly: false,
    search: ''
};
var currentSort = 'newest';
var knownTags = [];
var currentDisplayedQuizzes = [];

function getTagsFromLibraryData(data){
    var tags = new Set();
    if(!data) return [];
    var entries = data || {};
    var entriesLength = Object.keys(entries).length;
    for(var i = 0; i < entriesLength; i++){
        var q = entries[i];
        if(!q) continue;
        var tgs = Array.isArray(q.tags) ? q.tags : [];
        if(!tgs.length) continue;
        tgs.forEach(function(t){
            var clean = (t || '').toString().trim();
            if(!clean) return;
            tags.add(clean);
        });
    }
    return Array.from(tags).filter(Boolean).slice(0, 40);
}
function getTagFrequencies(data){
    var frequencies = {};
    if(!data) return frequencies;
    var entries = Array.isArray(data) ? data : Object.values(data);
    entries.forEach(function(quiz){
        if(!quiz) return;
        var tagList = Array.isArray(quiz.tags) ? quiz.tags : [];
        tagList.forEach(function(raw){
            var clean = (raw || '').toString().trim();
            if(!clean) return;
            frequencies[clean] = (frequencies[clean] || 0) + 1;
        });
    });
    return frequencies;
}
function getQuizTimestamp(quiz){
    if(!quiz) return 0;
    var raw = quiz.createdAt || quiz.updatedAt || quiz.id;
    var parsed = Date.parse(raw);
    if(!isNaN(parsed)) return parsed;
    return 0;
}
function sortLibraryQuizzes(quizzes){
    if(!quizzes || !quizzes.slice) return quizzes;
    var sorted = quizzes.slice();
    if(currentSort === 'newest'){
        sorted.sort(function(a, b){
            return getQuizTimestamp(b) - getQuizTimestamp(a);
        });
    }else if(currentSort === 'oldest'){
        sorted.sort(function(a, b){
            return getQuizTimestamp(a) - getQuizTimestamp(b);
        });
    }else if(currentSort === 'alpha-asc'){
        sorted.sort(function(a, b){
            var na = (a.name || '').toLowerCase();
            var nb = (b.name || '').toLowerCase();
            return na.localeCompare(nb);
        });
    }else if(currentSort === 'alpha-desc'){
        sorted.sort(function(a, b){
            var na = (a.name || '').toLowerCase();
            var nb = (b.name || '').toLowerCase();
            return nb.localeCompare(na);
        });
    }
    return sorted;
}
var LIBRARY_PAGE_SIZE = 12;
var libraryCurrentPage = 1;
var libraryTotalPages = 1;
var libraryLatestData = [];
function getAnonOwnerToken(){
    var key = 'anonOwnerToken';
    var existing = localStorage.getItem(key);
    if(existing) return existing;
    var arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    var token = Array.from(arr).map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
    localStorage.setItem(key, token);
    return token;
}
function ownsLocal(id){
    if(!id || typeof id !== 'string') return false;
    try{
        var stored = JSON.parse(localStorage.getItem('localQuizzes') || '[]');
        return stored.indexOf(id) !== -1;
    }catch(e){
        return false;
    }
}

var browserLang = (navigator.language || 'es').slice(0,2);
var lang = localStorage.getItem('lang') || (['es','en','ca'].includes(browserLang) ? browserLang : 'es');
var i18n = {
    es: {
        back: 'Volver',
        title: 'Crea y lanza tu EduHoot',
        subtitle: 'Genera con IA, importa (CSV o Kahoot) o <a id="link" href="quiz-creator/">crea un cuestionario desde cero</a>.',
        langLabel: 'Idioma',
        modalClose: 'Cerrar',
        accessEyebrow: 'Acceso',
        accessTitle: 'Usuarios',
        accessDesc: 'Inicia sesión para crear, editar o borrar quizzes.',
        authStatus: 'No has iniciado sesión',
        labelEmail: 'Email',
        labelPass: 'Contraseña',
        labelRole: 'Rol',
        btnSaveNick: 'Guardar nombre visible',
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
        iaUseDocs: 'Usar documentos como conocimiento exclusivo',
        iaDocsHint: 'Cuando ejecutes este prompt en la IA, te pedirá que adjuntes los documentos. No subas nada aquí: adjunta los archivos allí y las preguntas se generarán exclusivamente a partir de esos documentos.',
        iaLang: 'Idioma del cuestionario',
        iaNum: 'Número de preguntas',
        iaExtra: 'Instrucciones adicionales',
        iaTypesLabel: 'Tipos de pregunta',
        iaTypeQuiz: 'Quiz (1 correcta)',
        iaTypeMultiple: 'Respuesta Múltiple',
        iaTypeTf: 'Verdadero / Falso',
        btnGenPrompt: 'Generar prompt',
        btnCopyPrompt: 'Copiar prompt',
        promptPlaceholder: 'El prompt aparecerá aquí...',
        iaCsvLabel: 'Contenido CSV generado por la IA',
        btnPreviewCsv: 'Vista previa',
        btnOpenCsv: 'Abrir CSV',
        btnDownloadCsv: 'Descargar CSV',
        btnEditCreator: 'Editar en creador',
        previewTitle: 'Vista previa',
        alertPasteCsv: 'Pega primero el CSV.',
        alertNothingToSave: 'No hay nada que guardar.',
        btnImportIa: 'Importar CSV en el cuestionario',
        kahootTitle: 'Importar Kahoot público',
        kahootHelp: 'Pega la URL o el ID de un Kahoot público.',
        btnImportKahoot: 'Importar desde Kahoot',
        importEyebrow: 'Importación',
        importTitle: 'Importar cuestionario (CSV o Kahoot público)',
        importDesc: 'Sube un archivo CSV con tus preguntas para guardarlo en tu biblioteca.',
        btnUploadCsv: 'Subir CSV',
        libraryEyebrow: 'Biblioteca',
        libraryTitle: 'Cuestionarios importados',
        libraryDesc: 'Selecciona un cuestionario para hostearlo o gestiona su nombre y estado.',
        searchPlaceholder: 'Buscar por nombre o etiqueta',
        suggestedTags: 'Etiquetas usadas (toca para filtrar)',
        noFilters: 'Sin filtros',
        filterBy: 'Filtrando por: ',
        filterMine: 'Sólo mis cuestionarios',
        sortLabel: 'Ordenar por',
        sortNewest: 'Más recientes primero',
        sortOldest: 'Más antiguos primero',
        sortAlphaAsc: 'Orden alfabético A-Z',
        sortAlphaDesc: 'Orden alfabético Z-A',
        playsShort: 'partidas',
        playersShort: 'jugadores',
        paginationPrev: 'Anterior',
        paginationNext: 'Siguiente',
        paginationPageInfo: 'Página {current} de {total}',
        play: 'Iniciar cuestionario',
        edit: 'Editar',
        download: 'Descargar CSV',
        editQuiz: 'Editar cuestionario',
        exportMoodleXml: 'Exportar XML (Moodle)',
        rename: 'Renombrar',
        delete: 'Eliminar',
        clone: 'Hacer una copia',
        renamePrompt: 'Nuevo nombre',
        confirmDelete: '¿Eliminar este quiz?',
        cannotStartPrivate: 'Solo el propietario puede usar un quiz privado.',
        needLogin: 'Inicia sesión para realizar esta acción.',
        permissionDenied: 'No tienes permiso para realizar esta acción.',
        saveSharing: 'Guardar permisos',
        allowClone: 'Permitir que otros hagan una copia',
        visibilityPrivate: 'Solo yo (privado)',
        visibilityUnlisted: 'Por enlace/ID',
        visibilityPublic: 'Público',
        creatorUnknown: 'Creador desconocido',
        creatorHidden: 'Creador',
        labelNick: 'Nombre visible (opcional)',
        noGames: 'No hay cuestionarios importados aún.',
        noGamesHint: 'Sube un CSV o crea uno nuevo para verlo aquí.',
        importSuccess: 'Importado',
        importing: 'Importando...',
        uploadCsv: 'Subiendo...',
        uploadCsvError: 'No se pudo importar el CSV.',
        startNow: 'Iniciar ahora',
        createUserMissing: 'Introduce email y contraseña.',
        createUserWorking: 'Creando usuario...',
        createUserOk: 'Usuario creado.',
        createUserError: 'No se pudo crear.',
        savingNick: 'Guardando nombre visible...',
        nickSaved: 'Nombre visible actualizado.',
        nickSaveError: 'No se pudo guardar.',
        loginError: 'Error al iniciar sesión.',
        loginWait: 'Iniciando sesión...',
        loginOk: 'Sesión iniciada.',
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
        namePlaceholder: 'Nombre del quiz (opcional)',
        selectCsv: 'Selecciona un archivo CSV.',
        downloadCsvError: 'No se pudo descargar el CSV.',
        renameError: 'No se pudo renombrar.',
        deleteError: 'No se pudo eliminar.',
        sharingError: 'No se pudieron guardar los permisos.',
        gameSingular: 'cuestionario',
        gamePlural: 'cuestionarios',
        idLabel: 'ID',
        footerLicense: 'EduHoot · Licencia Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)',
        importError: 'Error al importar.',
        emailPlaceholder: 'tu correo',
        authNickPlaceholder: 'Tu nick público',
        resetTokenPlaceholder: 'token del email/log',
        iaLevelPlaceholder: 'Ej: 2º ESO',
        iaTopicPlaceholder: 'Ej: Energía y calor',
        iaLangCustomPlaceholder: 'Otro idioma',
        iaExtraPlaceholder: 'Tono, nivel cognitivo, formato...',
        iaCsvPlaceholder: 'Pega aquí el CSV devuelto por la IA',
        kahootUrlPlaceholder: 'URL o ID (p. ej. https://create.kahoot.it/details/... o 01234567)',
        visibilityHelp: '<strong>Solo yo:</strong> si no inicias sesión, el quiz se guarda solo en tu sesión y caduca en 24h.<br><strong>Por enlace / Público:</strong> aunque no tengas cuenta, se guardan de forma global en el servidor y sobreviven a reinicios. Si inicias sesión, quedan ligados a tu usuario. Puedes permitir o no las copias.',
        langEs: 'Español',
        langEn: 'English',
        langCa: 'Català',
        optSpanish: 'Español',
        optCatalan: 'Catalán',
        optEnglish: 'Inglés',
        optOther: 'Otro'
    },
    en: {
        back: 'Back',
        title: 'Create and launch your EduHoot',
        subtitle: 'Generate with AI, import (CSV or Kahoot), or <a id="link" href="quiz-creator/">create a quiz from scratch</a>.',
        langLabel: 'Language',
        modalClose: 'Close',
        accessEyebrow: 'Access',
        accessTitle: 'Users',
        accessDesc: 'Sign in to create, edit or delete quizzes.',
        authStatus: 'Not signed in',
        labelEmail: 'Email',
        labelPass: 'Password',
        labelRole: 'Role',
        btnSaveNick: 'Save display name',
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
        iaUseDocs: 'Use documents as exclusive knowledge',
        iaDocsHint: 'When you run this prompt in the AI, it will ask you to attach the documents. Do not upload anything here: attach the files there and the questions will be generated exclusively from those documents.',
        iaLang: 'Quiz language',
        iaNum: 'Number of questions',
        iaExtra: 'Extra instructions',
        iaTypesLabel: 'Question types',
        iaTypeQuiz: 'Quiz (1 correct)',
        iaTypeMultiple: 'Multiple answers',
        iaTypeTf: 'True / False',
        btnGenPrompt: 'Generate prompt',
        btnCopyPrompt: 'Copy prompt',
        promptPlaceholder: 'Prompt will appear here...',
        iaCsvLabel: 'CSV content from AI',
        btnPreviewCsv: 'Preview',
        btnOpenCsv: 'Open CSV',
        btnDownloadCsv: 'Download CSV',
        btnEditCreator: 'Edit in creator',
        previewTitle: 'Preview',
        alertPasteCsv: 'Paste the CSV first.',
        alertNothingToSave: 'Nothing to save.',
        btnImportIa: 'Import CSV into the quiz',
        kahootTitle: 'Import public Kahoot',
        kahootHelp: 'Paste a public Kahoot URL or ID.',
        btnImportKahoot: 'Import from Kahoot',
        importEyebrow: 'Import',
        importTitle: 'Import quiz (CSV or public Kahoot)',
        importDesc: 'Upload a CSV with your questions to save it in your library.',
        btnUploadCsv: 'Upload CSV',
        libraryEyebrow: 'Library',
        libraryTitle: 'Imported quizzes',
        libraryDesc: 'Pick a quiz to host or manage its name and status.',
        searchPlaceholder: 'Search by name or tag',
        suggestedTags: 'Suggested tags (tap to filter)',
        noFilters: 'No filters',
        filterBy: 'Filtering by: ',
        filterMine: 'Only my quizzes',
        sortLabel: 'Sort by',
        sortNewest: 'Newest first',
        sortOldest: 'Oldest first',
        sortAlphaAsc: 'Alphabetical A-Z',
        sortAlphaDesc: 'Alphabetical Z-A',
        playsShort: 'plays',
        playersShort: 'players',
        paginationPrev: 'Previous',
        paginationNext: 'Next',
        paginationPageInfo: 'Page {current} of {total}',
        play: 'Start quiz',
        edit: 'Edit',
        download: 'Download CSV',
        editQuiz: 'Edit quiz',
        exportMoodleXml: 'Export Moodle XML',
        rename: 'Rename',
        delete: 'Delete',
        clone: 'Make a copy',
        renamePrompt: 'New name',
        confirmDelete: 'Delete this quiz?',
        cannotStartPrivate: 'Only the owner can use a private quiz.',
        needLogin: 'Sign in to perform this action.',
        permissionDenied: 'You don\'t have permission to perform this action.',
        saveSharing: 'Save permissions',
        allowClone: 'Allow others to copy',
        visibilityPrivate: 'Only me (private)',
        visibilityUnlisted: 'By link/ID',
        visibilityPublic: 'Public',
        creatorUnknown: 'Unknown creator',
        creatorHidden: 'Creator',
        labelNick: 'Display name (optional)',
        noGames: 'No quizzes yet.',
        noGamesHint: 'Upload a CSV or create one to see it here.',
        importSuccess: 'Imported',
        importing: 'Importing...',
        uploadCsv: 'Uploading...',
        uploadCsvError: 'Could not import CSV.',
        startNow: 'Start now',
        createUserMissing: 'Enter email and password.',
        createUserWorking: 'Creating user...',
        createUserOk: 'User created.',
        createUserError: 'Could not create user.',
        savingNick: 'Saving display name...',
        nickSaved: 'Display name updated.',
        nickSaveError: 'Could not save.',
        loginError: 'Login failed.',
        loginWait: 'Signing in...',
        loginOk: 'Session started.',
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
        namePlaceholder: 'Quiz name (optional)',
        selectCsv: 'Select a CSV file.',
        downloadCsvError: 'Could not download the CSV.',
        renameError: 'Could not rename.',
        deleteError: 'Could not delete.',
        sharingError: 'Could not save permissions.',
        gameSingular: 'quiz',
        gamePlural: 'quizzes',
        idLabel: 'ID',
        footerLicense: 'EduHoot · Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)',
        importError: 'Import failed.',
        emailPlaceholder: 'your email',
        authNickPlaceholder: 'Your public nickname',
        resetTokenPlaceholder: 'token from email/log',
        iaLevelPlaceholder: 'e.g. 8th grade',
        iaTopicPlaceholder: 'e.g. Energy and heat',
        iaLangCustomPlaceholder: 'Other language',
        iaExtraPlaceholder: 'Tone, cognitive level, format...',
        iaCsvPlaceholder: 'Paste here the CSV returned by the AI',
        kahootUrlPlaceholder: 'URL or ID (e.g. https://create.kahoot.it/details/... or 01234567)',
        visibilityHelp: '<strong>Only me:</strong> if you don\'t sign in, the quiz is stored only in your session and expires in 24h.<br><strong>By link / Public:</strong> even without an account it is stored globally on the server and survives restarts. If you sign in, it links to your user. You can allow or block copies.',
        langEs: 'Spanish',
        langEn: 'English',
        langCa: 'Catalan',
        optSpanish: 'Spanish',
        optCatalan: 'Catalan',
        optEnglish: 'English',
        optOther: 'Other'
    },
    ca: {
        back: 'Tornar',
        title: 'Crea i llança el teu EduHoot',
        subtitle: 'Genera amb IA, importa (CSV o Kahoot) o <a id="link" href="quiz-creator/">crea un qüestionari de zero</a>.',
        langLabel: 'Idioma',
        modalClose: 'Tancar',
        accessEyebrow: 'Accés',
        accessTitle: 'Usuaris',
        accessDesc: 'Inicia sessió per crear, editar o esborrar qüestionaris.',
        authStatus: 'No has iniciat sessió',
        labelEmail: 'Email',
        labelPass: 'Contrasenya',
        labelRole: 'Rol',
        btnSaveNick: 'Desar nom visible',
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
        iaUseDocs: 'Usar documents com a coneixement exclusiu',
        iaDocsHint: 'Quan executes aquest prompt a la IA, et demanarà adjuntar els documents. No puges res ací: adjunta els fitxers allí i les preguntes es generaran exclusivament a partir d\'aquests documents.',
        iaLang: 'Idioma del qüestionari',
        iaNum: 'Nombre de preguntes',
        iaExtra: 'Instruccions addicionals',
        iaTypesLabel: 'Tipus de pregunta',
        iaTypeQuiz: 'Quiz (1 correcta)',
        iaTypeMultiple: 'Resposta múltiple',
        iaTypeTf: 'Vertader / Fals',
        btnGenPrompt: 'Generar prompt',
        btnCopyPrompt: 'Copiar prompt',
        promptPlaceholder: 'El prompt apareixerà aquí...',
        iaCsvLabel: 'Contingut CSV generat per la IA',
        btnPreviewCsv: 'Vista prèvia',
        btnOpenCsv: 'Obrir CSV',
        btnDownloadCsv: 'Descarregar CSV',
        btnEditCreator: 'Editar al creador',
        previewTitle: 'Vista prèvia',
        alertPasteCsv: 'Enganxa primer el CSV.',
        alertNothingToSave: 'No hi ha res a guardar.',
        btnImportIa: 'Importar CSV al qüestionari',
        kahootTitle: 'Importar Kahoot públic',
        kahootHelp: 'Enganxa la URL o l\'ID d\'un Kahoot públic.',
        btnImportKahoot: 'Importar des de Kahoot',
        importEyebrow: 'Importació',
        importTitle: 'Importar qüestionari (CSV o Kahoot públic)',
        importDesc: 'Puja un fitxer CSV amb les teves preguntes per desar-lo a la biblioteca.',
        btnUploadCsv: 'Pujar CSV',
        libraryEyebrow: 'Biblioteca',
        libraryTitle: 'Qüestionaris importats',
        libraryDesc: 'Selecciona un qüestionari per hostatjar-lo o gestiona el seu nom i estat.',
        searchPlaceholder: 'Cerca per nom o etiqueta',
        suggestedTags: 'Etiquetes usades (toca per filtrar)',
        noFilters: 'Sense filtres',
        filterBy: 'Filtrant per: ',
        filterMine: 'Només els meus qüestionaris',
        sortLabel: 'Ordenar per',
        sortNewest: 'Els més recents primer',
        sortOldest: 'Els més antics primer',
        sortAlphaAsc: 'Alfabètic A-Z',
        sortAlphaDesc: 'Alfabètic Z-A',
        playsShort: 'partides',
        playersShort: 'jugadors',
        paginationPrev: 'Anterior',
        paginationNext: 'Següent',
        paginationPageInfo: 'Pàgina {current} de {total}',
        play: 'Iniciar qüestionari',
        edit: 'Editar',
        download: 'Descarregar CSV',
        editQuiz: 'Editar qüestionari',
        exportMoodleXml: 'Exportar XML (Moodle)',
        rename: 'Reanomenar',
        delete: 'Eliminar',
        clone: 'Fer una còpia',
        renamePrompt: 'Nom nou',
        confirmDelete: 'Eliminar aquest quiz?',
        cannotStartPrivate: 'Només el propietari pot usar un quiz privat.',
        needLogin: 'Inicia sessió per realitzar aquesta acció.',
        permissionDenied: 'No tens permís per realitzar aquesta acció.',
        saveSharing: 'Desar permisos',
        allowClone: 'Permetre que altres en facin una còpia',
        visibilityPrivate: 'Només jo (privat)',
        visibilityUnlisted: 'Per enllaç/ID',
        visibilityPublic: 'Públic',
        creatorUnknown: 'Creador desconegut',
        creatorHidden: 'Creador',
        labelNick: 'Nom visible (opcional)',
        noGames: 'Encara no hi ha qüestionaris.',
        noGamesHint: 'Puja un CSV o crea\'n un per veure\'l aquí.',
        importSuccess: 'Importat',
        importing: 'Important...',
        uploadCsv: 'Pujant...',
        uploadCsvError: 'No s\'ha pogut importar el CSV.',
        startNow: 'Inicia ara',
        createUserMissing: 'Introdueix email i contrasenya.',
        createUserWorking: 'Creant usuari...',
        createUserOk: 'Usuari creat.',
        createUserError: 'No s\'ha pogut crear.',
        savingNick: 'Desant nom visible...',
        nickSaved: 'Nom visible actualitzat.',
        nickSaveError: 'No s\'ha pogut desar.',
        loginError: 'Error en iniciar sessió.',
        loginWait: 'Iniciant sessió...',
        loginOk: 'Sessió iniciada.',
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
        namePlaceholder: 'Nom del quiz (opcional)',
        selectCsv: 'Selecciona un fitxer CSV.',
        downloadCsvError: 'No s\'ha pogut descarregar el CSV.',
        renameError: 'No s\'ha pogut reanomenar.',
        deleteError: 'No s\'ha pogut eliminar.',
        sharingError: 'No s\'han pogut desar els permisos.',
        gameSingular: 'qüestionari',
        gamePlural: 'qüestionaris',
        idLabel: 'ID',
        footerLicense: 'EduHoot · Llicència Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)',
        importError: 'Error en importar.',
        emailPlaceholder: 'el teu correu',
        authNickPlaceholder: 'El teu nick públic',
        resetTokenPlaceholder: 'token del correu/log',
        iaLevelPlaceholder: 'Ex: 2n ESO',
        iaTopicPlaceholder: 'Ex: Energia i calor',
        iaLangCustomPlaceholder: 'Un altre idioma',
        iaExtraPlaceholder: 'To, nivell cognitiu, format...',
        iaCsvPlaceholder: 'Enganxa aquí el CSV retornat per la IA',
        kahootUrlPlaceholder: 'URL o ID (p. ex. https://create.kahoot.it/details/... o 01234567)',
        visibilityHelp: '<strong>Només jo:</strong> si no inicies sessió, el quiz es desa només a la teva sessió i caduca en 24h.<br><strong>Per enllaç / Públic:</strong> encara que no tinguis compte, es desa globalment al servidor i sobreviu a reinicis. Si inicies sessió, queda lligat al teu usuari. Pots permetre o no les còpies.',
        langEs: 'Espanyol',
        langEn: 'Anglès',
        langCa: 'Català',
        optSpanish: 'Espanyol',
        optCatalan: 'Català',
        optEnglish: 'Anglès',
        optOther: 'Un altre'
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
            var textNode = Array.from(el.childNodes).find(function(node){
                if(node.nodeType === Node.TEXT_NODE && node.textContent.trim()){
                    return true;
                }
                if(node.nodeType === Node.ELEMENT_NODE && !['INPUT','SELECT','TEXTAREA'].includes(node.tagName)){
                    return true;
                }
                return false;
            });
            if(textNode){
                if(textNode.nodeType === Node.TEXT_NODE){
                    textNode.textContent = t(key) + ' ';
                }else{
                    textNode.textContent = t(key);
                }
            }else{
                var span = document.createElement('span');
                span.textContent = t(key);
                el.insertBefore(span, el.firstChild);
            }
            return;
        }
        if(key === 'subtitle' || key === 'promptPlaceholder' || key === 'visibilityHelp'){
            el.innerHTML = t(key);
        }else{
            el.textContent = t(key);
        }
    });
    var authEmail = document.getElementById('auth-email');
    if(authEmail) authEmail.placeholder = t('emailPlaceholder');
    var authPass = document.getElementById('auth-pass');
    if(authPass) authPass.placeholder = '••••••••';
    var authNick = document.getElementById('auth-nick');
    if(authNick) authNick.placeholder = t('authNickPlaceholder');
    var resetEmail = document.getElementById('reset-email');
    if(resetEmail) resetEmail.placeholder = t('emailPlaceholder');
    var resetToken = document.getElementById('reset-token');
    if(resetToken) resetToken.placeholder = t('resetTokenPlaceholder');
    var resetPass = document.getElementById('reset-pass');
    if(resetPass) resetPass.placeholder = '••••••••';
    var newUserEmail = document.getElementById('new-user-email');
    if(newUserEmail) newUserEmail.placeholder = t('emailPlaceholder');
    var newUserPass = document.getElementById('new-user-pass');
    if(newUserPass) newUserPass.placeholder = '••••••••';
    var newUserNick = document.getElementById('new-user-nick');
    if(newUserNick) newUserNick.placeholder = t('authNickPlaceholder');
        var resetAdminEmail = document.getElementById('reset-admin-email');
        if(resetAdminEmail) resetAdminEmail.placeholder = t('emailPlaceholder');
        var resetAdminPass = document.getElementById('reset-admin-pass');
        if(resetAdminPass) resetAdminPass.placeholder = '••••••••';
        var iaName = document.getElementById('ia-name');
    if(iaName) iaName.placeholder = t('namePlaceholder');
    var iaNivel = document.getElementById('ia-nivel');
    if(iaNivel) iaNivel.placeholder = t('iaLevelPlaceholder');
    var iaTema = document.getElementById('ia-tema');
    if(iaTema) iaTema.placeholder = t('iaTopicPlaceholder');
    var iaLangCustom = document.getElementById('ia-idioma-custom');
    if(iaLangCustom) iaLangCustom.placeholder = t('iaLangCustomPlaceholder');
    var iaExtra = document.getElementById('ia-extra');
    if(iaExtra) iaExtra.placeholder = t('iaExtraPlaceholder');
    var iaCsv = document.getElementById('ia-csv');
    if(iaCsv) iaCsv.placeholder = t('iaCsvPlaceholder');
    var csvName = document.getElementById('csv-name');
    if(csvName) csvName.placeholder = t('namePlaceholder');
    var kahootUrl = document.getElementById('kahoot-url');
    if(kahootUrl) kahootUrl.placeholder = t('kahootUrlPlaceholder');
    var langSelect = document.getElementById('lang-select');
    if(langSelect) langSelect.value = lang;
    var libSearch = document.getElementById('library-search');
    if(libSearch && i18n[lang] && i18n[lang].searchPlaceholder) libSearch.placeholder = t('searchPlaceholder');
}

function setLang(newLang){
    lang = newLang;
    localStorage.setItem('lang', lang);
    applyStaticTranslations();
    renderTagSuggestions();
    socket.emit('requestDbNames');
}

function fetchWithFilters(){
    var query = '';
    libraryCurrentPage = 1;
    if(currentFilters.tags.length){
        var parts = currentFilters.tags.map(function(t){ return 'tags=' + encodeURIComponent(t); });
        query = '?' + parts.join('&');
    }
    try{
        var localIds = JSON.parse(localStorage.getItem('localQuizzes') || '[]');
        if(localIds.length){
            query += (query ? '&' : '?') + 'localIds=' + localIds.join(',');
        }
    }catch(e){}
    if(currentFilters.mineOnly){
        query += (query ? '&' : '?') + 'mine=1';
    }
    var headers = {};
    var anonToken = getAnonOwnerToken();
    if(anonToken){
        headers['X-Owner-Token'] = anonToken;
    }
    fetch('/api/quizzes' + query, { headers: headers })
        .then(function(res){ return res.json(); })
        .then(function(data){
            libraryLatestData = data || [];
            renderTagSuggestions();
            renderGames(libraryLatestData);
        })
        .catch(function(){
            libraryLatestData = [];
            renderTagSuggestions();
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
    renderTagSuggestions();
    fetchWithFilters();
}

function renderTagSuggestions(){
    var wrap = document.getElementById('tag-suggestions');
    if(!wrap) return;
    wrap.innerHTML = '';
    var tagsToShow;
    var tagSource;
    if(currentFilters.tags.length){
        tagSource = currentDisplayedQuizzes;
        tagsToShow = getTagsFromLibraryData(tagSource);
    }else if(currentFilters.mineOnly){
        tagSource = libraryLatestData;
        tagsToShow = getTagsFromLibraryData(tagSource);
    }else{
        tagSource = libraryLatestData;
        tagsToShow = knownTags;
    }
    if(!tagsToShow.length){
        return;
    }
    var freqMap = getTagFrequencies(tagSource);
    var freqValues = Object.keys(freqMap).map(function(k){ return freqMap[k]; });
    var maxFreq = freqValues.length ? Math.max.apply(null, freqValues) : 1;
    var normalizedMax = Math.max(1, maxFreq);
    var label = document.createElement('span');
    label.className = 'label';
    label.textContent = t('suggestedTags');
    wrap.appendChild(label);
    tagsToShow.forEach(function(tag){
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tag' + (currentFilters.tags.indexOf(tag) !== -1 ? ' active' : '');
        btn.textContent = tag;
        var tagCount = freqMap[tag] || 0;
        var normalizedWeight = normalizedMax ? Math.min(1, tagCount / normalizedMax) : 0;
        btn.style.setProperty('--tag-weight', normalizedWeight);
        btn.setAttribute('data-weight', normalizedWeight.toFixed(2));
        btn.onclick = function(){ toggleTagFilter(tag); };
        wrap.appendChild(btn);
    });
}

var mineFilter = document.getElementById('filter-mine');
if(mineFilter){
    mineFilter.addEventListener('change', function(){
        currentFilters.mineOnly = mineFilter.checked;
        renderTagSuggestions();
        fetchWithFilters();
    });
}

var librarySearch = document.getElementById('library-search');
if(librarySearch){
    librarySearch.addEventListener('input', function(){
        currentFilters.search = librarySearch.value || '';
        fetchWithFilters();
    });
}

var librarySortSelect = document.getElementById('library-sort');
if(librarySortSelect){
    librarySortSelect.value = currentSort;
    librarySortSelect.addEventListener('change', function(){
        currentSort = librarySortSelect.value;
        libraryCurrentPage = 1;
        renderGames(libraryLatestData);
    });
}

var paginationPrevBtn = document.getElementById('library-pagination-prev');
if(paginationPrevBtn){
    paginationPrevBtn.addEventListener('click', function(){
        if(libraryCurrentPage <= 1) return;
        libraryCurrentPage -= 1;
        renderGames(libraryLatestData);
    });
}
var paginationNextBtn = document.getElementById('library-pagination-next');
if(paginationNextBtn){
    paginationNextBtn.addEventListener('click', function(){
        if(libraryCurrentPage >= libraryTotalPages) return;
        libraryCurrentPage += 1;
        renderGames(libraryLatestData);
    });
}

function fetchTags(){
    var headers = {};
    var anonToken = getAnonOwnerToken();
    if(anonToken){
        headers['X-Owner-Token'] = anonToken;
    }
    return fetch('/api/tags', { credentials: 'include', headers: headers })
        .then(function(res){ return res.json(); })
        .then(function(data){
            knownTags = Array.isArray(data.tags) ? data.tags : [];
            renderTagSuggestions();
        })
        .catch(function(){
            knownTags = [];
            renderTagSuggestions();
        });
}

function renderGames(data){
    var div = document.getElementById('game-list');
    var count = document.getElementById('game-count');
    var filterInfo = document.getElementById('filter-info');
    if(!div) return;

    var sourceData = data || libraryLatestData;
    libraryLatestData = sourceData || [];

    div.innerHTML = '';
    var quizzes = [];
    var entries = sourceData || {};
    var entriesLength = Object.keys(entries).length;
    for(var i = 0; i < entriesLength; i++){
        quizzes.push(entries[i]);
    }

    if(currentFilters.search && currentFilters.search.trim()){
        var ql = currentFilters.search.trim().toLowerCase();
        quizzes = quizzes.filter(function(q){
            var name = (q.name || '').toLowerCase();
            var tags = Array.isArray(q.tags) ? q.tags.map(function(t){ return (t || '').toLowerCase(); }) : [];
            var matchName = name.includes(ql);
            var matchTag = tags.some(function(t){ return t.includes(ql); });
            return matchName || matchTag;
        });
    }
    currentDisplayedQuizzes = quizzes.slice();

    quizzes = sortLibraryQuizzes(quizzes);

    if(count){
        var singular = t('gameSingular');
        var plural = t('gamePlural');
        count.textContent = quizzes.length + ' ' + (quizzes.length === 1 ? singular : plural);
    }
    if(filterInfo){
        var parts = [];
        if(currentFilters.tags.length){
            parts.push(t('filterBy') + currentFilters.tags.join(', '));
        }
        if(currentFilters.mineOnly){
            parts.push(t('filterMine'));
        }
        filterInfo.textContent = parts.length ? parts.join(' · ') : t('noFilters');
    }

    var totalQuizzes = quizzes.length;
    libraryTotalPages = Math.max(1, Math.ceil(totalQuizzes / LIBRARY_PAGE_SIZE));
    if(libraryCurrentPage > libraryTotalPages){
        libraryCurrentPage = libraryTotalPages;
    }
    if(libraryCurrentPage < 1){
        libraryCurrentPage = 1;
    }

    if(totalQuizzes === 0){
        var empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.innerHTML = '<p>'+t('noGames')+'</p><p>'+t('noGamesHint')+'</p>';
        div.appendChild(empty);
        libraryCurrentPage = 1;
        libraryTotalPages = 1;
        updatePaginationControls(false);
        return;
    }

    var startIndex = (libraryCurrentPage - 1) * LIBRARY_PAGE_SIZE;
    var pageQuizzes = quizzes.slice(startIndex, startIndex + LIBRARY_PAGE_SIZE);
    updatePaginationControls(libraryTotalPages > 1);

    pageQuizzes.forEach(function(quiz){
        var card = document.createElement('div');
        card.className = 'game-card';

        var head = document.createElement('div');
        head.className = 'game-card-head';

        var title = document.createElement('div');
        title.className = 'game-title';
        title.textContent = quiz.name || 'Quiz sin nombre';

        var badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = (t('idLabel') || 'ID') + ' ' + quiz.id;

        head.appendChild(title);
        head.appendChild(badge);

        var subtitle = document.createElement('p');
        subtitle.className = 'game-subtitle';
        subtitle.textContent = '';

        var meta = document.createElement('div');
        meta.className = 'game-meta';
        var visibilityLabel = quiz.visibility === 'private' ? t('visibilityPrivate') : (quiz.visibility === 'unlisted' ? t('visibilityUnlisted') : t('visibilityPublic'));
        var creatorText = quiz.ownerNickname ? quiz.ownerNickname : t('creatorUnknown');
        meta.textContent = creatorText + ' · ' + visibilityLabel;
        if(quiz.sourceQuizId){
            meta.textContent += ' · ' + (lang === 'en' ? 'Based on ' : (lang === 'ca' ? 'Basat en ' : 'Basado en ')) + 'ID ' + quiz.sourceQuizId;
        }
        var stats = document.createElement('div');
        stats.className = 'game-stats';
        var plays = quiz.playsCount || 0;
        var players = quiz.playersCount || 0;
        var statPlays = document.createElement('span');
        statPlays.className = 'game-stats__item';
        statPlays.textContent = plays + ' ' + t('playsShort');
        var statPlayers = document.createElement('span');
        statPlayers.className = 'game-stats__item';
        statPlayers.textContent = players + ' ' + t('playersShort');
        stats.appendChild(statPlays);
        stats.appendChild(statPlayers);

        var canEdit = false;
        if(authState.user){
            if(authState.user.role === 'admin') canEdit = true;
            else if(!quiz.ownerId) canEdit = true;
            else if(authState.user.id && quiz.ownerId && authState.user.id === quiz.ownerId.toString()) canEdit = true;
        }else if(ownsLocal(quiz.id)){
            canEdit = true;
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
        playBtn.onclick = function(){
            if(!canStart){
                warnNoPermission(t('cannotStartPrivate'));
                return;
            }
            startGame(quiz.id);
        };
        if(!canStart) playBtn.title = t('cannotStartPrivate');

        var editBtn = document.createElement('button');
        editBtn.className = 'btn btn-ghost icon-only';
        editBtn.innerHTML = '✏️';
        editBtn.title = t('edit');
        editBtn.onclick = function(){
            if(!canEdit){
                warnNoPermission(authState.user ? t('permissionDenied') : t('needLogin'));
                return;
            }
            window.location.href = '/create/quiz-creator/?id=' + quiz.id;
        };

        var downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn btn-ghost icon-only';
        downloadBtn.innerHTML = '⬇️';
        downloadBtn.title = t('download');
        downloadBtn.onclick = function(){
            downloadCsv(quiz.id);
        };

        var moodleXmlBtn = document.createElement('button');
        moodleXmlBtn.className = 'btn btn-ghost icon-only';
        var moodleIcon = document.createElement('img');
        moodleIcon.src = '/icons/moodle.png';
        moodleIcon.alt = 'Moodle';
        moodleIcon.className = 'moodle-icon-img';
        moodleXmlBtn.appendChild(moodleIcon);
        moodleXmlBtn.title = t('exportMoodleXml');
        moodleXmlBtn.onclick = function(){
            downloadMoodleXml(quiz.id);
        };

        var deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-danger icon-only';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = t('delete');
        deleteBtn.onclick = function(){
            if(!canEdit){
                warnNoPermission(authState.user ? t('permissionDenied') : t('needLogin'));
                return;
            }
            if(confirm(t('confirmDelete'))){
                deleteQuiz(quiz.id);
            }
        };

        actions.appendChild(playBtn);
        actions.appendChild(editBtn);
        actions.appendChild(downloadBtn);
        actions.appendChild(moodleXmlBtn);

        var cloneBtn = document.createElement('button');
        cloneBtn.className = 'btn btn-ghost icon-only';
        cloneBtn.innerHTML = '📄';
        cloneBtn.title = t('clone');
        cloneBtn.onclick = function(){
            if(!canClone){
                warnNoPermission(authState.user ? t('permissionDenied') : t('needLogin'));
                return;
            }
            cloneQuiz(quiz.id);
        };
        actions.appendChild(cloneBtn);
        actions.appendChild(deleteBtn);

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
        shareBtn.onclick = function(){
            if(!canEdit){
                warnNoPermission(authState.user ? t('permissionDenied') : t('needLogin'));
                return;
            }
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
        card.appendChild(stats);
        card.appendChild(tagWrap);
        card.appendChild(share);
        card.appendChild(actions);
        div.appendChild(card);
    });
}

function updatePaginationControls(visible){
    var pagination = document.getElementById('library-pagination');
    if(!pagination) return;
    pagination.classList.toggle('hidden', !visible);
    var info = document.getElementById('library-pagination-info');
    if(info){
        var template = t('paginationPageInfo');
        info.textContent = template.replace('{current}', libraryCurrentPage).replace('{total}', libraryTotalPages);
    }
    var prevBtn = document.getElementById('library-pagination-prev');
    var nextBtn = document.getElementById('library-pagination-next');
    if(prevBtn){
        prevBtn.disabled = libraryCurrentPage <= 1;
    }
    if(nextBtn){
        nextBtn.disabled = libraryCurrentPage >= libraryTotalPages;
    }
}

function startGame(data){
    window.location.href="/host/" + "?id=" + data;
}

async function renameQuiz(id, name){
    try{
        var headers = { 'Content-Type': 'application/json' };
        if(getAnonOwnerToken()){
            headers['X-Owner-Token'] = getAnonOwnerToken();
        }
        var res = await fetch('/api/quizzes/' + id, {
            method: 'PATCH',
            headers: headers,
            credentials: 'include',
            body: JSON.stringify({ name: name })
        });
        var result = await res.json();
        if(!res.ok){
            alert(result.error || t('renameError') || t('saveError'));
            return;
        }
        socket.emit('requestDbNames');
    }catch(err){
        alert(t('renameError') || t('saveError'));
    }
}

async function deleteQuiz(id){
    try{
        var headers = {};
        if(getAnonOwnerToken()){
            headers['X-Owner-Token'] = getAnonOwnerToken();
        }
        var res = await fetch('/api/quizzes/' + id, { method: 'DELETE', credentials: 'include', headers: headers });
        var result = await res.json();
        if(!res.ok){
            alert(result.error || t('deleteError'));
            return;
        }
        socket.emit('requestDbNames');
    }catch(err){
        alert(t('deleteError'));
    }
}

async function updateSharing(id, visibility, allowClone){
    try{
        var headers = { 'Content-Type': 'application/json' };
        if(getAnonOwnerToken()){
            headers['X-Owner-Token'] = getAnonOwnerToken();
        }
        var res = await fetch('/api/quizzes/' + id + '/sharing', {
            method: 'PATCH',
            headers: headers,
            credentials: 'include',
            body: JSON.stringify({ visibility: visibility, allowClone: allowClone })
        });
        var result = await res.json();
        if(!res.ok){
            alert(result.error || t('sharingError') || t('saveError'));
            return;
        }
        if(result.migrated && result.id){
            try{
                var stored = JSON.parse(localStorage.getItem('localQuizzes') || '[]');
                var idx = stored.indexOf(id);
                if(idx !== -1){
                    stored.splice(idx, 1);
                }
                if(stored.indexOf(result.id) === -1){
                    stored.push(result.id);
                }
                localStorage.setItem('localQuizzes', JSON.stringify(stored));
            }catch(e){}
        }
        socket.emit('requestDbNames');
    }catch(err){
        alert(t('sharingError') || t('saveError'));
    }
}

async function cloneQuiz(id){
    if(!authState.user){
        alert(t('notLogged'));
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
            alert(result.error || t('cloneError'));
            return;
        }
        alert(t('cloneOk'));
        socket.emit('requestDbNames');
    }catch(err){
        alert(t('cloneError'));
    }
}

function downloadCsv(id){
    fetch('/api/quizzes/' + id + '/csv')
        .then(function(res){
            if(!res.ok){
                    return res.json().then(function(body){
                    alert((body && body.error) || t('downloadCsvError'));
                    throw new Error('Download failed');
                }).catch(function(){
                    alert(t('downloadCsvError'));
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

function downloadMoodleXml(id){
    fetch('/api/quizzes/' + id + '/moodle-xml', { credentials: 'include' })
        .then(function(res){
            if(!res.ok){
                return res.json().then(function(body){
                    alert((body && body.error) || t('downloadCsvError'));
                    throw new Error('Download failed');
                }).catch(function(){
                    alert(t('downloadCsvError'));
                    throw new Error('Download failed');
                });
            }
            var fileName = 'quiz-' + id + '.xml';
            var disposition = res.headers.get('Content-Disposition') || '';
            var match = disposition.match(/filename=\"?([^\";]+)\"?/i);
            if(match && match[1]) fileName = match[1];
            return res.blob().then(function(blob){
                var url = window.URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = fileName;
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
            status.textContent = t('selectCsv');
            return;
        }

        var formData = new FormData();
        formData.append('file', fileInput.files[0]);
        if (nameInput.value && nameInput.value.trim()) {
            formData.append('name', nameInput.value.trim());
        }

        status.textContent = t('uploadCsv');
        try {
            var response = await fetch('/api/upload-csv', {
                method: 'POST',
                body: formData
            });
            var result = await response.json();
            if (!response.ok) {
                status.textContent = result.error || t('uploadCsvError');
                return;
            }
            status.innerHTML = t('importSuccess') + ': ' + result.name + ' (' + result.count + ') ';
            var startBtn = document.createElement('button');
            startBtn.textContent = t('startNow') || t('play');
            startBtn.onclick = function() { startGame(result.id); };
            status.appendChild(startBtn);
            csvForm.reset();
        } catch (err) {
            status.textContent = t('uploadCsvError');
        }
    });
}

// --- Generador IA ---
function buildPrompt(params){
    var idioma = params.idioma === 'otro' && params.idiomaCustom ? params.idiomaCustom : params.idioma;
    var tipos = Array.isArray(params.tipos) && params.tipos.length ? params.tipos : ['quiz'];
    var useDocs = !!params.useDocs;
    var tema = useDocs ? '' : (params.tema || '');
    var prompt = {
        objetivo: "Generar un cuestionario en CSV con separador ';' siguiendo el formato: tipo;pregunta;r1;r2;r3;r4;tiempo;correcta;imagen;video",
        nivel: params.nivel || '',
        tema: tema,
        idioma: idioma || 'Español',
        numero_preguntas: params.num,
        tipos: tipos,
        usar_documentos: useDocs,
        instrucciones: params.extra || '',
        notas: [
            "Usa el punto y coma ';' como separador.",
            "Columna 'tipo': usa uno de: quiz | multiple | true-false.",
            "Columna 'correcta': índice (1-4). Si es múltiple, usa lista separada por comas (ej: 1,3).",
            "Si 'usar_documentos' es true, genera las preguntas SOLO a partir de los documentos adjuntos en la IA (no inventes contenido fuera de ellos).",
            "Columna 'imagen': solo URLs de imagen (png/jpg/webp).",
            "Columna 'video': URLs de vídeo (YouTube/Vimeo/MP4). Si hay vídeo, deja 'imagen' vacía.",
            "Tiempo: en segons (ex: 20)."
        ]
    };
    return JSON.stringify(prompt, null, 2);
}

function getSelectedIaTypes(){
    var selected = [];
    var quiz = document.getElementById('ia-type-quiz');
    var multiple = document.getElementById('ia-type-multiple');
    var tf = document.getElementById('ia-type-tf');
    if(quiz && quiz.checked) selected.push('quiz');
    if(multiple && multiple.checked) selected.push('multiple');
    if(tf && tf.checked) selected.push('true-false');
    if(!selected.length) selected.push('quiz');
    return selected;
}

function buildIaTags(){
    var tags = new Set();
    function addTag(text){
        var clean = (text || '').toString().trim().toLowerCase();
        if(clean) tags.add(clean);
    }
    function addFromList(text){
        (text || '').split(/[,;]+/).forEach(function(part){
            addTag(part);
        });
    }
    var temaVal = document.getElementById('ia-tema') ? document.getElementById('ia-tema').value : '';
    var nivelVal = document.getElementById('ia-nivel') ? document.getElementById('ia-nivel').value : '';
    var nameVal = document.getElementById('ia-name') ? document.getElementById('ia-name').value : '';
    addFromList(temaVal);
    addFromList(nivelVal);
    addFromList(nameVal);
    // combos derivats
    var composed = [];
    if(temaVal && nivelVal) composed.push(nivelVal + ' ' + temaVal);
    composed.push('ia-' + (temaVal || '').replace(/\s+/g, '-'));
    composed.push('nivel-' + (nivelVal || '').replace(/\s+/g, '-'));
    composed.forEach(addTag);
    var idiomaVal = '';
    if(iaIdioma){
        idiomaVal = iaIdioma.value === 'otro' && iaIdiomaCustom ? iaIdiomaCustom.value : iaIdioma.value;
    }
    addTag(idiomaVal);
    addTag('generado-ia');
    return Array.from(tags).filter(Boolean).slice(0, 8);
}

var iaGenerate = document.getElementById('ia-generate');
var iaCopy = document.getElementById('ia-copy');
var iaPrompt = document.getElementById('ia-prompt');
var iaIdioma = document.getElementById('ia-idioma');
var iaIdiomaCustom = document.getElementById('ia-idioma-custom');
var iaUseDocs = document.getElementById('ia-use-docs');
var iaDocsHint = document.getElementById('ia-docs-hint');
var iaTema = document.getElementById('ia-tema');

// --- Auth modal ---
var authModal = document.getElementById('auth-modal');
var openAuthBtn = document.getElementById('open-auth');

function openAuthModal(){
    if(!authModal) return;
    authModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    try{ if(authEmail) authEmail.focus(); }catch(e){}
}

function closeAuthModal(){
    if(!authModal) return;
    authModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
}

function warnNoPermission(message){
    var msg = message || t('permissionDenied');
    if(authMsg){
        authMsg.textContent = msg;
        if(!authState.user) openAuthModal();
        return;
    }
    try{ window.alert(msg); }catch(e){}
}

function updateTopAuthButton(){
    if(!openAuthBtn) return;
    if(authState && authState.user){
        openAuthBtn.setAttribute('data-i18n', 'btnLogout');
        openAuthBtn.textContent = t('btnLogout');
    }else{
        openAuthBtn.setAttribute('data-i18n', 'btnLogin');
        openAuthBtn.textContent = t('btnLogin');
    }
}

if(openAuthBtn){
    openAuthBtn.addEventListener('click', function(){
        if(authState && authState.user){
            logout();
            return;
        }
        openAuthModal();
    });
}

if(authModal){
    authModal.querySelectorAll('[data-modal-close]').forEach(function(el){
        el.addEventListener('click', function(){
            closeAuthModal();
        });
    });
}

document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && authModal && !authModal.classList.contains('hidden')){
        closeAuthModal();
    }
});

// --- Auth ---
var authEmail = document.getElementById('auth-email');
var authPass = document.getElementById('auth-pass');
var authNick = document.getElementById('auth-nick');
var authStatus = document.getElementById('auth-status');
var authMsg = document.getElementById('auth-message');
var authLoginBtn = document.getElementById('auth-login');
var authLogoutBtn = document.getElementById('auth-logout');
var authSaveNickBtn = document.getElementById('auth-save-nick');
var adminPanel = document.getElementById('user-admin');
var newUserEmail = document.getElementById('new-user-email');
var newUserPass = document.getElementById('new-user-pass');
var newUserRole = document.getElementById('new-user-role');
var newUserNick = document.getElementById('new-user-nick');
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
    if(authStatus){
        if(authState.user){
            var nickPart = authState.user.nickname ? ' · ' + authState.user.nickname : '';
            authStatus.textContent = authState.user.email + nickPart + ' (' + authState.user.role + ')';
            authStatus.classList.remove('pill-muted');
        }else{
            authStatus.textContent = t('authStatus');
            authStatus.classList.add('pill-muted');
        }
    }
    if(adminPanel){
        if(authState.user && authState.user.role === 'admin'){
            adminPanel.classList.remove('hidden');
        }else{
            adminPanel.classList.add('hidden');
        }
    }

    updateTopAuthButton();
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
    var nick = authNick ? authNick.value.trim() : '';
    authMsg.textContent = t('loginWait');
    fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email, password: pass, nickname: nick })
    }).then(async function(res){
        var body = {};
        try { body = await res.json(); } catch(e){}
        if(!res.ok){
            authMsg.textContent = body.error || t('loginError');
            return;
        }
        authMsg.textContent = t('loginOk') || t('authStatus');
        authPass.value = '';
        if(authNick) authNick.value = '';
        closeAuthModal();
        reconnectSocket();
        fetchMe();
    }).catch(function(){
        authMsg.textContent = t('loginError');
    });
}

function logout(){
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
        .then(function(){
            authState.user = null;
            updateAuthUI();
            closeAuthModal();
            reconnectSocket();
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
    var nick = newUserNick ? newUserNick.value.trim() : '';
    if(!email || !pass){
        if(createUserStatus) createUserStatus.textContent = t('createUserMissing') || t('resetNeedFields');
        return;
    }
    if(createUserStatus) createUserStatus.textContent = t('createUserWorking') || t('resetWaiting');
    try{
        var res = await fetch('/api/auth/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email: email, password: pass, role: role, nickname: nick })
        });
        var body = {};
        try { body = await res.json(); } catch(e){}
        if(!res.ok){
            if(createUserStatus) createUserStatus.textContent = body.error || t('createUserError') || t('resetUpdateError');
            return;
        }
        if(createUserStatus) createUserStatus.textContent = t('createUserOk') || t('saveOk');
        newUserEmail.value = '';
        newUserPass.value = '';
    }catch(err){
        if(createUserStatus) createUserStatus.textContent = t('createUserError') || t('resetUpdateError');
    }
}

async function saveNickname(){
    if(!authState.user) return;
    if(!authNick) return;
    var nick = authNick.value.trim();
    authMsg.textContent = t('savingNick') || t('resetWaiting');
    try{
        var res = await fetch('/api/auth/profile', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ nickname: nick })
        });
        var body = {};
        try { body = await res.json(); } catch(e){}
        if(!res.ok){
            authMsg.textContent = body.error || t('nickSaveError') || t('resetUpdateError');
            return;
        }
        authMsg.textContent = t('nickSaved') || t('saveOk');
        fetchMe();
    }catch(err){
        authMsg.textContent = t('nickSaveError') || t('resetUpdateError');
    }
}
async function resetPasswordAsAdmin(){
    if(!authState.user || authState.user.role !== 'admin') return;
    if(!resetAdminEmail || !resetAdminPass) return;
    var email = resetAdminEmail.value.trim();
    var pass = resetAdminPass.value;
    if(!email || !pass){
        if(resetAdminStatus) resetAdminStatus.textContent = t('resetNeedFields');
        return;
    }
    if(resetAdminStatus) resetAdminStatus.textContent = t('resetUpdating');
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
            if(resetAdminStatus) resetAdminStatus.textContent = body.error || t('resetUpdateError');
            return;
        }
        if(resetAdminStatus) resetAdminStatus.textContent = t('resetUpdated');
        resetAdminPass.value = '';
    }catch(err){
        if(resetAdminStatus) resetAdminStatus.textContent = t('resetUpdateError');
    }
}

if(authLoginBtn){
    authLoginBtn.addEventListener('click', login);
}
if(authEmail){
    authEmail.addEventListener('keydown', function(e){
        if(e.key === 'Enter'){
            e.preventDefault();
            login();
        }
    });
}
if(authPass){
    authPass.addEventListener('keydown', function(e){
        if(e.key === 'Enter'){
            e.preventDefault();
            login();
        }
    });
}
if(authNick){
    authNick.addEventListener('keydown', function(e){
        if(e.key === 'Enter'){
            e.preventDefault();
            login();
        }
    });
}
if(authLogoutBtn){
    authLogoutBtn.addEventListener('click', logout);
}
if(createUserBtn){
    createUserBtn.addEventListener('click', createUser);
}
if(authSaveNickBtn){
    authSaveNickBtn.addEventListener('click', saveNickname);
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
            if(resetStatus) resetStatus.textContent = t('labelEmail');
            return;
        }
        if(resetStatus) resetStatus.textContent = t('resetWaiting');
        try{
            var res = await fetch('/api/auth/request-reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email })
            });
            await res.json().catch(function(){});
            if(resetStatus) resetStatus.textContent = t('resetTokenSent');
        }catch(err){
            if(resetStatus) resetStatus.textContent = t('resetTokenError');
        }
    });
}
if(resetConfirmBtn){
    resetConfirmBtn.addEventListener('click', async function(){
        if(!resetToken || !resetPass) return;
        var token = resetToken.value.trim();
        var pass = resetPass.value;
        if(!token || !pass){
            if(resetStatus) resetStatus.textContent = t('resetNeedFields');
            return;
        }
        if(resetStatus) resetStatus.textContent = t('resetUpdating');
        try{
            var res = await fetch('/api/auth/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: token, password: pass })
            });
            var body = {};
            try { body = await res.json(); } catch(e){}
            if(!res.ok){
                if(resetStatus) resetStatus.textContent = body.error || t('resetUpdateError');
                return;
            }
            if(resetStatus) resetStatus.textContent = t('resetUpdated');
            resetPass.value = '';
            resetToken.value = '';
        }catch(err){
            if(resetStatus) resetStatus.textContent = t('resetUpdateError');
        }
    });
}

// Start auth check on load
fetchMe();
fetchTags();

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

function applyIaDocsMode(){
    if(!iaUseDocs) return;
    var active = !!iaUseDocs.checked;
    if(iaDocsHint) iaDocsHint.classList.toggle('hidden', !active);
    if(iaTema){
        iaTema.disabled = active;
        if(active) iaTema.value = '';
    }
}

if(iaUseDocs){
    try{
        iaUseDocs.checked = localStorage.getItem('eduh_ia_use_docs') === '1';
    }catch(e){}
    applyIaDocsMode();
    iaUseDocs.addEventListener('change', function(){
        try{ localStorage.setItem('eduh_ia_use_docs', iaUseDocs.checked ? '1' : '0'); }catch(e){}
        applyIaDocsMode();
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
            extra: document.getElementById('ia-extra').value.trim(),
            tipos: getSelectedIaTypes(),
            useDocs: iaUseDocs ? iaUseDocs.checked : false
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
var iaPreviewBtn = document.getElementById('ia-preview');
var iaOpenBtn = document.getElementById('ia-open');
var iaDownloadBtn = document.getElementById('ia-download');
var iaEditBtn = document.getElementById('ia-edit');
var iaCsvFile = document.getElementById('ia-csv-file');
var iaPreviewBox = document.getElementById('ia-preview-box');
var iaPreviewContent = document.getElementById('ia-preview-content');

var lastIaUploadedQuizId = null;

function normalizeCsvForDownload(csvText){
    var text = (csvText || '').trim();
    if(!text) return '';
    var header = 'Tipo;Pregunta;R1;R2;R3;R4;Tiempo;Correcta;URL Imagen';
    if(!text.toLowerCase().includes('tipo;pregunta')){
        text = header + '\n' + text;
    }
    return text;
}

function parseCsvLines(csvText){
    var text = (csvText || '').trim();
    if(!text) return [];
    var regex = /"((?:[^"]|"")*)"|([^;]+)/g;
    var linesRaw = text.split(/\r?\n/);
    var headerIndex = -1;
    for(var i=0;i<linesRaw.length;i++){
        if((linesRaw[i] || '').toLowerCase().includes('tipo;pregunta')){ headerIndex = i; break; }
    }
    var lines = headerIndex !== -1 ? linesRaw.slice(headerIndex + 1) : linesRaw;
    var out = [];
    lines.forEach(function(line){
        var l = (line || '').trim();
        if(!l) return;
        var fields = Array.from(l.matchAll(regex), function(m){
            return (m[1] ? m[1].replace(/""/g, '"') : (m[2] || '')).trim();
        });
        if(fields.length < 8) return;
        out.push({
            tipo: fields[0],
            pregunta: fields[1],
            respuestas: fields.slice(2, 6),
            tiempo: fields[6],
            correcta: fields[7]
        });
    });
    return out;
}

function renderIaPreview(csvText){
    if(!iaPreviewBox || !iaPreviewContent) return;
    var questions = parseCsvLines(csvText);
    iaPreviewContent.innerHTML = '';
    if(!questions.length){
        iaPreviewContent.textContent = t('alertPasteCsv');
        iaPreviewBox.classList.remove('hidden');
        return;
    }
    questions.forEach(function(q, idx){
        var card = document.createElement('div');
        card.className = 'ia-preview__q';
        var title = document.createElement('div');
        title.className = 'ia-preview__qtitle';
        title.textContent = (idx + 1) + '. ' + (q.pregunta || '');
        card.appendChild(title);
        var list = document.createElement('div');
        list.className = 'ia-preview__answers';
        var correctIdx = [];
        (q.correcta || '').split(',').forEach(function(n){
            var i = parseInt(String(n).trim(), 10);
            if(!isNaN(i)) correctIdx.push(i - 1);
        });
        q.respuestas.forEach(function(a, i){
            if(!a) return;
            var row = document.createElement('div');
            row.className = 'ia-preview__answer' + (correctIdx.indexOf(i) !== -1 ? ' is-correct' : '');
            var bullet = document.createElement('span');
            bullet.className = 'ia-preview__bullet';
            bullet.textContent = (correctIdx.indexOf(i) !== -1 ? '✓' : '•');
            var txt = document.createElement('span');
            txt.className = 'ia-preview__text';
            txt.textContent = a;
            row.appendChild(bullet);
            row.appendChild(txt);
            list.appendChild(row);
        });
        card.appendChild(list);
        iaPreviewContent.appendChild(card);
    });
    iaPreviewBox.classList.remove('hidden');
}

if(iaPreviewBtn){
    iaPreviewBtn.addEventListener('click', function(){
        var csvText = document.getElementById('ia-csv') ? document.getElementById('ia-csv').value : '';
        renderIaPreview(csvText);
    });
}

if(iaOpenBtn && iaCsvFile){
    iaOpenBtn.addEventListener('click', function(){ iaCsvFile.click(); });
    iaCsvFile.addEventListener('change', function(e){
        var file = e.target.files && e.target.files[0];
        if(!file) return;
        var reader = new FileReader();
        reader.onload = function(ev){
            var ta = document.getElementById('ia-csv');
            if(ta) ta.value = String(ev.target.result || '');
            if(iaPreviewBox) iaPreviewBox.classList.add('hidden');
        };
        reader.readAsText(file, 'UTF-8');
        e.target.value = '';
    });
}

if(iaDownloadBtn){
    iaDownloadBtn.addEventListener('click', function(){
        var csvText = document.getElementById('ia-csv') ? document.getElementById('ia-csv').value : '';
        var normalized = normalizeCsvForDownload(csvText);
        if(!normalized){
            alert(t('alertNothingToSave'));
            return;
        }
        var blob = new Blob(['\uFEFF' + normalized], { type: 'text/csv;charset=utf-8;' });
        var url = window.URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'quiz.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    });
}

if(iaEditBtn){
    iaEditBtn.addEventListener('click', function(){
        if(!lastIaUploadedQuizId) return;
        window.location.href = 'quiz-creator/?id=' + encodeURIComponent(lastIaUploadedQuizId);
    });
}

if (iaUpload) {
    iaUpload.addEventListener('click', async function(){
        var status = document.getElementById('ia-status');
        var csvText = document.getElementById('ia-csv').value.trim();
        var quizName = document.getElementById('ia-name').value.trim();
        if (!csvText) {
            status.textContent = t('selectCsv');
            return;
        }
        status.textContent = t('importing');
        if(iaEditBtn) iaEditBtn.disabled = true;
        lastIaUploadedQuizId = null;
        try{
            var blob = new Blob([csvText], { type: 'text/csv' });
            var file = new File([blob], 'ia.csv', { type: 'text/csv' });
            var formData = new FormData();
            formData.append('file', file);
            if (quizName) formData.append('name', quizName);
            formData.append('ownerToken', getAnonOwnerToken());
            var iaTags = buildIaTags();
            iaTags.forEach(function(tag){
                formData.append('tags', tag);
            });

            var response = await fetch('/api/upload-csv', { method: 'POST', body: formData });
            var result = await response.json();
            if (!response.ok) {
                status.textContent = result.error || t('uploadCsvError');
                return;
            }
            status.textContent = t('importSuccess') + ': ' + result.name + ' (' + result.count + ')';
            if (result.id) {
                lastIaUploadedQuizId = result.id;
                if(iaEditBtn) iaEditBtn.disabled = false;
                var startBtn = document.createElement('button');
                startBtn.className = 'btn btn-primary';
                startBtn.textContent = t('play');
                startBtn.style.marginLeft = '8px';
                startBtn.onclick = function(){ startGame(result.id); };
                status.appendChild(startBtn);
                try{
                    var stored = JSON.parse(localStorage.getItem('localQuizzes') || '[]');
                    if(result.local){
                        if(stored.indexOf(result.id) === -1){
                            stored.push(result.id);
                            localStorage.setItem('localQuizzes', JSON.stringify(stored));
                        }
                    }
                }catch(e){}
            }
            currentFilters.tags = [];
            socket.emit('requestDbNames');
            fetchWithFilters();
        }catch(err){
            status.textContent = t('uploadCsvError');
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

function reconnectSocket(){
    try{
        socket.disconnect();
        socket.connect();
    }catch(e){}
}

// Importar Kahoot públic
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
        var raw = kahootUrlInput.value.trim();
        var payload = {
            visibility: kahootVisSelect ? kahootVisSelect.value : 'public',
            ownerToken: getAnonOwnerToken()
        };
        if(/^https?:\/\//i.test(raw)) payload.url = raw;
        else payload.id = raw;

        var submitBtn = kahootForm.querySelector('button[type="submit"]');
        if(submitBtn) submitBtn.disabled = true;
        if(kahootStatus) kahootStatus.textContent = t('importing');
    try{
        var res = await fetch('/api/import/kahoot', {
            method: 'POST',
            headers: (function(){
                var base = { 'Content-Type': 'application/json' };
                var token = getAnonOwnerToken();
                if(token) base['X-Owner-Token'] = token;
                return base;
            })(),
            body: JSON.stringify(payload)
        });
        var body = {};
        try { body = await res.json(); } catch(e){}
        if(!res.ok){
                if(kahootStatus) kahootStatus.textContent = body.error || t('importError');
                if(submitBtn) submitBtn.disabled = false;
                return;
            }
            if(kahootStatus){
                kahootStatus.innerHTML = t('importSuccess') + ': ' + (body.name || '') + ' (' + body.count + ') ';
                var btn = document.createElement('button');
                btn.textContent = t('play');
                btn.onclick = function(){ startGame(body.id); };
                btn.className = 'btn btn-primary btn-small';
                kahootStatus.appendChild(btn);
                if(body.id){
                    var editBtn = document.createElement('button');
                    editBtn.textContent = t('editQuiz');
                    editBtn.className = 'btn btn-ghost btn-small';
                    editBtn.onclick = function(){ window.location.href = '/create/quiz-creator/?id=' + body.id; };
                    kahootStatus.appendChild(editBtn);
                }
            }
            if(submitBtn) submitBtn.disabled = false;
            if(body.id){
                try{
                    var stored = JSON.parse(localStorage.getItem('localQuizzes') || '[]');
                    if(stored.indexOf(body.id) === -1){
                        stored.push(body.id);
                        localStorage.setItem('localQuizzes', JSON.stringify(stored));
                    }
                }catch(e){}
            }
            socket.emit('requestDbNames');
        }catch(err){
            if(kahootStatus) kahootStatus.textContent = t('importError');
            if(submitBtn) submitBtn.disabled = false;
        }
    });
}
