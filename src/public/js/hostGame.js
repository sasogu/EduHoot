var socket = io();

var params = jQuery.deparam(window.location.search); //Gets the id from url
var lastHostKey = 'lastHostId';
var lastPinKey = 'lastGamePin';
var pinBadge = document.getElementById('pin-badge');
var rankingNextBtn = document.getElementById('rankingNextBtn');

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
        bgMusicVolume: 'Volumen'
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
        bgMusicVolume: 'Volume'
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
        bgMusicVolume: 'Volum'
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
    var winnerTitle = document.getElementById('winnerTitle');
    if(winnerTitle) winnerTitle.textContent = t('topPlayers');
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

function maybeAutoplayHostMusicFromLobby(){
    try{
        if(sessionStorage.getItem(HOST_AUTOPLAY_MUSIC_KEY) === '1'){
            sessionStorage.removeItem(HOST_AUTOPLAY_MUSIC_KEY);
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
    document.getElementById('question').innerHTML = data.q1;
    document.getElementById('answer1').innerHTML = data.a1;
    document.getElementById('answer2').innerHTML = data.a2;
    document.getElementById('answer3').innerHTML = data.a3;
    document.getElementById('answer4').innerHTML = data.a4;
    defaultTime = data.time || defaultTime || 20;
    window.hostShowScores = data.showScores !== false;
    setMedia(data.image, data.video);
    var correctAnswer = data.correct;
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
if(rankingNextBtn){
    rankingNextBtn.addEventListener('click', function(){
        nextQuestion();
        toggleRanking();
    });
}
document.addEventListener('keydown', function(ev){
    if(ev.key === 'Enter' && document.getElementById('rankingModal') && document.getElementById('rankingModal').style.display === 'block'){
        ev.preventDefault();
        nextQuestion();
        toggleRanking();
    }
});

socket.on('questionOver', function(playerData, correct){
    clearInterval(timer);
    var answer1 = 0;
    var answer2 = 0;
    var answer3 = 0;
    var answer4 = 0;
    var total = 0;
    //Hide elements on page
    document.getElementById('playersAnswered').style.display = "none";
    document.getElementById('timerText').style.display = "none";
    setMedia(null, null);
    
    //Shows user correct answer with effects on elements
    if(correct == 1){
        document.getElementById('answer2').style.filter = "grayscale(50%)";
        document.getElementById('answer3').style.filter = "grayscale(50%)";
        document.getElementById('answer4').style.filter = "grayscale(50%)";
        var current = document.getElementById('answer1').innerHTML;
        document.getElementById('answer1').innerHTML = "&#10004" + " " + current;
    }else if(correct == 2){
        document.getElementById('answer1').style.filter = "grayscale(50%)";
        document.getElementById('answer3').style.filter = "grayscale(50%)";
        document.getElementById('answer4').style.filter = "grayscale(50%)";
        var current = document.getElementById('answer2').innerHTML;
        document.getElementById('answer2').innerHTML = "&#10004" + " " + current;
    }else if(correct == 3){
        document.getElementById('answer1').style.filter = "grayscale(50%)";
        document.getElementById('answer2').style.filter = "grayscale(50%)";
        document.getElementById('answer4').style.filter = "grayscale(50%)";
        var current = document.getElementById('answer3').innerHTML;
        document.getElementById('answer3').innerHTML = "&#10004" + " " + current;
    }else if(correct == 4){
        document.getElementById('answer1').style.filter = "grayscale(50%)";
        document.getElementById('answer2').style.filter = "grayscale(50%)";
        document.getElementById('answer3').style.filter = "grayscale(50%)";
        var current = document.getElementById('answer4').innerHTML;
        document.getElementById('answer4').innerHTML = "&#10004" + " " + current;
    }
    
    for(var i = 0; i < playerData.length; i++){
        if(playerData[i].gameData.answer == 1){
            answer1 += 1;
        }else if(playerData[i].gameData.answer == 2){
            answer2 += 1;
        }else if(playerData[i].gameData.answer == 3){
            answer3 += 1;
        }else if(playerData[i].gameData.answer == 4){
            answer4 += 1;
        }
        total += 1;
    }
    
    //Gets values for graph
    answer1 = answer1 / total * 100;
    answer2 = answer2 / total * 100;
    answer3 = answer3 / total * 100;
    answer4 = answer4 / total * 100;
    
    document.getElementById('square1').style.display = "inline-block";
    document.getElementById('square2').style.display = "inline-block";
    document.getElementById('square3').style.display = "inline-block";
    document.getElementById('square4').style.display = "inline-block";
    
    document.getElementById('square1').style.height = answer1 + "px";
    document.getElementById('square2').style.height = answer2 + "px";
    document.getElementById('square3').style.height = answer3 + "px";
    document.getElementById('square4').style.height = answer4 + "px";
    
    document.getElementById('nextQButton').style.display = "block";
    document.getElementById('skipQButton').style.display = "none";

    if (window.hostShowScores !== false) {
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
        // Open ranking modal automatically after each question
        var modal = document.getElementById('rankingModal');
        if (modal) {
            modal.style.display = 'block';
        }
    }
    
});

function toggleRanking(){
    var modal = document.getElementById('rankingModal');
    modal.style.display = (modal.style.display === 'block') ? 'none' : 'block';
}

document.getElementById('closeRanking').onclick = function() {
    document.getElementById('rankingModal').style.display = 'none';
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
    socket.emit('nextQuestion'); //Tell server to start new question
}

function skipQuestion(){
    document.getElementById('skipQButton').disabled = true;
    clearInterval(timer);
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

// Fallback: primer gesto del usuario en la vista de juego
document.addEventListener('pointerdown', function(){
    ensureHostMusicPlaying();
}, { once: true, passive: true });
