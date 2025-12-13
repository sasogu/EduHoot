var socket = io();
var params = jQuery.deparam(window.location.search);

//When host connects to server
socket.on('connect', function() {

    document.getElementById('players').value = "";
    
    //Tell server that it is host connection
    socket.emit('host-join', params);
});

socket.on('showGamePin', function(data){
   document.getElementById('gamePinText').innerHTML = data.pin;
});

//Adds player's name to screen and updates player count
socket.on('updatePlayerLobby', function(data){
    
    document.getElementById('players').value = "";
    
    for(var i = 0; i < data.length; i++){
        var icon = data[i].icon ? data[i].icon + " " : "";
        document.getElementById('players').value += icon + data[i].name + "\n";
    }
    
});

//Tell server to start game if button is clicked
function startGame(){
    var opts = {
        randomQuestions: document.getElementById('opt-rand-q') ? document.getElementById('opt-rand-q').checked : true,
        randomAnswers: document.getElementById('opt-rand-a') ? document.getElementById('opt-rand-a').checked : true,
        sendToMobile: document.getElementById('opt-send-mobile') ? document.getElementById('opt-send-mobile').checked : true,
        showScoresBetween: document.getElementById('opt-show-scores') ? document.getElementById('opt-show-scores').checked : true
    };
    socket.emit('startGame', opts);
}
function endGame(){
    window.location.href = "/";
}

//When server starts the game
socket.on('gameStarted', function(id){
    console.log('Game Started!');
    window.location.href="/host/game/" + "?id=" + id;
});

socket.on('noGameFound', function(){
   window.location.href = '../../';//Redirect user to 'join game' page
});
