var socket = io();
var params = jQuery.deparam(window.location.search);
var lastHostKey = 'lastHostId';
var lastPinKey = 'lastGamePin';
var hostLangSelect = document.getElementById('host-lang-select');
var baseJoinUrl = 'https://eduhoot.edutictac.es/';
var joinQrImg = document.getElementById('join-qr');
var joinUrlAnchor = document.getElementById('join-url');
var gamePinText = document.getElementById('gamePinText');
var hostError = document.getElementById('host-error');
var pinLoaded = false;
var hostErrorTimeout = null;

var HOST_AUTOPLAY_MUSIC_KEY = 'eduhoot_host_autoplay_music';

var hostLobbyMusicPlayerInstance = null;

var hostLobbyMusicI18n = {
    es: {
        bgMusicTitle: 'Música de fondo',
        bgMusicChoose: 'Elige un tema',
        bgMusicPlay: 'Reproducir música',
        bgMusicPause: 'Pausar música',
        bgMusicPrev: 'Anterior',
        bgMusicNext: 'Siguiente',
        bgMusicVolume: 'Volumen'
    },
    en: {
        bgMusicTitle: 'Background music',
        bgMusicChoose: 'Choose a track',
        bgMusicPlay: 'Play music',
        bgMusicPause: 'Pause music',
        bgMusicPrev: 'Prev',
        bgMusicNext: 'Next',
        bgMusicVolume: 'Volume'
    },
    ca: {
        bgMusicTitle: 'Música de fons',
        bgMusicChoose: 'Tria un tema',
        bgMusicPlay: 'Reprodueix música',
        bgMusicPause: 'Atura la música',
        bgMusicPrev: 'Anterior',
        bgMusicNext: 'Següent',
        bgMusicVolume: 'Volum'
    }
};

function getHostLobbyLang(){
    var l = null;
    try{ l = localStorage.getItem('lang-host') || localStorage.getItem('lang'); }catch(e){}
    if(l && hostLobbyMusicI18n[l]) return l;
    return 'es';
}

function hostLobbyT(key){
    var l = getHostLobbyLang();
    return (hostLobbyMusicI18n[l] && hostLobbyMusicI18n[l][key]) || hostLobbyMusicI18n.es[key] || key;
}

function updateHostLobbyMusicLabels(){
    if(!hostLobbyMusicPlayerInstance || typeof hostLobbyMusicPlayerInstance.updateLabels !== 'function') return;
    hostLobbyMusicPlayerInstance.updateLabels({
        title: hostLobbyT('bgMusicTitle'),
        choose: hostLobbyT('bgMusicChoose'),
        play: hostLobbyT('bgMusicPlay'),
        pause: hostLobbyT('bgMusicPause'),
        prev: hostLobbyT('bgMusicPrev'),
        next: hostLobbyT('bgMusicNext'),
        volume: hostLobbyT('bgMusicVolume')
    });
}

function initHostLobbyMusicPlayer(){
    if(typeof initBackgroundMusic !== 'function') return;
    hostLobbyMusicPlayerInstance = initBackgroundMusic('#host-lobby-music-player', {
        // Reutiliza la misma selección que en la vista de juego.
        storageKey: 'eduhoot-host-music',
        randomStart: true,
        volume: 0.7,
        labels: {
            title: hostLobbyT('bgMusicTitle'),
            choose: hostLobbyT('bgMusicChoose'),
            play: hostLobbyT('bgMusicPlay'),
            pause: hostLobbyT('bgMusicPause'),
            prev: hostLobbyT('bgMusicPrev'),
            next: hostLobbyT('bgMusicNext'),
            volume: hostLobbyT('bgMusicVolume')
        }
    });
}

function buildJoinUrl(pin){
    if(pin){
        return baseJoinUrl + '?pin=' + encodeURIComponent(pin);
    }
    return baseJoinUrl;
}

function updateJoinQr(pin){
    var url = buildJoinUrl(pin);
    var qrSize = 240;
    if(joinQrImg){
        joinQrImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=' + qrSize + 'x' + qrSize + '&data=' + encodeURIComponent(url);
        joinQrImg.setAttribute('aria-label', url);
    }
    if(joinUrlAnchor){
        joinUrlAnchor.href = url;
        joinUrlAnchor.textContent = url.replace(/^https?:\/\/(www\.)?/, '');
    }
}

function setDisplayedPin(pin){
    var safePin = (pin || '').toString();
    pinLoaded = !!pin;
    if(gamePinText){
        gamePinText.textContent = safePin || '—';
    }
    updateJoinQr(safePin);
}

function showHostError(msg){
    if(!hostError) return;
    hostError.textContent = msg || '';
    hostError.style.display = 'block';
}

function syncLangStorage(val){
    if(!val) return;
    try{
        localStorage.setItem('lang-host', val);
        localStorage.setItem('lang', val); // reutiliza la misma clave que usa la vista de juego
    }catch(e){}
}

// Mostrar botón de reanudar si hay partida activa guardada
try{
    var savedHost = localStorage.getItem(lastHostKey);
    var storedPin = localStorage.getItem(lastPinKey);
    if(storedPin){
        setDisplayedPin(storedPin);
    }else{
        updateJoinQr();
    }
    // inicializar selector de idioma con preferencia previa
    var storedLang = localStorage.getItem('lang-host') || localStorage.getItem('lang');
    if(hostLangSelect && storedLang){
        hostLangSelect.value = storedLang;
        syncLangStorage(storedLang);
    }
}catch(e){}

if(hostLangSelect){
    hostLangSelect.addEventListener('change', function(){
        syncLangStorage(hostLangSelect.value);
        if(window.applyHostTranslations){
            window.applyHostTranslations(hostLangSelect.value);
        }
        updateHostLobbyMusicLabels();
    });
}

initHostLobbyMusicPlayer();

//When host connects to server
socket.on('connect', function() {
    document.getElementById('players').value = "";
    if(!params.id){
        showHostError((window.getHostTranslation && window.getHostTranslation('host_error_missing_id')) || 'Falta el quiz para generar la partida. Vuelve a elegirlo.');
        return;
    }
    //Tell server that it is host connection
    socket.emit('host-join', params);
    setTimeout(function(){
        if(!pinLoaded){
            socket.emit('host-join', params);
        }
    }, 2000);
    clearTimeout(hostErrorTimeout);
    hostErrorTimeout = setTimeout(function(){
        if(!pinLoaded){
            showHostError((window.getHostTranslation && window.getHostTranslation('host_error_timeout')) || 'No pudimos obtener el PIN. Revisa la conexión y vuelve a elegir el quiz.');
        }
    }, 4000);
});

socket.on('showGamePin', function(data){
   setDisplayedPin(data.pin);
   try{ localStorage.setItem(lastPinKey, data.pin); }catch(e){}
});

//Adds player's name to screen and updates player count
socket.on('updatePlayerLobby', function(data){
    
    var container = document.getElementById('players');
    if(!container) return;
    container.innerHTML = '';
    for(var i = 0; i < data.length; i++){
        var icon = data[i].icon ? data[i].icon : '';
        var item = document.createElement('div');
        item.className = 'player-item';
        var iconEl = document.createElement('span');
        iconEl.className = 'player-icon';
        iconEl.textContent = icon;
        var nameEl = document.createElement('span');
        nameEl.className = 'player-name';
        nameEl.textContent = data[i].name || '';
        item.appendChild(iconEl);
        item.appendChild(nameEl);
        container.appendChild(item);
    }
    
});

//Tell server to start game if button is clicked
function startGame(){
    try{ sessionStorage.setItem(HOST_AUTOPLAY_MUSIC_KEY, '1'); }catch(e){}
    var opts = {
        randomQuestions: document.getElementById('opt-rand-q') ? document.getElementById('opt-rand-q').checked : true,
        randomAnswers: document.getElementById('opt-rand-a') ? document.getElementById('opt-rand-a').checked : true,
        sendToMobile: document.getElementById('opt-send-mobile') ? document.getElementById('opt-send-mobile').checked : true,
        showScoresBetween: document.getElementById('opt-show-scores') ? document.getElementById('opt-show-scores').checked : true,
        timePerQuestion: (function(){
            var input = document.getElementById('opt-time');
            var val = input ? parseInt(input.value, 10) : 20;
            if(isNaN(val) || val < 5) val = 5;
            if(val > 120) val = 120;
            return val;
        })()
    };
    socket.emit('startGame', opts);
}
function endGame(){
    window.location.href = "/";
}

//When server starts the game
socket.on('gameStarted', function(id){
    console.log('Game Started!');
    try{ localStorage.setItem(lastHostKey, id); }catch(e){}
    var pin = null;
    try{ pin = localStorage.getItem(lastPinKey); }catch(e){}
    var qs = '?id=' + encodeURIComponent(id);
    if(pin) qs += '&pin=' + encodeURIComponent(pin);
    window.location.href="/host/game/" + qs;
});

socket.on('noGameFound', function(){
   var msg = (window.getHostTranslation && window.getHostTranslation('host_error')) || 'No se pudo iniciar la partida. Vuelve a elegir el quiz y prueba de nuevo.';
   showHostError(msg);
});
