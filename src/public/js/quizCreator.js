var socket = io();
var questionNum = 0; // Se incrementa cuando se añaden tarjetas
var editingId = null;
var lang = localStorage.getItem('lang') || 'es';
var i18n = {
    es: {
        back: 'Volver',
        title: 'Creador de quizzes',
        subtitle: 'Diseña las preguntas y guarda tu juego para lanzarlo cuando quieras.',
        langLabel: 'Idioma',
        configEyebrow: 'Configuración',
        configTitle: 'Datos del quiz',
        configDesc: 'Ponle un nombre para identificarlo en la biblioteca.',
        quizTitle: 'Título del quiz',
        tagsLabel: 'Etiquetas (separadas por comas)',
        visibilityLabel: 'Visibilidad del quiz',
        visibilityPrivate: 'Solo yo (privado)',
        visibilityUnlisted: 'Por enlace/ID',
        visibilityPublic: 'Público en la biblioteca',
        allowCloneLabel: 'Permitir que otras personas hagan una copia',
        questionsEyebrow: 'Preguntas',
        questionsTitle: 'Construye las preguntas',
        questionsDesc: 'Añade 4 posibles respuestas y marca la correcta (1-4).',
        addQuestion: '+ Añadir pregunta',
        btnSave: 'Guardar quiz',
        btnPlayLocal: 'Jugar sin guardar',
        btnExportCsv: 'Exportar CSV',
        btnCancel: 'Cancelar y volver',
        localInfo: 'Sin sesión: “Guardar” o “Jugar sin guardar” crean un quiz anónimo. Si es Solo yo caduca en 24h; Por enlace/Público se guarda globalmente. Con sesión se guarda en tu usuario.',
        questionLabel: 'Enunciado',
        answerLabel: 'Respuesta',
        correctLabel: 'Respuesta correcta (1-4)',
        imageLabel: 'Imagen (URL opcional)',
        videoLabel: 'Video (URL opcional)',
        namePlaceholder: 'Ej: Repaso de energía',
        tagsPlaceholder: 'ej: física, 2ºESO, energía',
        urlPlaceholder: 'https://...',
        playErrorName: 'Ponle un nombre',
        playErrorQuestions: 'Añade preguntas',
        loadError: 'No se pudo cargar el quiz.',
        saveError: 'No se pudo guardar el quiz.',
        saveOk: 'Quiz actualizado',
        confirmCancel: '¿Seguro que quieres salir? Se perderán los cambios.'
    },
    en: {
        back: 'Back',
        title: 'Quiz builder',
        subtitle: 'Design questions and save your game to launch whenever you want.',
        langLabel: 'Language',
        configEyebrow: 'Settings',
        configTitle: 'Quiz data',
        configDesc: 'Give it a name to identify it in the library.',
        quizTitle: 'Quiz title',
        tagsLabel: 'Tags (comma separated)',
        visibilityLabel: 'Quiz visibility',
        visibilityPrivate: 'Only me (private)',
        visibilityUnlisted: 'By link/ID',
        visibilityPublic: 'Public in library',
        allowCloneLabel: 'Allow others to make a copy',
        questionsEyebrow: 'Questions',
        questionsTitle: 'Build the questions',
        questionsDesc: 'Add 4 possible answers and mark the correct one (1-4).',
        addQuestion: '+ Add question',
        btnSave: 'Save quiz',
        btnPlayLocal: 'Play without saving',
        btnExportCsv: 'Export CSV',
        btnCancel: 'Cancel and go back',
        localInfo: 'Without session: “Save” or “Play without saving” create an anonymous quiz. "Only me" expires in 24h; "By link/Public" is stored globally. With session, it is saved to your user.',
        questionLabel: 'Question',
        answerLabel: 'Answer',
        correctLabel: 'Correct answer (1-4)',
        imageLabel: 'Image (optional URL)',
        videoLabel: 'Video (optional URL)',
        namePlaceholder: 'e.g. Energy review',
        tagsPlaceholder: 'e.g. physics, grade8, energy',
        urlPlaceholder: 'https://...',
        playErrorName: 'Give it a name',
        playErrorQuestions: 'Add questions',
        loadError: 'Could not load quiz.',
        saveError: 'Could not save quiz.',
        saveOk: 'Quiz updated',
        confirmCancel: 'Are you sure? Changes will be lost.'
    },
    ca: {
        back: 'Tornar',
        title: 'Creador de quizzes',
        subtitle: 'Dissenya les preguntes i desa el joc per llançar-lo quan vulguis.',
        langLabel: 'Idioma',
        configEyebrow: 'Configuració',
        configTitle: 'Dades del quiz',
        configDesc: 'Posa-li un nom per identificar-lo a la biblioteca.',
        quizTitle: 'Títol del quiz',
        tagsLabel: 'Etiquetes (separades per comes)',
        visibilityLabel: 'Visibilitat del quiz',
        visibilityPrivate: 'Només jo (privat)',
        visibilityUnlisted: 'Per enllaç/ID',
        visibilityPublic: 'Públic a la biblioteca',
        allowCloneLabel: 'Permetre que altres en facin una còpia',
        questionsEyebrow: 'Preguntes',
        questionsTitle: 'Construeix les preguntes',
        questionsDesc: 'Afegeix 4 respostes i marca la correcta (1-4).',
        addQuestion: '+ Afegir pregunta',
        btnSave: 'Desar quiz',
        btnPlayLocal: 'Jugar sense desar',
        btnExportCsv: 'Exportar CSV',
        btnCancel: 'Cancel·lar i tornar',
        localInfo: 'Sense sessió: “Desar” o “Jugar sense desar” creen un quiz anònim. "Només jo" caduca en 24h; "Per enllaç/Públic" es guarda globalment. Amb sessió, queda al teu usuari.',
        questionLabel: 'Enunciat',
        answerLabel: 'Resposta',
        correctLabel: 'Resposta correcta (1-4)',
        imageLabel: 'Imatge (URL opcional)',
        videoLabel: 'Vídeo (URL opcional)',
        namePlaceholder: 'Ex: Repàs d\'energia',
        tagsPlaceholder: 'ex: física, 2nESO, energia',
        urlPlaceholder: 'https://...',
        playErrorName: 'Posa-li un nom',
        playErrorQuestions: 'Afegeix preguntes',
        loadError: 'No s\'ha pogut carregar el quiz.',
        saveError: 'No s\'ha pogut desar el quiz.',
        saveOk: 'Quiz actualitzat',
        confirmCancel: 'Segur que vols sortir? Es perdran els canvis.'
    }
};

function t(key){
    return (i18n[lang] && i18n[lang][key]) || i18n.es[key] || key;
}

function applyI18n(){
    document.querySelectorAll('[data-i18n]').forEach(function(el){
        var key = el.getAttribute('data-i18n');
        // skip labels with form controls to avoid hiding inputs
        if(el.tagName === 'LABEL' && el.querySelector('input,select,textarea,textarea')){
            return;
        }
        if(key === 'subtitle' || key === 'localInfo'){
            el.innerHTML = t(key);
        }else{
            el.textContent = t(key);
        }
    });
    var nameInput = document.getElementById('name');
    if(nameInput) nameInput.placeholder = t('namePlaceholder');
    var tagsInput = document.getElementById('tags');
    if(tagsInput) tagsInput.placeholder = t('tagsPlaceholder');
    var langSelect = document.getElementById('lang-select');
    if(langSelect) langSelect.value = lang;
}

function updateDatabase(){
    var quiz = buildQuizPayload();
    quiz.id = editingId || 0;

    if(editingId){
        saveExistingQuiz(editingId, quiz);
        return;
    }

    // Si no hay sesión, guarda local y lanza
    fetch('/api/auth/me', { credentials: 'include' })
        .then(function(res){
            if(!res.ok) throw new Error();
            return res.json();
        })
        .then(function(){
            quiz.tags = quiz.tags || parseTagsInput();
            socket.emit('newQuiz', quiz);
        })
        .catch(function(){
            saveLocal();
        });
}

function buildQuizPayload(){
    var questions = [];
    var name = document.getElementById('name').value;
    var tags = parseTagsInput();
    var visibility = document.getElementById('visibility') ? document.getElementById('visibility').value : 'private';
    var allowClone = document.getElementById('allow-clone') ? document.getElementById('allow-clone').checked : false;
    for(var i = 1; i <= questionNum; i++){
        var question = document.getElementById('q' + i).value;
        var answer1 = document.getElementById(i + 'a1').value;
        var answer2 = document.getElementById(i + 'a2').value;
        var answer3 = document.getElementById(i + 'a3').value;
        var answer4 = document.getElementById(i + 'a4').value;
        var correct = document.getElementById('correct' + i).value;
        var image = document.getElementById('img' + i) ? document.getElementById('img' + i).value : '';
        var video = document.getElementById('vid' + i) ? document.getElementById('vid' + i).value : '';
        var answers = [answer1, answer2, answer3, answer4];
        questions.push({"question": question, "answers": answers, "correct": correct, "image": image, "video": video})
    }
    return {
        name: name,
        tags: tags,
        visibility: visibility,
        allowClone: allowClone,
        questions: questions
    };
}

async function saveLocal(){
    var quiz = buildQuizPayload();
    if(!quiz.name){
        alert(t('playErrorName'));
        return;
    }
    if(!quiz.questions.length){
        alert(t('playErrorQuestions'));
        return;
    }
    try{
        var res = await fetch('/api/quizzes/local', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: quiz.name,
                questions: quiz.questions,
                tags: quiz.tags,
                visibility: quiz.visibility,
                allowClone: quiz.allowClone
            })
        });
        var body = await res.json();
        if(!res.ok){
            alert(body.error || t('saveError'));
            return;
        }
        window.location.href = '../../host/?id=' + body.id;
    }catch(err){
        alert(t('saveError'));
    }
}

function quizToCsv(quiz){
    var header = ['tipo','pregunta','r1','r2','r3','r4','tiempo','correcta','imagen','video'].join(';');
    var lines = (quiz.questions || []).map(function(q){
        var answers = q.answers || [];
        function esc(v){
            if(v === undefined || v === null) return '';
            var s = String(v);
            if(s.indexOf(';') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0){
                return '"' + s.replace(/"/g, '""') + '"';
            }
            return s;
        }
        return ['quiz', esc(q.question||''), esc(answers[0]||''), esc(answers[1]||''), esc(answers[2]||''), esc(answers[3]||''), esc(q.time||20), esc(q.correct||1), esc(q.image||''), esc(q.video||'')].join(';');
    });
    return [header].concat(lines).join('\n');
}

function exportCsv(){
    var quiz = buildQuizPayload();
    if(!quiz.questions.length){
        alert('Añade preguntas');
        return;
    }
    var csv = quizToCsv(quiz);
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (quiz.name || 'quiz') + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function buildQuestionCard(num, data){
    var card = document.createElement('div');
    card.className = 'question-card';
    card.setAttribute('data-question', String(num));

    var head = document.createElement('div');
    head.className = 'question-card-head';
    var pill = document.createElement('span');
    pill.className = 'pill pill-muted';
    pill.textContent = (lang === 'en' ? 'Question ' : (lang === 'ca' ? 'Pregunta ' : 'Pregunta ')) + String(num);
    head.appendChild(pill);

    var questionLabel = document.createElement('label');
    questionLabel.textContent = t('questionLabel');
    var questionField = document.createElement('textarea');
    questionField.className = 'question';
    questionField.id = 'q' + String(num);
    questionField.rows = 3;
    questionField.placeholder = '?';
    questionField.value = (data && data.question) || '';

    var answersWrap = document.createElement('div');
    answersWrap.className = 'answers';
    for(var n = 1; n <= 4; n++){
        var answerLabel = document.createElement('label');
        answerLabel.textContent = t('answerLabel') + ' ' + n;
        var answerField = document.createElement('input');
        answerField.id = String(num) + 'a' + n;
        answerField.type = 'text';
        answerField.placeholder = t('answerLabel') + ' ' + n;
        var ans = data && data.answers && data.answers[n-1];
        answerField.value = ans || '';
        answerLabel.appendChild(answerField);
        answersWrap.appendChild(answerLabel);
    }

    var correctLabel = document.createElement('label');
    correctLabel.textContent = t('correctLabel');
    var correctField = document.createElement('input');
    correctField.className = 'correct';
    correctField.id = 'correct' + String(num);
    correctField.type = 'number';
    correctField.min = '1';
    correctField.max = '4';
    correctField.value = (data && data.correct) ? data.correct : '1';

    var imageLabel = document.createElement('label');
    imageLabel.textContent = t('imageLabel');
    var imageField = document.createElement('input');
    imageField.id = 'img' + String(num);
    imageField.type = 'text';
    imageField.placeholder = t('urlPlaceholder');
    imageField.value = (data && data.image) || '';

    var imagePreview = document.createElement('div');
    imagePreview.className = 'image-preview';
    var imageTag = document.createElement('img');
    imageTag.alt = 'Vista previa';
    imageTag.className = 'image-thumb hidden';
    imagePreview.appendChild(imageTag);

    var videoLabel = document.createElement('label');
    videoLabel.textContent = t('videoLabel');
    var videoField = document.createElement('input');
    videoField.id = 'vid' + String(num);
    videoField.type = 'text';
    videoField.placeholder = t('urlPlaceholder');
    videoField.value = (data && data.video) || '';
    var videoPreview = document.createElement('div');
    videoPreview.className = 'video-preview';
    var videoTag = document.createElement('video');
    videoTag.controls = true;
    videoTag.className = 'video-thumb hidden';
    videoPreview.appendChild(videoTag);

    imageField.addEventListener('input', function(){
        updateImagePreview(imageField, imageTag);
    });
    // set initial preview
    updateImagePreview(imageField, imageTag);
    videoField.addEventListener('input', function(){
        updateVideoPreview(videoField, videoTag);
    });
    updateVideoPreview(videoField, videoTag);

    card.appendChild(head);
    card.appendChild(questionLabel);
    card.appendChild(questionField);
    card.appendChild(answersWrap);
    card.appendChild(correctLabel);
    card.appendChild(correctField);
    card.appendChild(imageLabel);
    card.appendChild(imageField);
    card.appendChild(imagePreview);
    card.appendChild(videoLabel);
    card.appendChild(videoField);
    card.appendChild(videoPreview);

    return card;
}

function updateImagePreview(inputEl, imgEl){
    if(!inputEl || !imgEl) return;
    var url = (inputEl.value || '').trim();
    if(!url){
        imgEl.classList.add('hidden');
        imgEl.src = '';
        return;
    }
    imgEl.src = url;
    imgEl.onload = function(){ imgEl.classList.remove('hidden'); };
    imgEl.onerror = function(){ imgEl.classList.add('hidden'); };
}

function updateVideoPreview(inputEl, videoEl){
    if(!inputEl || !videoEl) return;
    var url = (inputEl.value || '').trim();
    if(!url){
        videoEl.classList.add('hidden');
        videoEl.removeAttribute('src');
        videoEl.load();
        return;
    }
    videoEl.src = url;
    videoEl.load();
    videoEl.onloadeddata = function(){ videoEl.classList.remove('hidden'); };
    videoEl.onerror = function(){ videoEl.classList.add('hidden'); };
}

function addQuestion(prefill){
    questionNum += 1;
    var questionsDiv = document.getElementById('allQuestions');
    var card = buildQuestionCard(questionNum, prefill);
    questionsDiv.appendChild(card);
    card.querySelector('.question').focus();
}

//Called when user wants to exit quiz creator
function cancelQuiz(){
    if (confirm(t('confirmCancel'))) {
        window.location.href = "../";
    }
}

socket.on('startGameFromCreator', function(data){
    window.location.href = "../../host/?id=" + data;
});

async function saveExistingQuiz(id, quiz){
    try{
        var res = await fetch('/api/quizzes/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: quiz.name,
                questions: quiz.questions,
                tags: quiz.tags,
                visibility: quiz.visibility,
                allowClone: quiz.allowClone
            })
        });
        var result = await res.json();
        if(!res.ok){
            alert(result.error || t('saveError'));
            return;
        }
        alert(t('saveOk'));
        window.location.href = '../';
    }catch(err){
        alert(t('saveError'));
    }
}

async function loadQuiz(id){
    try{
        var res = await fetch('/api/quizzes/' + id);
        var quiz = await res.json();
        if(!res.ok){
            alert(quiz.error || t('loadError'));
            return;
        }
        editingId = quiz.id;
        document.getElementById('name').value = quiz.name || '';
        if(quiz.tags && quiz.tags.length){
            document.getElementById('tags').value = quiz.tags.join(', ');
        }
        if(document.getElementById('visibility')){
            document.getElementById('visibility').value = quiz.visibility || 'public';
        }
        if(document.getElementById('allow-clone')){
            document.getElementById('allow-clone').checked = !!quiz.allowClone;
        }
        var container = document.getElementById('allQuestions');
        container.innerHTML = '';
        questionNum = 0;
        (quiz.questions || []).forEach(function(q){
            addQuestion(q);
        });
        if(questionNum === 0){
            addQuestion();
        }
        var subtitle = document.getElementById('subtitle');
        if(subtitle){
            subtitle.textContent = 'Editando quiz ID ' + id;
        }
    }catch(err){
        alert('No se pudo cargar el quiz.');
    }
}

function initQuizCreator(){
    addQuestion();
    var params = new URLSearchParams(window.location.search);
    var idParam = params.get('id');
    if(idParam){
        var numericId = parseInt(idParam, 10);
        if(!Number.isNaN(numericId)){
            loadQuiz(numericId);
        }
    }
}

initQuizCreator();

function parseTagsInput(){
    var raw = document.getElementById('tags') ? document.getElementById('tags').value : '';
    if(!raw) return [];
    return raw.split(',').map(function(t){ return t.trim().toLowerCase(); }).filter(function(t){ return t.length; });
}

var langSelector = document.getElementById('lang-select');
if(langSelector){
    langSelector.value = lang;
    langSelector.addEventListener('change', function(){
        lang = langSelector.value;
        localStorage.setItem('lang', lang);
        applyI18n();
    });
}
applyI18n();
