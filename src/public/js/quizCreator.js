var socket = null;
try{
    if(typeof io !== 'undefined'){
        socket = io();
    }
}catch(e){
    socket = null;
}
var questionNum = 0; // Se incrementa cuando se añaden tarjetas
var editingId = null;
var browserLang = (navigator.language || 'es').slice(0,2);
var lang = localStorage.getItem('lang') || (['es','en','ca'].includes(browserLang) ? browserLang : 'es');
var knownTags = [];
var isUserAuthenticated = false;
var moodleExportPendingQuiz = null;
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
        publicWarning: 'Al publicar el quiz se guardará como parte de la biblioteca global y no podrás editarlo después sin sesión.',
        allowCloneLabel: 'Permitir que otras personas hagan una copia',
        suggestedTags: 'Etiquetas usadas (toca para añadir)',
        questionsEyebrow: 'Preguntas',
        questionsTitle: 'Construye las preguntas',
        questionsDesc: 'Añade 4 posibles respuestas y marca la correcta (1-4).',
        addQuestion: '+ Añadir pregunta',
        btnSave: 'Guardar quiz',
        btnPlayLocal: 'Jugar sin guardar',
        btnExportCsv: 'Exportar CSV',
        btnExportMoodleXml: 'Exportar XML (Moodle)',
        btnCancel: 'Cancelar y volver',
        localInfo: 'Sin sesión: “Guardar” o “Jugar sin guardar” crean un quiz anónimo. Si es Solo yo caduca en 24h; Por enlace/Público se guarda globalmente. Con sesión se guarda en tu usuario.',
        questionLabel: 'Enunciado',
        answerLabel: 'Respuesta',
        correctLabel: 'Respuesta correcta (1-4)',
        questionTypeLabel: 'Modo de pregunta',
        questionTypeSingle: 'Quiz (1 correcta)',
        questionTypeMultiple: 'Respuesta múltiple',
        questionTypeTf: 'Verdadero / Falso',
        questionTypeMultiHint: 'Marca todas las respuestas correctas.',
        imageLabel: 'Imagen (URL opcional)',
        videoLabel: 'Video (URL opcional)',
        namePlaceholder: 'Ej: Repaso de energía',
        tagsPlaceholder: 'ej: física, 2ºESO, energía',
        urlPlaceholder: 'https://...',
        playErrorName: 'Ponle un nombre',
        playErrorTags: 'Añade al menos una etiqueta',
        playErrorQuestions: 'Añade preguntas',
        loadError: 'No se pudo cargar el quiz.',
        saveError: 'No se pudo guardar el quiz.',
        saveOk: 'Quiz actualizado',
        confirmCancel: '¿Seguro que quieres salir? Se perderán los cambios.',
        moodleModalTitle: 'Importar en Moodle',
        moodleModalDescription: 'Revisa estos pasos antes de descargar el XML para subirlo a tu curso.',
        moodleModalStep1: 'Accede al curso de Moodle donde quieres importar el quiz.',
        moodleModalStep2: 'Ve a Administración del curso > Importar y selecciona el tipo "Moodle XML".',
        moodleModalStep3: 'Sube el archivo descargado y sigue el asistente para confirmar las preguntas.',
        moodleModalCancel: 'Cerrar',
        moodleModalConfirm: 'Descargar XML'
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
        publicWarning: 'Public quizzes become part of the global library and cannot be edited later unless you sign in.',
        allowCloneLabel: 'Allow others to make a copy',
        suggestedTags: 'Suggested tags (tap to add)',
        questionsEyebrow: 'Questions',
        questionsTitle: 'Build the questions',
        questionsDesc: 'Add 4 possible answers and mark the correct one (1-4).',
        addQuestion: '+ Add question',
        btnSave: 'Save quiz',
        btnPlayLocal: 'Play without saving',
        btnExportCsv: 'Export CSV',
        btnExportMoodleXml: 'Export Moodle XML',
        btnCancel: 'Cancel and go back',
        localInfo: 'Without session: “Save” or “Play without saving” create an anonymous quiz. "Only me" expires in 24h; "By link/Public" is stored globally. With session, it is saved to your user.',
        questionLabel: 'Question',
        answerLabel: 'Answer',
        correctLabel: 'Correct answer (1-4)',
        questionTypeLabel: 'Question mode',
        questionTypeSingle: 'Quiz (1 correct)',
        questionTypeMultiple: 'Multiple answers',
        questionTypeTf: 'True / False',
        questionTypeMultiHint: 'Check every answer that counts.',
        imageLabel: 'Image (optional URL)',
        videoLabel: 'Video (optional URL)',
        namePlaceholder: 'e.g. Energy review',
        tagsPlaceholder: 'e.g. physics, grade8, energy',
        urlPlaceholder: 'https://...',
        playErrorName: 'Give it a name',
        playErrorTags: 'Add at least one tag',
        playErrorQuestions: 'Add questions',
        loadError: 'Could not load quiz.',
        saveError: 'Could not save quiz.',
        saveOk: 'Quiz updated',
        confirmCancel: 'Are you sure? Changes will be lost.',
        moodleModalTitle: 'Import into Moodle',
        moodleModalDescription: 'Follow these steps before downloading the XML to upload it to your course.',
        moodleModalStep1: 'Open the Moodle course where you want to import the quiz.',
        moodleModalStep2: 'Go to Course administration > Import and choose "Moodle XML" as the source.',
        moodleModalStep3: 'Upload this file and follow the wizard to review questions and settings.',
        moodleModalCancel: 'Close',
        moodleModalConfirm: 'Download XML'
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
        publicWarning: 'Els quizzes públics passen a formar part de la biblioteca global i no es poden editar després sense iniciar sessió.',
        allowCloneLabel: 'Permetre que altres en facin una còpia',
        suggestedTags: 'Etiquetes usades (toca per afegir)',
        questionsEyebrow: 'Preguntes',
        questionsTitle: 'Construeix les preguntes',
        questionsDesc: 'Afegeix 4 respostes i marca la correcta (1-4).',
        addQuestion: '+ Afegir pregunta',
        btnSave: 'Desar quiz',
        btnPlayLocal: 'Jugar sense desar',
        btnExportCsv: 'Exportar CSV',
        btnExportMoodleXml: 'Exportar XML (Moodle)',
        btnCancel: 'Cancel·lar i tornar',
        localInfo: 'Sense sessió: “Desar” o “Jugar sense desar” creen un quiz anònim. "Només jo" caduca en 24h; "Per enllaç/Públic" es guarda globalment. Amb sessió, queda al teu usuari.',
        questionLabel: 'Enunciat',
        answerLabel: 'Resposta',
        correctLabel: 'Resposta correcta (1-4)',
        questionTypeLabel: 'Mode de pregunta',
        questionTypeSingle: 'Quiz (1 correcta)',
        questionTypeMultiple: 'Resposta múltiple',
        questionTypeTf: 'Cert / Fals',
        questionTypeMultiHint: 'Marca totes les respostes correctes.',
        imageLabel: 'Imatge (URL opcional)',
        videoLabel: 'Vídeo (URL opcional)',
        namePlaceholder: 'Ex: Repàs d\'energia',
        tagsPlaceholder: 'ex: física, 2nESO, energia',
        urlPlaceholder: 'https://...',
        playErrorName: 'Posa-li un nom',
        playErrorTags: 'Afegeix almenys una etiqueta',
        playErrorQuestions: 'Afegeix preguntes',
        loadError: 'No s\'ha pogut carregar el quiz.',
        saveError: 'No s\'ha pogut desar el quiz.',
        saveOk: 'Quiz actualitzat',
        confirmCancel: 'Segur que vols sortir? Es perdran els canvis.',
        moodleModalTitle: 'Importar a Moodle',
        moodleModalDescription: 'Segueix aquests passos abans de descarregar l\'XML per pujar-lo al teu curs.',
        moodleModalStep1: 'Accedeix al curs de Moodle on vols importar el quiz.',
        moodleModalStep2: 'Vés a Administració del curs > Importa i tria "Moodle XML".',
        moodleModalStep3: 'Carrega aquest fitxer i segueix l\'assistència per revisar les preguntes.',
        moodleModalCancel: 'Tancar',
        moodleModalConfirm: 'Descarregar XML'
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
    renderTagSuggestions();
}

function updateVisibilityWarning(){
    var warning = document.getElementById('public-warning');
    if(!warning) return;
    var visibilitySelect = document.getElementById('visibility');
    var show = false;
    if(visibilitySelect){
        var value = visibilitySelect.value;
        show = !isUserAuthenticated && value && value !== 'private';
    }
    warning.classList.toggle('hidden', !show);
}

function refreshAuthStatus(){
    fetch('/api/auth/me', { credentials: 'include' })
        .then(function(res){
            if(!res.ok) throw new Error();
            return res.json();
        })
        .then(function(){
            isUserAuthenticated = true;
            updateVisibilityWarning();
        })
        .catch(function(){
            isUserAuthenticated = false;
            updateVisibilityWarning();
        });
}

function updateDatabase(){
    var quiz = buildQuizPayload();
    quiz.id = editingId || 0;
    if(!validateQuizBasics(quiz)){
        return;
    }

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
            if(socket){
                socket.emit('newQuiz', quiz);
            }else{
                alert('No se pudo conectar con el servidor en tiempo real. Recarga la página e inténtalo de nuevo.');
            }
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
        var card = document.querySelector('.question-card[data-question="' + i + '"]');
        var typeEl = document.getElementById('type' + i);
        var questionType = typeEl ? typeEl.value : 'quiz';
        var correctValues = [];
        if(questionType === 'multiple' && card){
            var checkboxes = card.querySelectorAll('.multi-correct input[type="checkbox"]');
            checkboxes.forEach(function(cb){
                if(cb.checked){
                    var val = parseInt(cb.value, 10);
                    if(!Number.isNaN(val)){
                        correctValues.push(val);
                    }
                }
            });
        }
        if(!correctValues.length){
            var single = parseInt(correct, 10);
            if(Number.isNaN(single) || single < 1 || single > 4){
                single = 1;
            }
            correctValues.push(single);
        }
        var answers = [answer1, answer2, answer3, answer4];
        questions.push({
            "question": question,
            "answers": answers,
            "correct": correctValues[0],
            "correctAnswers": correctValues,
            "type": questionType,
            "image": image,
            "video": video
        });
    }
    return {
        name: name,
        tags: tags,
        visibility: visibility,
        allowClone: allowClone,
        questions: questions
    };
}

function validateQuizBasics(quiz){
    if(!quiz.name || !quiz.name.trim()){
        alert(t('playErrorName'));
        return false;
    }
    if(!quiz.tags || !quiz.tags.length){
        alert(t('playErrorTags'));
        return false;
    }
    if(!quiz.questions.length){
        alert(t('playErrorQuestions'));
        return false;
    }
    return true;
}

async function saveLocal(){
    var quiz = buildQuizPayload();
    if(!validateQuizBasics(quiz)){
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
        var type = q.type || 'quiz';
        var correctVals = Array.isArray(q.correctAnswers) && q.correctAnswers.length
            ? q.correctAnswers.join(',')
            : (q.correct || 1);
        function esc(v){
            if(v === undefined || v === null) return '';
            var s = String(v);
            if(s.indexOf(';') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0){
                return '"' + s.replace(/"/g, '""') + '"';
            }
            return s;
        }
        return [type, esc(q.question||''), esc(answers[0]||''), esc(answers[1]||''), esc(answers[2]||''), esc(answers[3]||''), esc(q.time||20), esc(correctVals), esc(q.image||''), esc(q.video||'')].join(';');
    });
    return [header].concat(lines).join('\n');
}

function escapeHtmlText(value){
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function escapeAttrValue(value){
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function wrapCdata(value){
    var str = String(value || '');
    var safe = str.replace(/]]>/g, ']]]]><![CDATA[>');
    return '<![CDATA[' + safe + ']]>';
}

function buildQuestionHtml(question){
    var parts = [];
    var text = (question.question || '').trim();
    if(text){
        parts.push('<p>' + escapeHtmlText(text) + '</p>');
    }
    if(question.image){
        parts.push('<p><img src="' + escapeAttrValue(question.image) + '" alt=""/></p>');
    }
    if(question.video){
        parts.push('<p><video controls="controls" preload="metadata" src="' + escapeAttrValue(question.video) + '"></video></p>');
    }
    return parts.join('');
}

function buildMoodleXml(quiz){
    var title = (quiz.name || 'EduHoot quiz').trim() || 'EduHoot quiz';
    var lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<quiz>'];
    var questions = Array.isArray(quiz.questions) ? quiz.questions : [];
    questions.forEach(function(question, index){
        lines.push('  <question type="multichoice">');
        lines.push('    <name><text>' + wrapCdata(title + ' pregunta ' + (index + 1)) + '</text></name>');
        var html = buildQuestionHtml(question) || '<p>' + escapeHtmlText(question.question || '') + '</p>';
        lines.push('    <questiontext format="html">');
        lines.push('      <text>' + wrapCdata(html) + '</text>');
        lines.push('    </questiontext>');
        lines.push('    <defaultgrade>1</defaultgrade>');
        lines.push('    <penalty>0.0</penalty>');
        lines.push('    <hidden>0</hidden>');
        lines.push('    <single>true</single>');
        lines.push('    <shuffleanswers>true</shuffleanswers>');
        lines.push('    <answernumbering>abc</answernumbering>');
        var answers = Array.isArray(question.answers) ? question.answers.slice(0,4) : [];
        while(answers.length < 4) answers.push('');
        var correctIndex = Math.max(0, Math.min(answers.length - 1, (parseInt(question.correct, 10) || 1) - 1));
        answers.forEach(function(answer, answerIndex){
            var fraction = answerIndex === correctIndex ? '100' : '0';
            lines.push('    <answer fraction="' + fraction + '" format="html">');
            lines.push('      <text>' + wrapCdata(escapeHtmlText(answer || '')) + '</text>');
            lines.push('      <feedback><text><![CDATA[]]></text></feedback>');
            lines.push('    </answer>');
        });
        lines.push('  </question>');
    });
    lines.push('</quiz>');
    return lines.join('\n');
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

function exportMoodleXml(){
    var quiz = buildQuizPayload();
    if(!quiz.questions.length){
        alert('Añade preguntas');
        return;
    }
    openMoodleExportModal(quiz);
}

function downloadMoodleXmlFile(quiz){
    var xml = buildMoodleXml(quiz);
    var blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (quiz.name || 'quiz') + '.xml';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function closeMoodleExportModal(){
    var modal = document.getElementById('moodleModal');
    if(!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    moodleExportPendingQuiz = null;
}

function openMoodleExportModal(quiz){
    moodleExportPendingQuiz = quiz;
    var modal = document.getElementById('moodleModal');
    if(!modal){
        downloadMoodleXmlFile(quiz);
        moodleExportPendingQuiz = null;
        return;
    }
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
}

function confirmMoodleExport(){
    if(moodleExportPendingQuiz){
        downloadMoodleXmlFile(moodleExportPendingQuiz);
    }
    closeMoodleExportModal();
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
    var removeBtn = document.createElement('button');
    removeBtn.className = 'btn btn-ghost btn-small';
    removeBtn.type = 'button';
    removeBtn.textContent = '✕';
    removeBtn.title = 'Eliminar';
    removeBtn.onclick = function(){
        var confirmMsg = lang === 'en' ? 'Delete this question?' : (lang === 'ca' ? 'Eliminar aquesta pregunta?' : '¿Eliminar esta pregunta?');
        if(window.confirm(confirmMsg)){
            card.remove();
            renumberQuestions();
        }
    };
    head.appendChild(removeBtn);

    var questionLabel = document.createElement('label');
    questionLabel.textContent = t('questionLabel');
    var questionField = document.createElement('textarea');
    questionField.className = 'question';
    questionField.id = 'q' + String(num);
    questionField.rows = 3;
    questionField.placeholder = '?';
    questionField.value = (data && data.question) || '';

    var typeRow = document.createElement('div');
    typeRow.className = 'question-type-row';
    var typeLabel = document.createElement('label');
    typeLabel.textContent = t('questionTypeLabel');
    var typeSelect = document.createElement('select');
    typeSelect.className = 'question-type';
    typeSelect.id = 'type' + String(num);
    [['quiz', 'questionTypeSingle'], ['multiple', 'questionTypeMultiple'], ['true-false', 'questionTypeTf']].forEach(function(pair){
        var option = document.createElement('option');
        option.value = pair[0];
        option.textContent = t(pair[1]);
        typeSelect.appendChild(option);
    });
    typeRow.appendChild(typeLabel);
    typeRow.appendChild(typeSelect);

    var answersWrap = document.createElement('div');
    answersWrap.className = 'answers';
    var answerGroups = [];
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
        answerGroups.push({ label: answerLabel, input: answerField });
    }

    var multiCorrect = document.createElement('div');
    multiCorrect.className = 'multi-correct hidden';
    var multiHint = document.createElement('p');
    multiHint.className = 'multi-correct__hint';
    multiHint.textContent = t('questionTypeMultiHint');
    multiCorrect.appendChild(multiHint);
    var multiCheckboxes = [];
    for(var m = 1; m <= 4; m++){
        var multiLabel = document.createElement('label');
        multiLabel.className = 'multi-correct__label';
        var multiInput = document.createElement('input');
        multiInput.type = 'checkbox';
        multiInput.value = String(m);
        multiInput.dataset.answer = String(m);
        multiLabel.appendChild(multiInput);
        multiLabel.append(' ' + t('answerLabel') + ' ' + m);
        multiCorrect.appendChild(multiLabel);
        multiCheckboxes.push(multiInput);
    }

    var correctLabel = document.createElement('label');
    correctLabel.textContent = t('correctLabel');
    var correctField = document.createElement('input');
    correctField.className = 'correct';
    correctField.id = 'correct' + String(num);
    correctField.type = 'number';
    correctField.min = '1';
    correctField.max = '4';
    var providedCorrect = (data && Array.isArray(data.correctAnswers) && data.correctAnswers.length)
        ? data.correctAnswers[0]
        : ((data && data.correct) ? data.correct : 1);
    correctField.value = providedCorrect;
    var initialType = (data && data.type) ? data.type : 'quiz';
    typeSelect.value = initialType;
    var initialCorrectAnswers = data && Array.isArray(data.correctAnswers) ? data.correctAnswers : [];
    multiCheckboxes.forEach(function(cb){
        cb.checked = initialCorrectAnswers.indexOf(parseInt(cb.value, 10)) !== -1;
    });
    function refreshTypeDependent(){
        var currentType = typeSelect.value;
        var showMultiple = currentType === 'multiple';
        var showTf = currentType === 'true-false';
        multiCorrect.classList.toggle('hidden', !showMultiple);
        correctLabel.style.display = showMultiple ? 'none' : '';
        answerGroups.forEach(function(group, idx){
            if(showTf && idx >= 2){
                group.label.style.display = 'none';
                group.input.value = '';
            }else{
                group.label.style.display = '';
            }
        });
    }
    typeSelect.addEventListener('change', refreshTypeDependent);
    refreshTypeDependent();

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
    var videoFrame = document.createElement('iframe');
    videoFrame.className = 'video-thumb hidden';
    videoFrame.allowFullscreen = true;
    videoFrame.loading = 'lazy';
    videoPreview.appendChild(videoTag);
    videoPreview.appendChild(videoFrame);

    imageField.addEventListener('input', function(){
        updateImagePreview(imageField, imageTag);
    });
    // set initial preview
    updateImagePreview(imageField, imageTag);
    videoField.addEventListener('input', function(){
        updateVideoPreview(videoField, videoTag, videoFrame);
    });
    updateVideoPreview(videoField, videoTag, videoFrame);

    card.appendChild(head);
    card.appendChild(questionLabel);
    card.appendChild(questionField);
    card.appendChild(typeRow);
    card.appendChild(answersWrap);
    card.appendChild(multiCorrect);
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

function updateVideoPreview(inputEl, videoEl, iframeEl){
    if(!inputEl || !videoEl) return;
    var url = (inputEl.value || '').trim();
    if(!url){
        videoEl.classList.add('hidden');
        videoEl.removeAttribute('src');
        videoEl.load();
        if(iframeEl){
            iframeEl.classList.add('hidden');
            iframeEl.removeAttribute('src');
        }
        return;
    }
    var ytId = parseYouTubeId(url);
    if(ytId && iframeEl){
        videoEl.classList.add('hidden');
        videoEl.removeAttribute('src');
        videoEl.pause();
        iframeEl.src = 'https://www.youtube-nocookie.com/embed/' + ytId;
        iframeEl.classList.remove('hidden');
    }else{
        if(iframeEl){
            iframeEl.classList.add('hidden');
            iframeEl.removeAttribute('src');
        }
        videoEl.src = url;
        videoEl.load();
        videoEl.onloadeddata = function(){ videoEl.classList.remove('hidden'); };
        videoEl.onerror = function(){ videoEl.classList.add('hidden'); };
    }
}

function parseYouTubeId(url){
    if(!url) return null;
    try{
        var u = new URL(url);
        if(u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')){
            if(u.hostname.includes('youtu.be')){
                return u.pathname.replace('/','');
            }
            if(u.searchParams.get('v')) return u.searchParams.get('v');
            var parts = u.pathname.split('/');
            var last = parts[parts.length-1];
            if(last) return last;
        }
    }catch(e){}
    return null;
}

function addQuestion(prefill){
    questionNum += 1;
    var questionsDiv = document.getElementById('allQuestions');
    var card = buildQuestionCard(questionNum, prefill);
    questionsDiv.appendChild(card);
    card.querySelector('.question').focus();
}

function renumberQuestions(){
    var cards = document.querySelectorAll('.question-card');
    questionNum = 0;
    cards.forEach(function(card, idx){
        var num = idx + 1;
        questionNum = num;
        card.setAttribute('data-question', String(num));
        var pill = card.querySelector('.pill');
        if(pill){
            pill.textContent = (lang === 'en' ? 'Question ' : (lang === 'ca' ? 'Pregunta ' : 'Pregunta ')) + String(num);
        }
        // update ids to keep order consistent
        var qField = card.querySelector('.question');
        if(qField) qField.id = 'q' + num;
        ['a1','a2','a3','a4'].forEach(function(suffix, idxAns){
            var inp = card.querySelector('input[id$="'+suffix+'"]');
            if(inp) inp.id = num + suffix;
        });
        var typeSelect = card.querySelector('.question-type');
        if(typeSelect) typeSelect.id = 'type' + num;
        var correct = card.querySelector('.correct');
        if(correct) correct.id = 'correct' + num;
        var img = card.querySelector('input[id^="img"]');
        if(img) img.id = 'img' + num;
        var vid = card.querySelector('input[id^="vid"]');
        if(vid) vid.id = 'vid' + num;
    });
}

//Called when user wants to exit quiz creator
function cancelQuiz(){
    if (confirm(t('confirmCancel'))) {
        window.location.href = "../";
    }
}

if(socket){
    socket.on('startGameFromCreator', function(data){
        window.location.href = "../../host/?id=" + data;
    });

    socket.on('quizValidationError', function(payload){
        var message = payload && payload.error ? payload.error : t('saveError');
        alert(message);
    });
}

async function saveExistingQuiz(id, quiz){
    try{
        var headers = { 'Content-Type': 'application/json' };
        try{
            var token = localStorage.getItem('anonOwnerToken');
            if(token) headers['X-Owner-Token'] = token;
        }catch(e){}
        var res = await fetch('/api/quizzes/' + id, {
            method: 'PUT',
            headers: headers,
            credentials: 'include',
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
        var res = await fetch('/api/quizzes/' + id, { credentials: 'include' });
        var quiz = await res.json();
        if(!res.ok){
            alert(quiz.error || t('loadError'));
            return;
        }
        editingId = quiz.id;
        document.getElementById('name').value = quiz.name || '';
        if(quiz.tags && quiz.tags.length){
            document.getElementById('tags').value = quiz.tags.join(', ');
            renderTagSuggestions();
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
        loadQuiz(idParam);
    }
}

initQuizCreator();
fetchKnownTags();

function parseTagsInput(){
    var raw = document.getElementById('tags') ? document.getElementById('tags').value : '';
    if(!raw) return [];
    return raw.split(',').map(function(t){ return t.trim().toLowerCase(); }).filter(function(t){ return t.length; });
}

function addTagToInput(tag){
    var input = document.getElementById('tags');
    if(!input) return;
    var tags = parseTagsInput();
    if(tags.indexOf(tag) !== -1) return;
    tags.push(tag);
    input.value = tags.join(', ');
}

function renderTagSuggestions(){
    var wrap = document.getElementById('tag-suggestions');
    if(!wrap) return;
    wrap.innerHTML = '';
    if(!knownTags.length){
        return;
    }
    var label = document.createElement('span');
    label.className = 'label';
    label.textContent = t('suggestedTags');
    wrap.appendChild(label);
    knownTags.forEach(function(tag){
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tag' + (parseTagsInput().indexOf(tag) !== -1 ? ' active' : '');
        btn.textContent = tag;
        btn.onclick = function(){ addTagToInput(tag); renderTagSuggestions(); };
        wrap.appendChild(btn);
    });
}

function setupMoodleExportModal(){
    var modal = document.getElementById('moodleModal');
    if(!modal) return;
    var confirmBtn = document.getElementById('moodleModalConfirm');
    var cancelBtn = document.getElementById('moodleModalCancel');
    if(confirmBtn){
        confirmBtn.type = 'button';
        confirmBtn.addEventListener('click', function(event){
            event.preventDefault();
            confirmMoodleExport();
        });
    }
    if(cancelBtn){
        cancelBtn.type = 'button';
        cancelBtn.addEventListener('click', function(event){
            event.preventDefault();
            closeMoodleExportModal();
        });
    }
    modal.addEventListener('click', function(event){
        if(event.target === modal){
            closeMoodleExportModal();
        }
    });
}

function fetchKnownTags(){
    return fetch('/api/tags', { credentials: 'include' })
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

var langSelector = document.getElementById('lang-select');
if(langSelector){
    langSelector.value = lang;
    langSelector.addEventListener('change', function(){
        lang = langSelector.value;
        localStorage.setItem('lang', lang);
        applyI18n();
    });
}
var tagsInputEl = document.getElementById('tags');
if(tagsInputEl){
    tagsInputEl.addEventListener('input', function(){
        renderTagSuggestions();
    });
}
var visibilitySelect = document.getElementById('visibility');
if(visibilitySelect){
    visibilitySelect.addEventListener('change', updateVisibilityWarning);
}
setupMoodleExportModal();
applyI18n();
updateVisibilityWarning();
refreshAuthStatus();
