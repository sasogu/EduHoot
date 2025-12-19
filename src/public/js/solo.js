// Modo individual: listado de quizzes públicos + juego auto-dirigido con ranking global
(function(){
var state = {
        quizzes: [],
        currentQuiz: null,
        quizData: null,
        questions: [],
    desiredQuestionCount: null,
        page: 0,
        pageSize: 12,
        sortOrder: 'plays',
        idx: 0,
        score: 0,
        correct: 0,
        timer: null,
        timerTotal: 20,
        timerLeft: 20,
        locked: false,
        playerName: 'Anónimo',
        awaitingConfirm: false,
        lastWrong: null,
        multiSelections: []
};
var soloMusicPlayerInstance = null;
var SOLO_MUSIC_STORAGE_KEY = 'eduhoot-solo-music';
var SOLO_MUSIC_STORAGE_KEY_LEGACY = 'eduhook-solo-music';

function sortPublicQuizzes(list){
    if(!Array.isArray(list)) return list;
    return list.slice().sort(function(a, b){
        if(state.sortOrder === 'recent'){
            var ta = Date.parse(a && (a.createdAt || a.updatedAt)) || 0;
            var tb = Date.parse(b && (b.createdAt || b.updatedAt)) || 0;
            if(ta === tb) return Math.random() - 0.5;
            return tb - ta;
        }
        if(state.sortOrder === 'alpha'){
            var na = (a && a.name ? a.name : '').toLowerCase();
            var nb = (b && b.name ? b.name : '').toLowerCase();
            return na.localeCompare(nb);
        }
        if(state.sortOrder === 'alpha-desc'){
            var nda = (a && a.name ? a.name : '').toLowerCase();
            var ndb = (b && b.name ? b.name : '').toLowerCase();
            return ndb.localeCompare(nda);
        }
        var pa = a && typeof a.playsCount === 'number' ? a.playsCount : 0;
        var pb = b && typeof b.playsCount === 'number' ? b.playsCount : 0;
        if(state.sortOrder === 'least'){
            if(pa === pb) return Math.random() - 0.5;
            return pa - pb;
        }
        if(pa === pb){
            return Math.random() - 0.5;
        }
        return pb - pa;
    });
}

var browserLang = (navigator.language || 'es').slice(0,2);
    var lang = localStorage.getItem('lang') || (['es','en','ca'].includes(browserLang) ? browserLang : 'es');

    var i18n = {
        es: {
            back: 'Volver',
            eyebrow: 'Modo individual',
            title: 'EduHoot',
            subtitle: 'Elige un quiz público, responde las preguntas y entra en el ranking global. El Top 10 solo se muestra al final.',
            langLabel: 'Idioma',
            publicListEyebrow: 'Catálogo público',
            publicListTitle: 'Juegos públicos',
            publicListDesc: 'Solo se muestran quizzes públicos. Pulsa “Jugar en solitario” para arrancar.',
            searchPlaceholder: 'Buscar por nombre o etiqueta',
            sortLabel: 'Ordenar por',
            sortPlays: 'Más jugados',
            sortLeastPlays: 'Menos jugados',
            sortNewest: 'Más recientes',
            sortAlphaAsc: 'A-Z',
            sortAlphaDesc: 'Z-A',
            playsShort: 'partidas',
            playersShort: 'jugadores',
            soloEyebrow: 'Modo individual',
            soloTitle: 'Elige un juego para empezar',
            nameLabel: 'Tu nombre (opcional)',
            nameTitle: 'Identifícate para el ranking',
            nameDesc: 'Solo se pedirá si entras al Top 10. Usa 3 letras o números.',
            nameSave: 'Guardar',
            nameSkip: 'Omitir',
            namePlaceholder: 'AAA',
        questionCountLabel: 'Preguntas a responder',
        questionCountTotal: 'de {total}',
        startButton: 'Jugar en solitario',
        startHint: 'El tiempo por pregunta se respeta si el quiz lo define.',
        questionOf: 'Pregunta {current} de {total}',
        score: 'Puntos',
        timer: 'Tiempo',
        correctText: '¡Correcto!',
        wrongText: 'Respuesta incorrecta',
        correctLabel: 'Respuesta correcta:',
        timeup: 'Tiempo agotado',
        finishTitle: 'Partida terminada',
        playAgain: 'Repetir quiz',
        pickAnother: 'Elegir otro quiz',
        rankingTitle: 'Top 10 global',
            rankingHint: 'Solo se muestra al finalizar la partida.',
        resultSummary: 'Acertadas {correct}/{total} · {score} pts',
        publicEmpty: 'No hay juegos públicos disponibles.',
        loading: 'Cargando...',
        startSelect: 'Selecciona un juego público para empezar.',
        saving: 'Guardando puntuación...',
        rankingError: 'No se pudo cargar el ranking.',
        startError: 'No se pudo cargar el quiz.',
        playCta: 'Jugar en solitario',
        byline: 'Preguntas: {count}',
        scoreLabel: 'Puntos',
        timerLabel: 'Tiempo',
        selectedMeta: 'Preguntas: {count} · Etiquetas: {tags}',
        topName: 'Nombre',
        topScore: 'Puntos',
        bgMusicTitle: 'Música de fondo',
        bgMusicChoose: 'Elige un tema',
        bgMusicPlay: 'Reproducir música',
        bgMusicPause: 'Pausar música',
            bgMusicPrev: 'Anterior',
            bgMusicNext: 'Siguiente',
        bgMusicVolume: 'Volumen',
        viewRanking: 'Ver ranking',
        rankingClose: 'Cerrar ranking',
        rankingEmpty: 'Aún no hay puntuaciones.',
        submitAnswers: 'Enviar respuestas',
        footerLicense: 'EduHoot · Licencia Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)'
    },
        en: {
            back: 'Back',
            eyebrow: 'Solo mode',
            title: 'EduHoot',
            subtitle: 'Pick a public quiz, answer, and try to get into the global ranking. Top 10 only appears at the end.',
            langLabel: 'Language',
            publicListEyebrow: 'Public catalog',
            publicListTitle: 'Public games',
            publicListDesc: 'Only public quizzes are listed. Hit “Play solo” to start.',
            searchPlaceholder: 'Search by name or tag',
            sortLabel: 'Sort by',
            sortPlays: 'Most played',
            sortLeastPlays: 'Least played',
            sortNewest: 'Newest',
            sortAlphaAsc: 'A-Z',
            sortAlphaDesc: 'Z-A',
            playsShort: 'plays',
            playersShort: 'players',
            soloEyebrow: 'Solo mode',
            soloTitle: 'Pick a game to start',
            nameLabel: 'Your name (optional)',
            nameTitle: 'Set your name for the ranking',
            nameDesc: 'Only asked if you reach the Top 10. Use 3 letters or numbers.',
            nameSave: 'Save',
            nameSkip: 'Skip',
            namePlaceholder: 'AAA',
            questionCountLabel: 'Questions to answer',
            questionCountTotal: 'of {total}',
            startButton: 'Play solo',
            startHint: 'Per-question timers are respected if set on the quiz.',
            questionOf: 'Question {current} of {total}',
            score: 'Score',
            timer: 'Time',
            correctText: 'Correct!',
            wrongText: 'Wrong answer',
            correctLabel: 'Correct answer:',
            timeup: 'Time is up',
            finishTitle: 'Game finished',
            playAgain: 'Play again',
            pickAnother: 'Pick another quiz',
            rankingTitle: 'Global Top 10',
            rankingHint: 'Only visible after finishing.',
            resultSummary: 'Correct {correct}/{total} · {score} pts',
            publicEmpty: 'No public games available.',
            loading: 'Loading...',
            startSelect: 'Select a public game to start.',
            saving: 'Saving score...',
            rankingError: 'Could not load ranking.',
            startError: 'Could not load the quiz.',
            playCta: 'Play solo',
            byline: 'Questions: {count}',
            scoreLabel: 'Score',
            timerLabel: 'Time',
            selectedMeta: 'Questions: {count} · Tags: {tags}',
            topName: 'Name',
            topScore: 'Score',
            bgMusicTitle: 'Background music',
            bgMusicChoose: 'Choose a track',
            bgMusicPlay: 'Play music',
            bgMusicPause: 'Pause music',
            bgMusicPrev: 'Prev',
            bgMusicNext: 'Next',
            bgMusicVolume: 'Volume',
            viewRanking: 'View ranking',
            rankingClose: 'Close ranking',
            rankingEmpty: 'No rankings yet.',
            submitAnswers: 'Submit answers',
            footerLicense: 'EduHoot · Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)'
    },
        ca: {
            back: 'Tornar',
            eyebrow: 'Mode individual',
            title: 'EduHoot',
            subtitle: 'Tria un quiz públic, respon i entra al rànquing global. El Top 10 només surt al final.',
            langLabel: 'Idioma',
            publicListEyebrow: 'Catàleg públic',
            publicListTitle: 'Jocs públics',
            publicListDesc: 'Només es mostren quizzes públics. Prem “Jugar en solitari” per començar.',
            searchPlaceholder: 'Cerca per nom o etiqueta',
            sortLabel: 'Ordenar per',
            sortPlays: 'Més jugats',
            sortLeastPlays: 'Menys jugats',
            sortNewest: 'Més recents',
            sortAlphaAsc: 'A-Z',
            sortAlphaDesc: 'Z-A',
            playsShort: 'partides',
            playersShort: 'jugadors',
            soloEyebrow: 'Mode individual',
            soloTitle: 'Tria un joc per començar',
            nameLabel: 'El teu nom (opcional)',
            nameTitle: 'Identifica\'t per al rànquing',
            nameDesc: 'Només es demana si entres al Top 10. Usa 3 lletres o números.',
            nameSave: 'Desar',
            nameSkip: 'Ometre',
            namePlaceholder: 'AAA',
            questionCountLabel: 'Preguntes a respondre',
            questionCountTotal: 'de {total}',
            startButton: 'Jugar en solitari',
            startHint: 'El temps per pregunta es respecta si el quiz el defineix.',
            questionOf: 'Pregunta {current} de {total}',
            score: 'Punts',
            timer: 'Temps',
            correctText: 'Correcte!',
            wrongText: 'Resposta incorrecta',
            correctLabel: 'Resposta correcta:',
            timeup: 'Temps exhaurit',
            finishTitle: 'Partida acabada',
            playAgain: 'Tornar a jugar',
            pickAnother: 'Triar un altre quiz',
            rankingTitle: 'Top 10 global',
            rankingHint: 'Només es mostra al final.',
            resultSummary: 'Encerts {correct}/{total} · {score} pts',
            publicEmpty: 'No hi ha jocs públics disponibles.',
            loading: 'Carregant...',
            startSelect: 'Selecciona un joc públic per començar.',
            saving: 'Desant puntuació...',
            rankingError: 'No s\'ha pogut carregar el rànquing.',
            startError: 'No s\'ha pogut carregar el quiz.',
            playCta: 'Jugar en solitari',
            byline: 'Preguntes: {count}',
            scoreLabel: 'Punts',
            timerLabel: 'Temps',
            selectedMeta: 'Preguntes: {count} · Etiquetes: {tags}',
            topName: 'Nom',
            topScore: 'Punts',
            bgMusicTitle: 'Música de fons',
            bgMusicChoose: 'Tria una pista',
            bgMusicPlay: 'Reprodueix música',
            bgMusicPause: 'Atura la música',
            bgMusicPrev: 'Anterior',
            bgMusicNext: 'Següent',
            bgMusicVolume: 'Volum',
            viewRanking: 'Veure rànquing',
            rankingClose: 'Tancar rànquing',
            rankingEmpty: 'Encara no hi ha puntuacions.',
            submitAnswers: 'Enviar respostes',
            footerLicense: 'EduHoot · Llicència Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)'
        }
    };

    function t(key){
        return (i18n[lang] && i18n[lang][key]) || i18n.es[key] || key;
    }

    function format(str, data){
        if(!str) return '';
        return str.replace(/{(\w+)}/g, function(_, k){ return data[k] !== undefined ? data[k] : ''; });
    }

    function applyStaticText(){
        document.querySelectorAll('[data-i18n]').forEach(function(el){
            var key = el.getAttribute('data-i18n');
            if(i18n[lang] && i18n[lang][key]){
                el.textContent = t(key);
            }
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el){
            var key = el.getAttribute('data-i18n-placeholder');
            if(i18n[lang] && i18n[lang][key]){
                el.placeholder = t(key);
            }
        });
        var langSelect = document.getElementById('lang-select');
        if(langSelect){
            langSelect.value = lang;
        }
    }

function setLang(newLang){
    lang = newLang;
    localStorage.setItem('lang', lang);
    applyStaticText();
    renderList();
    renderSelectedMeta();
    updateSoloMusicLabels();
}

function updateSoloMusicLabels(){
    if(!soloMusicPlayerInstance || typeof soloMusicPlayerInstance.updateLabels !== 'function') return;
    soloMusicPlayerInstance.updateLabels({
        title: t('bgMusicTitle'),
        choose: t('bgMusicChoose'),
        play: t('bgMusicPlay'),
        pause: t('bgMusicPause'),
        prev: t('bgMusicPrev'),
        next: t('bgMusicNext'),
        volume: t('bgMusicVolume')
    });
}

function clampInt(val, min, max){
    var n = parseInt(val, 10);
    if(isNaN(n)) return null;
    if(typeof min === 'number' && n < min) n = min;
    if(typeof max === 'number' && n > max) n = max;
    return n;
}

function getQuizTotalQuestions(){
    if(state.quizData && Array.isArray(state.quizData.questions)) return state.quizData.questions.length;
    return 0;
}

function syncQuestionCountControls(){
    var input = document.getElementById('question-count');
    var totalEl = document.getElementById('question-count-total');
    var total = getQuizTotalQuestions();

    if(totalEl){
        totalEl.textContent = total ? format(t('questionCountTotal'), { total: total }) : '';
    }
    if(!input) return;

    if(total > 0){
        input.max = String(total);
        input.disabled = false;
        // Por defecto: máximo.
        if(state.desiredQuestionCount == null){
            input.value = String(total);
        }
    }else{
        input.max = '';
        input.value = '';
        input.disabled = true;
    }
}

function getDesiredQuestionCount(){
    var total = getQuizTotalQuestions();
    if(total <= 0) return 0;

    // Si ya se ha elegido una vez (p.ej. Play again), reutiliza.
    if(typeof state.desiredQuestionCount === 'number' && isFinite(state.desiredQuestionCount) && state.desiredQuestionCount > 0){
        return Math.max(1, Math.min(total, Math.round(state.desiredQuestionCount)));
    }

    var input = document.getElementById('question-count');
    var chosen = input ? clampInt(input.value, 1, total) : null;
    if(chosen == null) chosen = total;
    return chosen;
}

function renderSelectedMeta(){
    var meta = document.getElementById('selected-meta');
    if(!meta) return;
    if(!state.quizData){
        meta.textContent = t('startSelect');
        syncQuestionCountControls();
        return;
    }
    var count = Array.isArray(state.quizData.questions) ? state.quizData.questions.length : 0;
    var tags = Array.isArray(state.quizData.tags) ? state.quizData.tags.join(', ') : (Array.isArray(state.quizData.questionsTags) ? state.quizData.questionsTags.join(', ') : '');
    meta.textContent = format(t('selectedMeta'), { count: count, tags: tags || '—' });
    syncQuestionCountControls();
}

    function normalizeName(str){
        return (str || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
            .slice(0, 3);
    }

    function mediaThumb(data){
        if(!data) return '';
        var yt = parseYouTubeId(data);
        if(yt){
            return 'https://img.youtube.com/vi/' + yt + '/hqdefault.jpg';
        }
        return data;
    }

    function shuffleArray(arr){
        var copy = arr.slice();
        for(var i = copy.length - 1; i > 0; i--){
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = copy[i];
            copy[i] = copy[j];
            copy[j] = tmp;
        }
        return copy;
    }

    function normalizeQuestionMeta(q){
        var type = (q && q.type) ? String(q.type).toLowerCase() : 'quiz';
        if(type !== 'multiple' && type !== 'true-false'){
            type = 'quiz';
        }
        var answers = Array.isArray(q && q.correctAnswers) ? q.correctAnswers.slice() : [];
        if(!answers.length && q && typeof q.correct !== 'undefined'){
            var parsed = parseInt(q.correct, 10);
            if(!Number.isNaN(parsed)){
                answers.push(parsed);
            }
        }
        if(!answers.length){
            answers.push(1);
        }
        var maxAnswerIndex = (type === 'true-false') ? 2 : 4;
        var normalized = answers.map(function(value){
            var num = parseInt(value, 10);
            if(Number.isNaN(num)) return 1;
            return Math.max(1, Math.min(maxAnswerIndex, num));
        });
        var first = normalized.length ? normalized[0] : 1;
        return {
            type: type,
            correctAnswers: normalized,
            correct: first
        };
    }

    function getVisibleAnswers(q, type){
        var answers = Array.isArray(q && q.answers) ? q.answers.slice(0, 4) : ['', '', '', ''];
        while(answers.length < 4) answers.push('');
        if(type === 'true-false'){
            return answers.slice(0, 2);
        }
        return answers;
    }

    function areAnswerSetsEqual(left, right){
        if(!Array.isArray(left) || !Array.isArray(right)) return false;
        var sortedLeft = left.slice().sort(function(a, b){ return a - b; });
        var sortedRight = right.slice().sort(function(a, b){ return a - b; });
        if(sortedLeft.length !== sortedRight.length) return false;
        for(var i = 0; i < sortedLeft.length; i++){
            if(sortedLeft[i] !== sortedRight[i]) return false;
        }
        return true;
    }

    function randomizeOneQuestion(q){
        var meta = normalizeQuestionMeta(q);

        var answers = Array.isArray(q.answers) ? q.answers.slice(0, 4) : ['', '', '', ''];
        while(answers.length < 4) answers.push('');

        // En true/false solo se muestran 2 opciones: barajamos solo 2 para que
        // el índice correcto no quede oculto fuera del slice(0,2).
        var baseOrder = (meta.type === 'true-false') ? [0, 1] : [0, 1, 2, 3];
        var answerOrder = shuffleArray(baseOrder);
        var newAnswers = answerOrder.map(function(idx){ return answers[idx]; });
        if(meta.type === 'true-false'){
            while(newAnswers.length < 4) newAnswers.push('');
        }
        var newCorrectAnswers = [];
        meta.correctAnswers.forEach(function(orig){
            var zero = Math.max(0, Math.min(3, orig - 1));
            var newIdx = answerOrder.indexOf(zero);
            if(newIdx !== -1){
                var candidate = newIdx + 1;
                if(newCorrectAnswers.indexOf(candidate) === -1){
                    newCorrectAnswers.push(candidate);
                }
            }
        });
        if(!newCorrectAnswers.length){
            newCorrectAnswers.push(1);
        }
        var newCorrect = newCorrectAnswers[0];
        return {
            question: q.question || '',
            answers: newAnswers,
            correct: newCorrect,
            correctAnswers: newCorrectAnswers,
            type: meta.type,
            image: q.image || '',
            video: q.video || '',
            time: q.time
        };
    }

    function randomizeQuestions(baseQuestions){
        var source = Array.isArray(baseQuestions) ? baseQuestions : [];
        var shuffledOrder = shuffleArray(source);
        return shuffledOrder.map(function(q){ return randomizeOneQuestion(q); });
    }

    function getQuestions(){
        if(Array.isArray(state.questions) && state.questions.length) return state.questions;
        if(state.quizData && Array.isArray(state.quizData.questions)) return state.quizData.questions;
        return [];
    }

    function findMediaInQuestions(questions){
        if(!Array.isArray(questions)) return '';
        var withMedia = questions.filter(function(q){ return q && (q.image || q.video); });
        if(!withMedia.length) return '';
        var random = withMedia[Math.floor(Math.random() * withMedia.length)];
        return mediaThumb(random.image || random.video || '');
    }

    function fetchPublicQuizzes(){
        var list = document.getElementById('public-list');
        var empty = document.getElementById('public-empty');
        if(empty) empty.textContent = t('loading');
        fetch('/api/public-quizzes')
            .then(function(res){ return res.json(); })
            .then(function(data){
                state.quizzes = shuffleArray(Array.isArray(data) ? data : []);
                state.page = 0;
                renderList();
            })
            .catch(function(){
                if(list) list.innerHTML = '';
                if(empty) empty.textContent = t('publicEmpty');
            });
    }

function renderList(){
    var list = document.getElementById('public-list');
        var empty = document.getElementById('public-empty');
        if(!list) return;
        list.innerHTML = '';
        var searchVal = (document.getElementById('search') && document.getElementById('search').value || '').toLowerCase();
        var filtered = state.quizzes.filter(function(q){
            if(!searchVal) return true;
            var haystack = (q.name || '') + ' ' + (Array.isArray(q.tags) ? q.tags.join(' ') : '');
            return haystack.toLowerCase().includes(searchVal);
        });
        if(filtered.length === 0){
            if(empty) empty.textContent = t('publicEmpty');
            return;
        }
        if(empty) empty.textContent = '';
        var totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
        if(state.page >= totalPages){
            state.page = totalPages - 1;
        }
        filtered = sortPublicQuizzes(filtered);
        var start = state.page * state.pageSize;
        var pageItems = filtered.slice(start, start + state.pageSize);
        pageItems.forEach(function(q){
            var card = document.createElement('div');
            card.className = 'card';
            var thumb = document.createElement('div');
            thumb.className = 'card-thumb placeholder';
            var img = document.createElement('img');
            img.alt = '';
            var thumbUrl = mediaThumb(q.coverImage || q.coverVideo);
            if(thumbUrl){
                img.onload = function(){
                    thumb.classList.add('has-media');
                    thumb.classList.remove('placeholder');
                };
                img.onerror = function(){
                    thumb.classList.remove('has-media');
                    thumb.classList.add('placeholder');
                    img.removeAttribute('src');
                };
                img.src = thumbUrl;
            } else {
                img.onload = function(){
                    thumb.classList.add('has-media');
                    thumb.classList.remove('placeholder');
                };
                img.src = '/icons/logo.svg';
                // keep placeholder background without text
                // Fallback: intenta obtener media del quiz completo
                fetch('/api/quizzes/' + encodeURIComponent(q.id))
                    .then(function(res){ return res.json(); })
                    .then(function(body){
                        var altThumb = findMediaInQuestions(body.questions || []);
                        if(altThumb){
                            img.onload = function(){
                                thumb.classList.add('has-media');
                                thumb.classList.remove('placeholder');
                            };
                            img.onerror = function(){
                                thumb.classList.remove('has-media');
                                thumb.classList.add('placeholder');
                                img.removeAttribute('src');
                            };
                            img.src = altThumb;
                        }
                    })
                    .catch(function(){});
            }
            thumb.appendChild(img);
            card.appendChild(thumb);
            var title = document.createElement('h3');
            title.textContent = q.name || 'Quiz';
            var meta = document.createElement('p');
            meta.className = 'muted';
            meta.textContent = format(t('byline'), { count: q.questionsCount || 0 });
            var tagsWrap = document.createElement('div');
            if(Array.isArray(q.tags)){
                q.tags.forEach(function(tag){
                    var el = document.createElement('span');
                    el.className = 'tag';
                    el.textContent = tag;
                    tagsWrap.appendChild(el);
                });
            }
            var stats = document.createElement('div');
            stats.className = 'card-stats';
            var plays = q.playsCount || 0;
            var players = q.playersCount || 0;
            stats.textContent = plays + ' ' + t('playsShort') + ' · ' + players + ' ' + t('playersShort');
            var btn = document.createElement('button');
            btn.className = 'btn btn-primary';
            btn.textContent = t('playCta');
            btn.onclick = function(){ ensureSoloMusicPlaying(); selectQuiz(q.id); };
            card.appendChild(title);
            card.appendChild(meta);
            card.appendChild(tagsWrap);
            card.appendChild(stats);
            var cardLinks = document.createElement('div');
            cardLinks.className = 'card-links';
            var rankingLink = document.createElement('button');
            rankingLink.type = 'button';
            rankingLink.className = 'card-link';
            rankingLink.textContent = t('viewRanking');
            rankingLink.onclick = function(e){
                e.stopPropagation();
                showQuizRanking(q.id);
            };
            cardLinks.appendChild(rankingLink);
            card.appendChild(cardLinks);
            card.appendChild(btn);
            list.appendChild(card);
        });
        renderPagination(filtered.length);
    }

    function renderPagination(totalFiltered){
        var controls = document.getElementById('public-pagination');
        if(!controls) return;
        controls.innerHTML = '';
        var totalPages = Math.max(1, Math.ceil(totalFiltered / state.pageSize));
        if(totalPages <= 1){
            controls.classList.add('hidden');
            return;
        }
        controls.classList.remove('hidden');
        var prev = document.createElement('button');
        prev.textContent = '<';
        prev.disabled = state.page === 0;
        prev.onclick = function(){
            if(state.page > 0){
                state.page -= 1;
                renderList();
            }
        };
        var info = document.createElement('span');
        info.textContent = (state.page + 1) + ' / ' + totalPages;
        var next = document.createElement('button');
        next.textContent = '>';
        next.disabled = state.page >= totalPages - 1;
        next.onclick = function(){
            if(state.page < totalPages - 1){
                state.page += 1;
                renderList();
            }
        };
        controls.appendChild(prev);
        controls.appendChild(info);
        controls.appendChild(next);
    }

function initSoloMusicPlayer(){
    if(typeof initBackgroundMusic !== 'function') return;

    // Evita duplicar el widget si ya está inicializado.
    if(soloMusicPlayerInstance && soloMusicPlayerInstance.audio) return;

    // Migración: la clave antigua guardaba la URL de la pista.
    try{
        if(!localStorage.getItem(SOLO_MUSIC_STORAGE_KEY)){
            var legacy = localStorage.getItem(SOLO_MUSIC_STORAGE_KEY_LEGACY);
            if(legacy){
                localStorage.setItem(SOLO_MUSIC_STORAGE_KEY, legacy);
            }
        }
    }catch(e){}

    soloMusicPlayerInstance = initBackgroundMusic('#solo-music-player', {
        storageKey: SOLO_MUSIC_STORAGE_KEY,
        randomStart: true,
        volume: 0.6
    });
    updateSoloMusicLabels();
}

function ensureSoloMusicPlaying(){
    if(!soloMusicPlayerInstance) return;
    if(typeof soloMusicPlayerInstance.play === 'function'){
        soloMusicPlayerInstance.play();
        return;
    }
    if(!soloMusicPlayerInstance.audio) return;
    var audio = soloMusicPlayerInstance.audio;
    if(!audio.paused) return;
    audio.play().catch(function(){});
}

function pauseSoloMusic(){
    if(!soloMusicPlayerInstance) return;
    if(typeof soloMusicPlayerInstance.pause === 'function'){
        soloMusicPlayerInstance.pause();
        return;
    }
    if(!soloMusicPlayerInstance.audio) return;
    try{ soloMusicPlayerInstance.audio.pause(); }catch(e){}
}

    function selectQuiz(id){
        var title = document.getElementById('selected-title');
        var startForm = document.getElementById('start-form');
        var gameArea = document.getElementById('game-area');
        var resultArea = document.getElementById('result-area');
        var gamePanel = document.getElementById('game-panel');
        if(title) title.textContent = t('loading');
        if(startForm) startForm.classList.add('hidden');
        if(gameArea) gameArea.classList.add('hidden');
        if(resultArea) resultArea.classList.add('hidden');
        fetch('/api/quizzes/' + encodeURIComponent(id))
            .then(function(res){ return res.json().then(function(body){ return { ok: res.ok, body: body }; }); })
            .then(function(payload){
                if(!payload.ok){
                    if(title) title.textContent = t('startError');
                    return;
                }
                state.quizData = payload.body;
                state.currentQuiz = payload.body.id;
                if(title) title.textContent = payload.body.name || t('soloTitle');
                document.body.classList.add('playing');
                if(gamePanel) gamePanel.classList.remove('hidden');
                // Nuevo flujo: antes de empezar, elegir cuántas preguntas jugar.
                state.desiredQuestionCount = null;
                renderSelectedMeta();
                if(startForm) startForm.classList.remove('hidden');
            })
            .catch(function(){
                if(title) title.textContent = t('startError');
            });
    }

function startQuiz(){
        ensureSoloMusicPlaying();
        if(!state.quizData || !Array.isArray(state.quizData.questions) || !state.quizData.questions.length){
            alert(t('startError'));
            return;
        }
        document.body.classList.add('playing');
        state.idx = 0;
        state.score = 0;
        state.correct = 0;
        state.locked = false;
        var desiredCount = getDesiredQuestionCount();
        state.desiredQuestionCount = desiredCount;
        var randomized = randomizeQuestions(state.quizData.questions || []);
        if(desiredCount > 0 && desiredCount < randomized.length){
            state.questions = randomized.slice(0, desiredCount);
        }else{
            state.questions = randomized;
        }
        var nameInput = document.getElementById('player-name');
        var cleanName = nameInput && nameInput.value ? normalizeName(nameInput.value) : '';
        state.playerName = cleanName || t('namePlaceholder');
        if(nameInput){
            nameInput.value = cleanName;
        }
        var startForm = document.getElementById('start-form');
        var gameArea = document.getElementById('game-area');
        var resultArea = document.getElementById('result-area');
        if(startForm) startForm.classList.add('hidden');
        if(resultArea) resultArea.classList.add('hidden');
        if(gameArea) gameArea.classList.remove('hidden');
        renderQuestion();
    }

    function renderQuestion(){
        var questions = getQuestions();
        if(state.idx >= questions.length){
            finishQuiz();
            return;
        }
        state.locked = false;
        var q = questions[state.idx];
        var meta = normalizeQuestionMeta(q);
        var questionEl = document.getElementById('question-text');
        if(questionEl) questionEl.textContent = q.question || '';
        setMedia(q.image, q.video);
        var progress = document.getElementById('question-progress');
        if(progress){
            var current = state.idx + 1;
            var total = questions.length;
            progress.textContent = format(t('questionOf'), { current: current, total: total });
            progress.setAttribute('aria-label', current + ' / ' + total);
        }
        updateScorePill();
        state.multiSelections = [];
        renderAnswers(q, meta);
        updateSoloSelectionStyles();
        updateSoloMultiSubmitVisibility(meta);
        var time = (typeof q.time === 'number' && q.time > 0) ? q.time : 20;
        startTimer(time);
        var feedback = document.getElementById('feedback');
        if(feedback){
            feedback.textContent = '';
            feedback.classList.remove('feedback--success', 'feedback--error', 'feedback--muted');
        }
    }

    function parseYouTubeId(url){
        if(!url) return null;
        try{
            var u = new URL(url);
            if(u.hostname.includes('youtu.be')){
                return u.pathname.replace('/','');
            }
            if(u.hostname.includes('youtube.com')){
                if(u.searchParams.get('v')) return u.searchParams.get('v');
                var parts = u.pathname.split('/');
                var last = parts[parts.length-1];
                if(last) return last;
            }
        }catch(e){}
        return null;
    }

    function setMedia(imageUrl, videoUrl){
        var wrap = document.getElementById('question-media');
        var img = document.getElementById('question-image');
        var vid = document.getElementById('question-video');
        var iframe = document.getElementById('question-iframe');
        if(!wrap || !img || !vid || !iframe) return;
        wrap.classList.add('hidden');
        img.style.display = 'none';
        vid.style.display = 'none';
        iframe.style.display = 'none';
        img.removeAttribute('src');
        vid.removeAttribute('src');
        iframe.removeAttribute('src');

        var hasMedia = false;
        if(imageUrl){
            img.src = imageUrl;
            img.style.display = 'block';
            hasMedia = true;
        }
        var ytId = parseYouTubeId(videoUrl);
        if(ytId){
            iframe.src = 'https://www.youtube-nocookie.com/embed/' + ytId;
            iframe.style.display = 'block';
            hasMedia = true;
        }else if(videoUrl){
            vid.src = videoUrl;
            vid.style.display = 'block';
            hasMedia = true;
        }
        if(hasMedia){
            wrap.classList.remove('hidden');
            wrap.classList.add('show');
        }else{
            wrap.classList.remove('show');
        }
    }

    function renderAnswers(q, meta){
        var answersWrap = document.getElementById('answers');
        if(!answersWrap) return;
        answersWrap.innerHTML = '';
        var metaInfo = meta || normalizeQuestionMeta(q);
        var answers = getVisibleAnswers(q, metaInfo.type);
        answers.forEach(function(ans, idx){
            var btn = document.createElement('button');
            btn.className = 'answer';
            btn.type = 'button';
            btn.textContent = ans || ('Respuesta ' + (idx + 1));
            btn.setAttribute('data-answer', String(idx + 1));
            btn.addEventListener('click', function(){ handleSoloAnswerInteraction(idx + 1); });
            answersWrap.appendChild(btn);
        });
    }

    function updateSoloSelectionStyles(){
        var answersWrap = document.getElementById('answers');
        if(!answersWrap) return;
        Array.prototype.slice.call(answersWrap.children).forEach(function(btn, idx){
            var n = idx + 1;
            if(Array.isArray(state.multiSelections) && state.multiSelections.indexOf(n) !== -1){
                btn.classList.add('multi-selected');
            }else{
                btn.classList.remove('multi-selected');
            }
        });
    }

    function updateSoloMultiSubmitVisibility(meta){
        var btn = document.getElementById('multi-submit');
        if(!btn) return;
        var questions = getQuestions();
        var question = questions[state.idx] || {};
        var currentMeta = meta || normalizeQuestionMeta(question);
        var isMultiple = currentMeta && currentMeta.type === 'multiple';
        var show = isMultiple && !state.locked;
        btn.classList.toggle('hidden', !show);
        var hasSelection = Array.isArray(state.multiSelections) && state.multiSelections.length > 0;
        btn.disabled = !hasSelection;
        if(show){
            btn.classList.toggle('has-selection', hasSelection);
        }else{
            btn.classList.remove('has-selection');
        }
    }

    function toggleSoloMultiSelection(choice){
        if(state.locked) return;
        var questions = getQuestions();
        var q = questions[state.idx];
        if(!q) return;
        if(normalizeQuestionMeta(q).type !== 'multiple') return;
        var idx = state.multiSelections.indexOf(choice);
        if(idx === -1){
            state.multiSelections.push(choice);
        }else{
            state.multiSelections.splice(idx, 1);
        }
        updateSoloSelectionStyles();
        updateSoloMultiSubmitVisibility();
    }

    function handleSoloAnswerInteraction(choice){
        var questions = getQuestions();
        var q = questions[state.idx];
        if(!q) return;
        if(normalizeQuestionMeta(q).type === 'multiple'){
            toggleSoloMultiSelection(choice);
            return;
        }
        answerQuestion(choice);
    }

    function submitSoloMultiAnswers(){
        if(state.locked) return;
        if(!Array.isArray(state.multiSelections) || !state.multiSelections.length) return;
        answerQuestion(state.multiSelections.slice());
    }

    function startTimer(seconds){
        state.timerTotal = Math.max(5, Math.min(120, seconds));
        state.timerLeft = state.timerTotal;
        updateTimerPill();
        if(state.timer) clearInterval(state.timer);
        state.timer = setInterval(function(){
            state.timerLeft = Math.max(0, state.timerLeft - 0.1);
            updateTimerPill();
            if(state.timerLeft <= 0){
                clearInterval(state.timer);
                state.timer = null;
                answerQuestion(null, true);
            }
        }, 100);
    }

    function stopTimer(){
        if(state.timer){
            clearInterval(state.timer);
            state.timer = null;
        }
    }

    function updateTimerPill(){
        var pill = document.getElementById('timer-pill');
        if(!pill) return;
        pill.textContent = t('timer') + ': ' + Math.ceil(state.timerLeft) + 's';
    }

    function updateScorePill(){
        var scorePill = document.getElementById('score-pill');
        if(scorePill){
            scorePill.textContent = t('score') + ': ' + state.score;
        }
    }

    function answerQuestion(choice, timedOut){
        if(state.locked) return;
        state.locked = true;
        stopTimer();
        var questions = getQuestions();
        var q = questions[state.idx];
        var meta = normalizeQuestionMeta(q);
        var answersWrap = document.getElementById('answers');
        var feedback = document.getElementById('feedback');
        var selected = [];
        if(timedOut){
            selected = [];
        }else if(Array.isArray(choice)){
            selected = choice.slice();
        }else if(choice !== null && typeof choice !== 'undefined'){
            selected = [choice];
        }
        var correctList = Array.isArray(meta.correctAnswers) && meta.correctAnswers.length ? meta.correctAnswers : [(parseInt(q.correct, 10) || 1)];
        var isCorrect = false;
        if(meta.type === 'multiple'){
            isCorrect = areAnswerSetsEqual(selected, correctList);
        }else{
            isCorrect = selected.length && selected[0] === (meta.correct || correctList[0] || 1);
        }
        if(isCorrect){
            state.correct += 1;
            var bonus = Math.max(100, Math.round(1000 * (state.timerLeft / state.timerTotal)));
            state.score += bonus;
        }
        if(answersWrap){
            Array.prototype.slice.call(answersWrap.children).forEach(function(btn, idx){
                var n = idx + 1;
                btn.disabled = true;
                if(correctList.indexOf(n) !== -1){
                    btn.classList.add('correct');
                }
                if(selected.indexOf(n) !== -1 && !isCorrect){
                    btn.classList.add('wrong');
                }
            });
        }
        if(feedback){
            if(timedOut){
                feedback.classList.remove('feedback--success', 'feedback--error');
                feedback.classList.add('feedback--muted');
                feedback.textContent = t('timeup');
            }else if(isCorrect){
                feedback.classList.remove('feedback--muted', 'feedback--error');
                feedback.classList.add('feedback--success');
                feedback.textContent = t('correctText');
            }else{
                feedback.classList.remove('feedback--muted', 'feedback--success');
                feedback.classList.add('feedback--error');
                var correctAnswerText = '';
                if(Array.isArray(q.answers)){
                    var list = [];
                    correctList.forEach(function(idx){
                        if(idx && q.answers[idx - 1]){
                            list.push(q.answers[idx - 1]);
                        }
                    });
                    correctAnswerText = list.join(', ');
                }
                var label = t('correctLabel');
                feedback.textContent = correctAnswerText
                    ? t('wrongText') + ' · ' + (label === 'correctLabel' ? '' : label + ' ') + correctAnswerText
                    : t('wrongText');
            }
        }
        state.multiSelections = [];
        updateSoloSelectionStyles();
        updateSoloMultiSubmitVisibility();
        state.lastWrong = null;
        if(isCorrect){
            updateScorePill();
            setTimeout(function(){
                state.idx += 1;
                renderQuestion();
            }, 1200);
            return;
        }
        updateScorePill();
        state.awaitingConfirm = true;
        state.lastWrong = {
            correct: correctList,
            correctText: Array.isArray(q.answers) ? correctList.map(function(idx){
                return q.answers[idx - 1] || '';
            }).filter(Boolean).join(', ') : '',
            question: q.question || ''
        };
        showFeedbackModal();
    }

    function finishQuiz(){
        stopTimer();
        setMedia(null, null);
        var gameArea = document.getElementById('game-area');
        var resultArea = document.getElementById('result-area');
        if(gameArea) gameArea.classList.add('hidden');
        if(resultArea) resultArea.classList.remove('hidden');
        var summary = document.getElementById('result-summary');
        if(summary){
            var totalQs = getQuestions().length;
            summary.textContent = format(t('resultSummary'), {
                correct: state.correct,
                total: totalQs,
                score: state.score
            });
        }
        var ranking = document.getElementById('ranking');
        var rankingList = document.getElementById('ranking-list');
        if(ranking) ranking.classList.add('hidden');
        if(rankingList) rankingList.innerHTML = '';
        prepareScoreSubmission();
    }

    function submitScore(nameToUse){
        var ranking = document.getElementById('ranking');
        var rankingList = document.getElementById('ranking-list');
        if(rankingList){
            var li = document.createElement('li');
            li.textContent = t('saving');
            rankingList.appendChild(li);
        }
        fetch('/api/quizzes/' + encodeURIComponent(state.currentQuiz) + '/solo-run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: nameToUse || state.playerName,
                score: state.score,
                totalQuestions: getQuestions().length
            })
        })
            .then(function(res){ return res.json().then(function(body){ return { ok: res.ok, body: body }; }); })
            .then(function(payload){
                if(!payload.ok){
                    if(rankingList){
                        rankingList.innerHTML = '';
                        var li = document.createElement('li');
                        li.textContent = payload.body && payload.body.error ? payload.body.error : t('rankingError');
                        rankingList.appendChild(li);
                    }
                    if(ranking) ranking.classList.remove('hidden');
                    return;
                }
                renderRanking(payload.body.top || []);
            })
            .catch(function(){
                if(rankingList){
                    rankingList.innerHTML = '';
                    var li = document.createElement('li');
                    li.textContent = t('rankingError');
                    rankingList.appendChild(li);
                }
                if(ranking) ranking.classList.remove('hidden');
            });
    }

    function renderRanking(list){
        var ranking = document.getElementById('ranking');
        var rankingList = document.getElementById('ranking-list');
        if(!ranking || !rankingList) return;
        rankingList.innerHTML = '';
        if(!list.length){
            var empty = document.createElement('li');
            empty.textContent = t('rankingError');
            rankingList.appendChild(empty);
            ranking.classList.remove('hidden');
            return;
        }
        appendRankingRows(rankingList, list);
        ranking.classList.remove('hidden');
    }

    function appendRankingRows(targetList, rows){
        rows.slice(0, 10).forEach(function(row){
            var li = document.createElement('li');
            var name = row.playerName || t('namePlaceholder');
            var score = row.score || 0;
            li.textContent = name + ' — ' + score + ' ' + t('scoreLabel');
            targetList.appendChild(li);
        });
    }

    function showQuizRanking(id){
        var modal = document.getElementById('ranking-modal');
        var list = document.getElementById('ranking-modal-list');
        var title = document.getElementById('ranking-modal-title');
        if(!modal || !list || !title) return;
        title.textContent = t('rankingTitle');
        list.innerHTML = '';
        var loading = document.createElement('li');
        loading.textContent = t('loading');
        list.appendChild(loading);
        modal.classList.add('show');
        fetch('/api/quizzes/' + encodeURIComponent(id) + '/solo-ranking')
            .then(function(res){ return res.json().then(function(body){ return { ok: res.ok, body: body }; }); })
            .then(function(payload){
                list.innerHTML = '';
                var rows = payload.ok && payload.body && Array.isArray(payload.body.top) ? payload.body.top : [];
                if(!rows.length){
                    var empty = document.createElement('li');
                    empty.textContent = (payload.body && payload.body.error) ? payload.body.error : t('rankingEmpty');
                    list.appendChild(empty);
                    return;
                }
                appendRankingRows(list, rows);
            })
            .catch(function(){
                list.innerHTML = '';
                var empty = document.createElement('li');
                empty.textContent = t('rankingError');
                list.appendChild(empty);
            });
    }

    function hideRankingModal(){
        var modal = document.getElementById('ranking-modal');
        if(modal) modal.classList.remove('show');
    }

    function openNameModal(){
        var modal = document.getElementById('name-modal');
        var input = document.getElementById('player-name');
        if(!modal || !input) return;
        input.value = normalizeName(input.value || state.playerName || 'AAA');
        modal.classList.add('show');
        setTimeout(function(){ input.focus(); input.select(); }, 10);
    }

    function closeNameModal(){
        var modal = document.getElementById('name-modal');
        if(modal) modal.classList.remove('show');
    }

    function shouldPromptName(topList, newScore){
        if(!Array.isArray(topList)) return true;
        if(topList.length < 10) return true;
        var minScore = topList[topList.length - 1] ? (topList[topList.length - 1].score || 0) : 0;
        return newScore >= minScore;
    }

    function prepareScoreSubmission(){
        var score = state.score;
        fetch('/api/quizzes/' + encodeURIComponent(state.currentQuiz) + '/solo-ranking')
            .then(function(res){ return res.json().then(function(body){ return { ok: res.ok, body: body }; }); })
            .then(function(payload){
                var top = (payload.ok && payload.body && Array.isArray(payload.body.top)) ? payload.body.top : [];
                if(shouldPromptName(top, score)){
                    openNameModal();
                }else{
                    submitScore(state.playerName || t('namePlaceholder'));
                }
            })
            .catch(function(){
                submitScore(state.playerName || t('namePlaceholder'));
            });
    }

    function showFeedbackModal(){
        var modal = document.getElementById('feedback-modal');
        var title = document.getElementById('feedback-title');
        var body = document.getElementById('feedback-body');
        if(!modal || !title || !body || !state.lastWrong) return;
        var label = t('correctLabel');
        var correctText = state.lastWrong.correctText || '';
        title.textContent = t('wrongText');
        body.textContent = (label === 'correctLabel' ? '' : label + ' ') + correctText;
        modal.classList.add('show');
    }

    function hideFeedbackModal(){
        var modal = document.getElementById('feedback-modal');
        if(modal) modal.classList.remove('show');
        if(state.awaitingConfirm){
            state.awaitingConfirm = false;
            state.idx += 1;
            renderQuestion();
        }
    }

    function resetSelection(){
        state.quizData = null;
        state.currentQuiz = null;
        state.desiredQuestionCount = null;
        var startForm = document.getElementById('start-form');
        var gameArea = document.getElementById('game-area');
        var resultArea = document.getElementById('result-area');
        var title = document.getElementById('selected-title');
        var meta = document.getElementById('selected-meta');
        if(startForm) startForm.classList.add('hidden');
        if(gameArea) gameArea.classList.add('hidden');
        if(resultArea) resultArea.classList.add('hidden');
        if(title) title.textContent = t('soloTitle');
        if(meta) meta.textContent = t('startSelect');
        syncQuestionCountControls();
        setMedia(null, null);
        document.body.classList.remove('playing');
        pauseSoloMusic();
        state.awaitingConfirm = false;
        state.lastWrong = null;
        state.multiSelections = [];
        state.questions = [];
    }

    function bindEvents(){
        var backLink = document.querySelector('a.back-link');
        if(backLink){
            backLink.addEventListener('click', function(){
                pauseSoloMusic();
            });
        }
        var langSelect = document.getElementById('lang-select');
        if(langSelect){
            langSelect.addEventListener('change', function(){
                setLang(langSelect.value);
            });
        }
        var search = document.getElementById('search');
        if(search){
            search.addEventListener('input', function(){
                state.page = 0;
                renderList();
            });
        }
        var sortSelect = document.getElementById('sort');
        if(sortSelect){
            sortSelect.value = state.sortOrder;
            sortSelect.addEventListener('change', function(){
                state.sortOrder = sortSelect.value;
                state.page = 0;
                renderList();
            });
        }
        var startBtn = document.getElementById('start-btn');
        if(startBtn){
            startBtn.addEventListener('click', startQuiz);
        }
        var multiSubmitBtn = document.getElementById('multi-submit');
        if(multiSubmitBtn){
            multiSubmitBtn.addEventListener('click', submitSoloMultiAnswers);
        }
        var questionCount = document.getElementById('question-count');
        if(questionCount){
            questionCount.addEventListener('input', function(){
                var total = getQuizTotalQuestions();
                if(total <= 0) return;
                var v = clampInt(questionCount.value, 1, total);
                if(v == null) return;
                questionCount.value = String(v);
                state.desiredQuestionCount = v;
            });
        }
        var playAgain = document.getElementById('play-again');
        if(playAgain){
            playAgain.addEventListener('click', function(){
                if(state.quizData){
                    startQuiz();
                }
            });
        }
        var pickAnother = document.getElementById('pick-another');
        if(pickAnother){
            pickAnother.addEventListener('click', resetSelection);
        }
        var nameInput = document.getElementById('player-name');
        if(nameInput){
            nameInput.addEventListener('input', function(){
                nameInput.value = normalizeName(nameInput.value);
            });
        }
        var feedbackClose = document.getElementById('feedback-close');
        if(feedbackClose){
            feedbackClose.addEventListener('click', hideFeedbackModal);
        }
        var feedbackModal = document.getElementById('feedback-modal');
        if(feedbackModal){
            feedbackModal.addEventListener('click', function(e){
                if(e.target === feedbackModal){
                    hideFeedbackModal();
                }
            });
        }
        var rankingModalClose = document.getElementById('ranking-modal-close');
        if(rankingModalClose){
            rankingModalClose.addEventListener('click', hideRankingModal);
        }
        var rankingModal = document.getElementById('ranking-modal');
        if(rankingModal){
            rankingModal.addEventListener('click', function(e){
                if(e.target === rankingModal){
                    hideRankingModal();
                }
            });
        }
        var nameSave = document.getElementById('name-save');
        if(nameSave){
            nameSave.addEventListener('click', function(){
                var input = document.getElementById('player-name');
                var clean = normalizeName(input ? input.value : '');
                state.playerName = clean || t('namePlaceholder');
                closeNameModal();
                submitScore(state.playerName);
            });
        }
        var nameCancel = document.getElementById('name-cancel');
        if(nameCancel){
            nameCancel.addEventListener('click', function(){
                closeNameModal();
                submitScore(state.playerName || t('namePlaceholder'));
            });
        }
        var nameModal = document.getElementById('name-modal');
        if(nameModal){
            nameModal.addEventListener('click', function(e){
                if(e.target === nameModal){
                    closeNameModal();
                    submitScore(state.playerName || t('namePlaceholder'));
                }
            });
        }
    }

    applyStaticText();
    initSoloMusicPlayer();
    bindEvents();
    // Asegura que el selector quede consistente al cargar.
    syncQuestionCountControls();
    fetchPublicQuizzes();

    // Permite abrir directamente un quiz desde Create: /solo/?id=<quizId>
    (function(){
        var id = null;
        try{
            var params = new URLSearchParams(window.location.search || '');
            id = params.get('id');
        }catch(e){}
        if(id){
            selectQuiz(id);
        }
    })();
})();
