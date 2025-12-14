var socket = io();
var params = jQuery.deparam(window.location.search);
var lastHostKey = 'lastHostId';
var lastPinKey = 'lastGamePin';
var resumeBtn = document.getElementById('resume-last');
var hostLangSelect = document.getElementById('host-lang-select');

function syncLangStorage(val){
    if(!val) return;
    try{
        localStorage.setItem('lang-host', val);
        localStorage.setItem('lang', val); // reutiliza la misma clave que usa la vista de juego
    }catch(e){}
}

function resumeLast(){
    try{
        var saved = localStorage.getItem(lastHostKey);
        var pin = localStorage.getItem(lastPinKey);
        if(saved || pin){
            var url = "/host/game/?";
            var parts = [];
            if(saved) parts.push('id=' + encodeURIComponent(saved));
            if(pin) parts.push('pin=' + encodeURIComponent(pin));
            window.location.href = url + parts.join('&');
        }
    }catch(e){}
}

// Mostrar botón de reanudar si hay partida activa guardada
try{
    var savedHost = localStorage.getItem(lastHostKey);
    if((savedHost || localStorage.getItem(lastPinKey)) && resumeBtn){
        resumeBtn.style.display = 'inline-block';
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
    });
}

//When host connects to server
socket.on('connect', function() {

    document.getElementById('players').value = "";
    
    //Tell server that it is host connection
    socket.emit('host-join', params);
});

socket.on('showGamePin', function(data){
   document.getElementById('gamePinText').innerHTML = data.pin;
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
   window.location.href = '../../';//Redirect user to 'join game' page
});
