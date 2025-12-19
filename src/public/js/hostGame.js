var socket = io();

var params = jQuery.deparam(window.location.search); //Gets the id from url
var lastHostKey = 'lastHostId';
var lastPinKey = 'lastGamePin';
var pinBadge = document.getElementById('pin-badge');
var rankingNextBtn = document.getElementById('rankingNextBtn');
var resultsChartEl = document.getElementById('resultsChart');
var resultsStepChartEl = document.getElementById('resultsStepChart');
var resultsStepRankingEl = document.getElementById('resultsStepRanking');

// Fallback: si faltan id o pin en la URL, usa localStorage
try{
    if(!params.id){
        var storedId = localStorage.getItem(lastHostKey);
        if(storedId) params.id = storedId;
    }
    if(!params.pin){
        var storedPin = localStorage.getItem(lastPinKey);
        if(storedPin) params.pin = storedPin;
    }
}catch(e){}

var timer;

var time = 20;
var defaultTime = 20;
var browserLang = (navigator.language || 'es').slice(0,2);
var lang = localStorage.getItem('lang') || (['es','en','ca'].includes(browserLang) ? browserLang : 'es');
var hostMusicPlayerInstance = null;
var HOST_AUTOPLAY_MUSIC_KEY = 'eduhoot_host_autoplay_music';
var HOST_MUSIC_SHOULD_PLAY_KEY = 'eduhoot_host_music_should_play';
var HOST_MUSIC_ACTIVATION_DONE_KEY = 'eduhoot_host_music_activation_done';
var hostAutoMusicEnabled = false;
var hostAutoMusicShouldPlay = false;
var hostQuestionEnded = false;
var hostRankingGongPlayed = false;
var hostResumeMusicAfterRanking = false;
var hostMusicActivationOverlayEl = null;
var hostMusicActivationKeydownHandler = null;
var currentQuestionType = 'quiz';
var currentAnswerTexts = ['', '', '', ''];
var gongAudio = null;
var gongUrl = '/effects/gong.mp3';
var GONG_VOLUME_BOOST = 1.25;
var hostModalStep = 'chart';
var hostResultsHasRanking = true;
var i18n = {
    es: {
        questionXofY: function(n, t){ return 'Pregunta ' + n + ' / ' + t; },
        playersAnswered: function(ans, total){ return 'Han respondido ' + ans + ' / ' + total; },
        timeLeft: 'Tiempo restante:',
        skip: 'Saltar pregunta',
        next: 'Siguiente pregunta',
        showRanking: 'Mostrar Top 10',
        rankingTitle: 'Top 10',
        topPlayers: 'Top 5 jugadores',
        gameOver: 'FIN DE LA PARTIDA',
        bgMusicTitle: 'Música de fondo',
        bgMusicChoose: 'Elige un tema',
        bgMusicPlay: 'Reproducir música',
        bgMusicPause: 'Pausar música',
        bgMusicPrev: 'Anterior',
        bgMusicNext: 'Siguiente',
        bgMusicVolume: 'Volumen',
        musicActivationTitle: 'Activar audio',
        musicActivationBody: '',
        musicActivationEnable: '¡Empezamos!',
        resultsTitle: 'Resultados',
        resultsNextToRanking: 'Ver clasificación',
        resultsNextQuestion: 'Siguiente pregunta (Enter)',
        freeAnswersReceived: function(ans, total){ return 'Respuestas recibidas ' + ans + ' / ' + total; },
        correctAnswerLabel: 'Respuesta correcta:'
    },
    en: {
        questionXofY: function(n, t){ return 'Question ' + n + ' / ' + t; },
        playersAnswered: function(ans, total){ return 'Players Answered ' + ans + ' / ' + total; },
        timeLeft: 'Time Left:',
        skip: 'Skip question',
        next: 'Next question',
        showRanking: 'Show Top 10',
        rankingTitle: 'Top 10',
        topPlayers: 'Top 5 Players',
        gameOver: 'GAME OVER',
        bgMusicTitle: 'Background music',
        bgMusicChoose: 'Choose a track',
        bgMusicPlay: 'Play music',
        bgMusicPause: 'Pause music',
        bgMusicPrev: 'Prev',
        bgMusicNext: 'Next',
        bgMusicVolume: 'Volume',
        musicActivationTitle: 'Enable audio',
        musicActivationBody: '',
        musicActivationEnable: "Let's go!",
        resultsTitle: 'Results',
        resultsNextToRanking: 'Show leaderboard',
        resultsNextQuestion: 'Next question (Enter)',
        freeAnswersReceived: function(ans, total){ return 'Answers received ' + ans + ' / ' + total; },
        correctAnswerLabel: 'Correct answer:'
    },
    ca: {
        questionXofY: function(n, t){ return 'Pregunta ' + n + ' / ' + t; },
        playersAnswered: function(ans, total){ return 'Han respost ' + ans + ' / ' + total; },
        timeLeft: 'Temps restant:',
        skip: 'Saltar pregunta',
        next: 'Següent pregunta',
        showRanking: 'Mostrar Top 10',
        rankingTitle: 'Top 10',
        topPlayers: 'Top 5 jugadors',
        gameOver: 'FI DE LA PARTIDA',
        bgMusicTitle: 'Música de fons',
        bgMusicChoose: 'Tria un tema',
        bgMusicPlay: 'Reprodueix música',
        bgMusicPause: 'Atura la música',
        bgMusicPrev: 'Anterior',
        bgMusicNext: 'Següent',
        bgMusicVolume: 'Volum',
        musicActivationTitle: 'Activar àudio',
        musicActivationBody: '',
        musicActivationEnable: 'Comencem!',
        resultsTitle: 'Resultats',
        resultsNextToRanking: 'Veure classificació',
        resultsNextQuestion: 'Següent pregunta (Enter)',
        freeAnswersReceived: function(ans, total){ return 'Respostes rebudes ' + ans + ' / ' + total; },
        correctAnswerLabel: 'Resposta correcta:'
    }
};

function t(key){
    return (i18n[lang] && i18n[lang][key]) || i18n.es[key];
}

function updateHostMusicLabels(){
    if(!hostMusicPlayerInstance || typeof hostMusicPlayerInstance.updateLabels !== 'function') return;
    hostMusicPlayerInstance.updateLabels({
        title: t('bgMusicTitle'),
        choose: t('bgMusicChoose'),
        play: t('bgMusicPlay'),
        pause: t('bgMusicPause'),
        prev: t('bgMusicPrev'),
        next: t('bgMusicNext'),
        volume: t('bgMusicVolume')
    });
}

function applyStaticText(){
    var langSelect = document.getElementById('lang-select');
    if(langSelect){
        langSelect.value = lang;
    }
    var timeLabel = document.querySelector('#timerText span[data-i18n="timeLeft"]');
    if(timeLabel){
        timeLabel.textContent = t('timeLeft') + ' ';
    }
    var skipBtn = document.getElementById('skipQButton');
    if(skipBtn) skipBtn.textContent = t('skip');
    var nextBtn = document.getElementById('nextQButton');
    if(nextBtn) nextBtn.textContent = t('next');
    var showRanking = document.getElementById('showRanking');
    if(showRanking) showRanking.textContent = t('showRanking');
    var rankingTitle = document.getElementById('rankingTitle');
    if(rankingTitle) rankingTitle.textContent = t('rankingTitle');
    var resultsTitle = document.getElementById('resultsTitle');
    if(resultsTitle) resultsTitle.textContent = t('resultsTitle');
    var winnerTitle = document.getElementById('winnerTitle');
    if(winnerTitle) winnerTitle.textContent = t('topPlayers');

    updateModalNextButtonLabel();
}

function updateModalNextButtonLabel(){
    if(!rankingNextBtn) return;
    if(hostModalStep === 'chart'){
        rankingNextBtn.textContent = hostResultsHasRanking ? t('resultsNextToRanking') : t('resultsNextQuestion');
        return;
    }
    rankingNextBtn.textContent = t('resultsNextQuestion');
}

function setHostModalStep(step){
    hostModalStep = step === 'ranking' ? 'ranking' : 'chart';
    if(resultsStepChartEl) resultsStepChartEl.style.display = hostModalStep === 'chart' ? 'block' : 'none';
    if(resultsStepRankingEl) resultsStepRankingEl.style.display = hostModalStep === 'ranking' ? 'block' : 'none';
    updateModalNextButtonLabel();
}

function renderResultsChart(answerCounts, totalPlayers){
    if(!resultsChartEl) return;
    resultsChartEl.innerHTML = '';

    var total = (typeof totalPlayers === 'number' && totalPlayers > 0) ? totalPlayers : 0;
    var denom = total > 0 ? total : 1;
    var visible = getVisibleAnswerFlags();
    var letters = ['A', 'B', 'C', 'D'];

    for(var i = 0; i < 4; i++){
        if(!visible[i]) continue;
        var count = Number((answerCounts && answerCounts[i]) || 0);
        if(Number.isNaN(count) || count < 0) count = 0;
        var pct = Math.round((count / denom) * 100);
        if(pct < 0) pct = 0;
        if(pct > 100) pct = 100;

        var bar = document.createElement('div');
        bar.className = 'results-bar results-bar--' + (i + 1);

        var track = document.createElement('div');
        track.className = 'results-bar-track';
        var fill = document.createElement('div');
        fill.className = 'results-bar-fill';
        fill.style.height = pct + '%';
        track.appendChild(fill);

        var meta = document.createElement('div');
        meta.className = 'results-bar-meta';

        var key = document.createElement('div');
        key.className = 'results-bar-key';
        key.textContent = letters[i];

        var stats = document.createElement('div');
        stats.className = 'results-bar-stats';
        stats.innerHTML = pct + '% <span>(' + count + ')</span>';

        var text = document.createElement('div');
        text.className = 'results-bar-text';
        text.textContent = (currentAnswerTexts[i] || '').trim();

        meta.appendChild(key);
        meta.appendChild(stats);
        if(text.textContent){
            meta.appendChild(text);
        }

        bar.appendChild(track);
        bar.appendChild(meta);
        resultsChartEl.appendChild(bar);
    }
}

function setLang(newLang){
    lang = newLang;
    localStorage.setItem('lang', lang);
    applyStaticText();
    updateHostMusicLabels();
}

function initHostMusicPlayer(){
    if(typeof initBackgroundMusic !== 'function') return;
    hostMusicPlayerInstance = initBackgroundMusic('#host-music-player', {
        storageKey: 'eduhoot-host-music',
        randomStart: true,
        volume: 0.7
    });
    updateHostMusicLabels();
}

function setCurrentAnswerTexts(answers){
    currentAnswerTexts = [];
    for(var i = 0; i < 4; i++){
        currentAnswerTexts[i] = answers[i] || '';
    }
    for(var j = 1; j <= 4; j++){
        var el = document.getElementById('answer' + j);
        if(!el) continue;
        var text = currentAnswerTexts[j - 1];
        el.innerHTML = text;
        if(currentQuestionType === 'short-answer' || currentQuestionType === 'numeric'){
            el.style.display = 'none';
        }else if(currentQuestionType === 'true-false' && j > 2){
            el.style.display = 'none';
        }else{
            el.style.display = text && text.trim().length ? 'block' : 'none';
        }
        el.style.filter = '';
    }
}

function getVisibleAnswerFlags(){
    if(currentQuestionType === 'short-answer' || currentQuestionType === 'numeric'){
        return [false, false, false, false];
    }
    var flags = [];
    for(var i = 0; i < 4; i++){
        var text = currentAnswerTexts[i];
        var visible = !!text && text.trim().length;
        if(currentQuestionType === 'true-false' && i >= 2){
            visible = false;
        }
        flags.push(visible);
    }
    return flags;
}

function hideAnswerSquares(){
    for(var k = 1; k <= 4; k++){
        var square = document.getElementById('square' + k);
        if(square){
            square.style.display = 'none';
            square.style.height = '0px';
        }
    }
}

function highlightCorrectAnswers(correctAnswers){
    if(currentQuestionType === 'short-answer' || currentQuestionType === 'numeric'){
        return;
    }
    var valid = Array.isArray(correctAnswers) ? correctAnswers : [];
    var correctSet = new Set(valid.map(Number));
    var visibleFlags = getVisibleAnswerFlags();
    for(var idx = 1; idx <= 4; idx++){
        var el = document.getElementById('answer' + idx);
        if(!el) continue;
        var visible = visibleFlags[idx - 1];
        if(!visible){
            el.style.filter = '';
            continue;
        }
        if(correctSet.has(idx)){
            el.innerHTML = '&#10004; ' + (currentAnswerTexts[idx - 1] || '');
            el.style.filter = '';
        }else{
            el.style.filter = "grayscale(50%)";
        }
    }
}

function updateSquareHeights(counts, total){
    var visible = getVisibleAnswerFlags();
    var denominator = total > 0 ? total : 1;
    for(var i = 1; i <= 4; i++){
        var square = document.getElementById('square' + i);
        if(!square) continue;
        if(!visible[i - 1]){
            square.style.display = 'none';
            square.style.height = '0px';
            continue;
        }
        square.style.display = "inline-block";
        var height = Math.round((counts[i - 1] || 0) / denominator * 100);
        square.style.height = height + "px";
    }
}

function initGong(){
    if(gongAudio) return;
    try{
        gongAudio = new Audio(gongUrl);
        gongAudio.preload = 'auto';
    }catch(e){
        gongAudio = null;
    }
}

function getHostMusicVolume(){
    try{
        if(hostMusicPlayerInstance && hostMusicPlayerInstance.audio && typeof hostMusicPlayerInstance.audio.volume === 'number'){
            return hostMusicPlayerInstance.audio.volume;
        }
    }catch(e){}
    // Fallback al volumen persistido por el widget
    try{
        var v = localStorage.getItem('eduhoot-host-music:volume');
        if(v != null){
            var parsed = parseFloat(v);
            if(!isNaN(parsed)) return parsed;
        }
    }catch(e){}
    return 0.7;
}

function getGongVolume(){
    var base = getHostMusicVolume();
    if(typeof base !== 'number' || isNaN(base)) base = 0.7;
    if(base < 0) base = 0;
    if(base > 1) base = 1;
    var v = base * GONG_VOLUME_BOOST;
    if(v > 1) v = 1;
    if(v < 0) v = 0;
    return v;
}

function playGong(){
    initGong();
    if(!gongAudio) return;
    try{
        gongAudio.pause();
        gongAudio.currentTime = 0;
    }catch(e){}
    try{ gongAudio.volume = getGongVolume(); }catch(e){}
    gongAudio.play().catch(function(){});
}

function ensureHostMusicPlaying(){
    if(!hostMusicPlayerInstance) return;
    if(typeof hostMusicPlayerInstance.play === 'function'){
        hostMusicPlayerInstance.play();
        return;
    }
    if(!hostMusicPlayerInstance.audio) return;
    var audio = hostMusicPlayerInstance.audio;
    if(!audio.paused) return;
    audio.play().catch(function(){});
}

function attemptHostMusicPlay(){
    if(!hostMusicPlayerInstance) return Promise.resolve(false);
    // Preferimos ir al <audio> real para poder detectar rechazo de autoplay.
    var audio = hostMusicPlayerInstance.audio;
    if(!audio){
        try{ ensureHostMusicPlaying(); }catch(e){}
        return Promise.resolve(isHostMusicPlaying());
    }
    if(!audio.paused) return Promise.resolve(true);
    try{
        var p = audio.play();
        if(p && typeof p.then === 'function'){
            return p.then(function(){ return true; }).catch(function(){ return false; });
        }
    }catch(e){
        return Promise.resolve(false);
    }
    return Promise.resolve(!audio.paused);
}

function hasCompletedMusicActivation(){
    try{ return sessionStorage.getItem(HOST_MUSIC_ACTIVATION_DONE_KEY) === '1'; }catch(e){ return false; }
}

function markMusicActivationCompleted(){
    try{ sessionStorage.setItem(HOST_MUSIC_ACTIVATION_DONE_KEY, '1'); }catch(e){}
}

function hideMusicActivationOverlay(){
    if(!hostMusicActivationOverlayEl) return;
    if(hostMusicActivationKeydownHandler){
        try{ document.removeEventListener('keydown', hostMusicActivationKeydownHandler, true); }catch(e){}
        hostMusicActivationKeydownHandler = null;
    }
    try{ hostMusicActivationOverlayEl.remove(); }catch(e){
        try{ hostMusicActivationOverlayEl.style.display = 'none'; }catch(e2){}
    }
    hostMusicActivationOverlayEl = null;
}

function showMusicActivationOverlay(opts){
    opts = opts || {};
    if(hostMusicActivationOverlayEl) return;
    if(hasCompletedMusicActivation()) return;

    var overlay = document.createElement('div');
    overlay.className = 'music-activation-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', t('musicActivationTitle'));

    var card = document.createElement('div');
    card.className = 'music-activation-card';

    var p = document.createElement('p');
    p.className = 'music-activation-body';
    p.textContent = t('musicActivationBody');

    var actions = document.createElement('div');
    actions.className = 'music-activation-actions';

    var btnEnable = document.createElement('button');
    btnEnable.type = 'button';
    btnEnable.className = 'music-activation-btn music-activation-btn-primary';
    btnEnable.textContent = t('musicActivationEnable');

    function activateAudio(){
        // Este click/tap es el gesto que desbloquea autoplay.
        attemptHostMusicPlay().finally(function(){
            markMusicActivationCompleted();
            hideMusicActivationOverlay();
        });
    }

    btnEnable.addEventListener('click', function(){ activateAudio(); });

    actions.appendChild(btnEnable);

    if(p.textContent){
        card.appendChild(p);
    }
    card.appendChild(actions);
    overlay.appendChild(card);

    document.body.appendChild(overlay);
    hostMusicActivationOverlayEl = overlay;

    hostMusicActivationKeydownHandler = function(ev){
        if(!hostMusicActivationOverlayEl) return;
        if(ev.key === 'Enter'){
            ev.preventDefault();
            activateAudio();
            return;
        }
        if(ev.key === 'Escape'){
            ev.preventDefault();
            hideMusicActivationOverlay();
        }
    };
    document.addEventListener('keydown', hostMusicActivationKeydownHandler, true);

    try{ btnEnable.focus(); }catch(e){}
}

function isHostMusicPlaying(){
    if(!hostMusicPlayerInstance) return false;
    if(typeof hostMusicPlayerInstance.isPlaying === 'function'){
        try{ return !!hostMusicPlayerInstance.isPlaying(); }catch(e){ return false; }
    }
    if(hostMusicPlayerInstance.audio){
        return !hostMusicPlayerInstance.audio.paused;
    }
    return false;
}

function pauseHostMusicForRanking(){
    if(!hostMusicPlayerInstance) return;
    hostResumeMusicAfterRanking = isHostMusicPlaying();
    if(typeof hostMusicPlayerInstance.pause === 'function'){
        hostMusicPlayerInstance.pause();
        return;
    }
    if(hostMusicPlayerInstance.audio){
        try{ hostMusicPlayerInstance.audio.pause(); }catch(e){}
    }
}

function openRankingModal(playGongOnce){
    var modal = document.getElementById('rankingModal');
    if(!modal) return;
    modal.style.display = 'block';

    // En fin de pregunta, forzamos el flujo Resultados -> Ranking -> Siguiente.
    // Si el host abre manualmente el modal en mitad de la pregunta, permitimos cerrar.
    var closeBtn = document.getElementById('closeRanking');
    if(closeBtn){
        closeBtn.style.display = hostQuestionEnded ? 'none' : 'block';
    }

    // Solo actuamos (parar música + gong) cuando es fin de pregunta.
    if(!hostQuestionEnded) return;
    pauseHostMusicForRanking();
    if(playGongOnce && !hostRankingGongPlayed){
        hostRankingGongPlayed = true;
        playGong();
    }
}

function closeRankingModal(){
    var modal = document.getElementById('rankingModal');
    if(modal) modal.style.display = 'none';
}

function maybeAutoplayHostMusicFromLobby(){
    try{
        if(sessionStorage.getItem(HOST_AUTOPLAY_MUSIC_KEY) === '1'){
            sessionStorage.removeItem(HOST_AUTOPLAY_MUSIC_KEY);
            hostAutoMusicEnabled = true;
        }
        if(sessionStorage.getItem(HOST_MUSIC_SHOULD_PLAY_KEY) === '1'){
            // Lo dejamos en sessionStorage para que sobreviva recargas durante la partida.
            hostAutoMusicShouldPlay = true;
        }
        if(hostAutoMusicEnabled && hostAutoMusicShouldPlay){
            ensureHostMusicPlaying();
        }
    }catch(e){}
}

//When host connects to server
socket.on('connect', function() {
    
    //Tell server that it is host connection from game view
    socket.emit('host-join-game', params);
    if(params.id){
        try{ localStorage.setItem(lastHostKey, params.id); }catch(e){}
    }
    if(params.pin){
        try{ localStorage.setItem(lastPinKey, params.pin); }catch(e){}
    }
    setPinBadge(params.pin || '');
});

socket.on('noGameFound', function(){
   window.location.href = '../../';//Redirect user to 'join game' page
});

socket.on('gameQuestions', function(data){
    hostQuestionEnded = false;
    hostRankingGongPlayed = false;
    closeRankingModal();

    // Si venimos de "Iniciar partida" intentamos que suene música en cada pregunta.
    // También reanudamos si la pausamos automáticamente al mostrar el ranking.
    if(hostAutoMusicEnabled && hostAutoMusicShouldPlay && (hostResumeMusicAfterRanking || !isHostMusicPlaying())){
        hostResumeMusicAfterRanking = false;
        // En la primera pregunta de la vista, algunos navegadores bloquean autoplay.
        // Si falla, mostramos un popup para forzar un gesto y desbloquear audio.
        attemptHostMusicPlay().then(function(ok){
            if(!ok){
                showMusicActivationOverlay();
            }
        });
    }

    currentQuestionType = data.type || 'quiz';
    document.getElementById('question').innerHTML = data.q1;
    setCurrentAnswerTexts([data.a1, data.a2, data.a3, data.a4]);
    hideAnswerSquares();
    defaultTime = data.time || defaultTime || 20;
    window.hostShowScores = data.showScores !== false;
    setMedia(data.image, data.video);
    document.getElementById('playersAnswered').innerHTML = i18n[lang].playersAnswered(0, data.playersInGame);
    if (data.questionNumber && data.totalQuestions) {
        document.getElementById('questionNum').innerHTML = i18n[lang].questionXofY(data.questionNumber, data.totalQuestions);
    }
    updateTimer();
});

socket.on('updatePlayersAnswered', function(data){
   document.getElementById('playersAnswered').innerHTML = i18n[lang].playersAnswered(data.playersAnswered, data.playersInGame);
});

socket.on('gamePin', function(data){
    if(data && data.pin){
        setPinBadge(data.pin);
        try{ localStorage.setItem(lastPinKey, data.pin); }catch(e){}
    }
});

socket.on('hostSession', function(data){
    if(data && data.hostId){
        try{ localStorage.setItem(lastHostKey, data.hostId); }catch(e){}
    }
    if(data && data.pin){
        setPinBadge(data.pin);
        try{ localStorage.setItem(lastPinKey, data.pin); }catch(e){}
    }
});

// Control: botón y tecla Enter para pasar a la siguiente pregunta desde el modal
function handleResultsModalNext(){
    if(hostModalStep === 'chart'){
        if(hostResultsHasRanking){
            setHostModalStep('ranking');
            return;
        }
        if(hostQuestionEnded){
            nextQuestion();
        }
        closeRankingModal();
        return;
    }
    // Paso ranking
    if(hostQuestionEnded){
        nextQuestion();
    }
    closeRankingModal();
}

if(rankingNextBtn){
    rankingNextBtn.addEventListener('click', function(){
        handleResultsModalNext();
    });
}

document.addEventListener('keydown', function(ev){
    if(ev.key === 'Enter' && document.getElementById('rankingModal') && document.getElementById('rankingModal').style.display === 'block'){
        ev.preventDefault();
        handleResultsModalNext();
    }
});

socket.on('questionOver', function(playerData, payload){
    hostQuestionEnded = true;
    clearInterval(timer);
    document.getElementById('playersAnswered').style.display = "none";
    document.getElementById('timerText').style.display = "none";
    setMedia(null, null);
    currentQuestionType = (payload && payload.type) || currentQuestionType;
    var totalPlayers = Array.isArray(playerData) ? playerData.length : 0;

    // Tipos libres: no hay buckets 1-4; mostramos resumen simple.
    if(currentQuestionType === 'short-answer' || currentQuestionType === 'numeric'){
        hideAnswerSquares();
        if(resultsChartEl){
            var answeredCount = 0;
            (playerData || []).forEach(function(player){
                var answer = player && player.gameData ? player.gameData.answer : null;
                if(!answer) return;
                if(currentQuestionType === 'short-answer'){
                    var txt = (answer && typeof answer === 'object') ? (answer.text || '') : String(answer || '');
                    if(String(txt).trim()) answeredCount += 1;
                }else{
                    var n = (answer && typeof answer === 'object') ? answer.number : answer;
                    if(String(n || '').trim()) answeredCount += 1;
                }
            });

            var correctTxt = '';
            if(payload && payload.type === 'short-answer'){
                var acc = Array.isArray(payload.acceptedAnswers) ? payload.acceptedAnswers : [];
                correctTxt = acc.join(', ');
            }else if(payload && payload.type === 'numeric'){
                var base = (payload.numericAnswer !== undefined && payload.numericAnswer !== null) ? payload.numericAnswer : '';
                var tol = (payload.tolerance !== undefined && payload.tolerance !== null) ? payload.tolerance : 0;
                if(base !== ''){
                    correctTxt = Number(tol) > 0 ? (String(base) + ' ± ' + String(tol)) : String(base);
                }
            }

            resultsChartEl.innerHTML = '';
            var line1 = document.createElement('div');
            line1.className = 'results-free-line';
            line1.textContent = t('freeAnswersReceived')(answeredCount, totalPlayers);
            resultsChartEl.appendChild(line1);
            if(correctTxt){
                var line2 = document.createElement('div');
                line2.className = 'results-free-line';
                line2.textContent = t('correctAnswerLabel') + ' ' + correctTxt;
                resultsChartEl.appendChild(line2);
            }
        }
    }else{
        highlightCorrectAnswers(payload && payload.correctAnswers);
        var answerCounts = [0, 0, 0, 0];
        function incrementAnswer(value){
            var num = Number(value);
            if(Number.isNaN(num) || num < 1 || num > 4) return;
            answerCounts[num - 1] += 1;
        }
        (playerData || []).forEach(function(player){
            var answer = player.gameData.answer;
            if(Array.isArray(answer)){
                answer.forEach(incrementAnswer);
            }else{
                incrementAnswer(answer);
            }
        });
        // La gráfica se muestra dentro del modal (más visible) en lugar de en la vista principal.
        hideAnswerSquares();
        renderResultsChart(answerCounts, totalPlayers);
    }
    
    // El avance se hace desde el modal (Resultados -> Ranking -> Siguiente).
    document.getElementById('nextQButton').style.display = "none";
    document.getElementById('skipQButton').style.display = "none";

    hostResultsHasRanking = (window.hostShowScores !== false);
    if(hostResultsHasRanking){
        // Update ranking list
        var rankingList = document.getElementById('rankingList');
        rankingList.innerHTML = '';
        var sorted = playerData.slice().sort(function(a, b){
            return (b.gameData.score || 0) - (a.gameData.score || 0);
        });
        var top = sorted.slice(0, 10);
        for(var r = 0; r < top.length; r++){
            var li = document.createElement('li');
            var icon = top[r].icon ? top[r].icon + ' ' : '';
            li.textContent = icon + top[r].name + ' - ' + (top[r].gameData.score || 0);
            rankingList.appendChild(li);
        }
    }

    // Abrimos el modal primero en el paso de resultados (gráfica)
    setHostModalStep('chart');
    openRankingModal(true);
    
});

function toggleRanking(){
    var modal = document.getElementById('rankingModal');
    if(!modal) return;
    if(modal.style.display === 'block'){
        closeRankingModal();
        return;
    }
    // Apertura manual: enseñamos directamente el ranking.
    setHostModalStep('ranking');
    // Si el host abre el ranking manualmente en mitad de la pregunta, no paramos música ni gong.
    // Si es fin de pregunta, solo paramos música (gong ya se habrá disparado en la auto-apertura).
    openRankingModal(false);
}

document.getElementById('closeRanking').onclick = function() {
    closeRankingModal();
};

socket.on('questionMedia', function(data){
    setMedia(data.image, data.video);
});

function setMedia(imageUrl, videoUrl){
    var imgEl = document.getElementById('questionImage');
    var videoEl = document.getElementById('questionVideo');
    var iframeEl = document.getElementById('questionIframe');
    if (imgEl) {
        if (imageUrl) {
            imgEl.src = imageUrl;
            imgEl.style.display = 'block';
        } else {
            imgEl.removeAttribute('src');
            imgEl.style.display = 'none';
        }
    }
    if (videoEl && iframeEl) {
        var ytId = parseYouTubeId(videoUrl);
        if (ytId) {
            videoEl.removeAttribute('src');
            videoEl.pause();
            videoEl.style.display = 'none';
            iframeEl.src = 'https://www.youtube-nocookie.com/embed/' + ytId;
            iframeEl.style.display = 'block';
        } else if (videoUrl) {
            iframeEl.removeAttribute('src');
            iframeEl.style.display = 'none';
            videoEl.src = videoUrl;
            videoEl.style.display = 'block';
        } else {
            iframeEl.removeAttribute('src');
            iframeEl.style.display = 'none';
            videoEl.removeAttribute('src');
            videoEl.pause();
            videoEl.style.display = 'none';
        }
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

function nextQuestion(){
    closeRankingModal();
    document.getElementById('nextQButton').style.display = "none";
    document.getElementById('skipQButton').style.display = "inline-block";
    document.getElementById('skipQButton').disabled = false;
    document.getElementById('square1').style.display = "none";
    document.getElementById('square2').style.display = "none";
    document.getElementById('square3').style.display = "none";
    document.getElementById('square4').style.display = "none";
    
    document.getElementById('answer1').style.filter = "none";
    document.getElementById('answer2').style.filter = "none";
    document.getElementById('answer3').style.filter = "none";
    document.getElementById('answer4').style.filter = "none";
    
    document.getElementById('playersAnswered').style.display = "block";
    document.getElementById('timerText').style.display = "block";
    document.getElementById('num').innerHTML = " " + defaultTime;
    setMedia(null, null);

    // Gesto del usuario: si la música debe sonar, este es el momento más fiable para (re)arrancarla.
    if(hostAutoMusicEnabled && hostAutoMusicShouldPlay){
        hostResumeMusicAfterRanking = false;
        ensureHostMusicPlaying();
    }
    socket.emit('nextQuestion'); //Tell server to start new question
}

function skipQuestion(){
    document.getElementById('skipQButton').disabled = true;
    clearInterval(timer);
    if(hostAutoMusicEnabled && hostAutoMusicShouldPlay){
        ensureHostMusicPlaying();
    }
    socket.emit('skipQuestion');
}

function updateTimer(){
    time = defaultTime;
    timer = setInterval(function(){
        time -= 1;
        document.getElementById('num').textContent = " " + time;
        if(time == 0){
            socket.emit('timeUp');
        }
    }, 1000);
}
socket.on('GameOver', function(data){
    document.getElementById('nextQButton').style.display = "none";
    document.getElementById('square1').style.display = "none";
    document.getElementById('square2').style.display = "none";
    document.getElementById('square3').style.display = "none";
    document.getElementById('square4').style.display = "none";
    
    document.getElementById('answer1').style.display = "none";
    document.getElementById('answer2').style.display = "none";
    document.getElementById('answer3').style.display = "none";
    document.getElementById('answer4').style.display = "none";
    document.getElementById('timerText').innerHTML = "";
    document.getElementById('question').innerHTML = i18n[lang].gameOver;
    document.getElementById('playersAnswered').innerHTML = "";
    
    
    
    document.getElementById('winner1').style.display = "block";
    document.getElementById('winner2').style.display = "block";
    document.getElementById('winner3').style.display = "block";
    document.getElementById('winner4').style.display = "block";
    document.getElementById('winner5').style.display = "block";
    document.getElementById('winnerTitle').style.display = "block";
    document.getElementById('winnerTitle').textContent = t('topPlayers');
    
    document.getElementById('winner1').innerHTML = "1. " + data.num1;
    document.getElementById('winner2').innerHTML = "2. " + data.num2;
    document.getElementById('winner3').innerHTML = "3. " + data.num3;
    document.getElementById('winner4').innerHTML = "4. " + data.num4; 
    document.getElementById('winner5').innerHTML = "5. " + data.num5;
    try{
        localStorage.removeItem(lastHostKey);
        localStorage.removeItem(lastPinKey);
    }catch(e){}
});

function setPinBadge(pin){
    if(pinBadge){
        if(pin){
            pinBadge.textContent = 'PIN ' + pin;
            pinBadge.style.display = 'inline-flex';
        }else{
            pinBadge.textContent = '';
            pinBadge.style.display = 'none';
        }
    }
}



socket.on('getTime', function(player){
    socket.emit('time', {
        player: player,
        time: time
    });
});

// Lang selector init
applyStaticText();
var langSelectEl = document.getElementById('lang-select');
if(langSelectEl){
    langSelectEl.addEventListener('change', function(){
        setLang(langSelectEl.value);
    });
}
initHostMusicPlayer();
maybeAutoplayHostMusicFromLobby();

// Fallback: primer gesto del usuario en la vista de juego.
// Algunos navegadores (p.ej. iOS) pueden no disparar Pointer Events.
(function armFirstGestureAutoplay(){
    var fired = false;
    function handler(){
        if(fired) return;
        fired = true;
        ensureHostMusicPlaying();
    }
    document.addEventListener('pointerdown', handler, { once: true, passive: true });
    document.addEventListener('touchstart', handler, { once: true, passive: true });
    document.addEventListener('mousedown', handler, { once: true, passive: true });
    document.addEventListener('keydown', handler, { once: true });
})();
