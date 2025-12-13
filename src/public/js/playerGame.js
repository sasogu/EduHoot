var socket = io();
var playerAnswered = false;
var correct = false;
var name;
var score = 0;

var params = jQuery.deparam(window.location.search); //Gets the id from url

socket.on('connect', function() {
    //Tell server that it is host connection from game view
    socket.emit('player-join-game', params);
    
    document.getElementById('answer1').style.visibility = "visible";
    document.getElementById('answer2').style.visibility = "visible";
    document.getElementById('answer3').style.visibility = "visible";
    document.getElementById('answer4').style.visibility = "visible";

    // Hide language switcher once in game view
    var langSw = document.getElementById('lang-switcher');
    if (langSw) langSw.style.display = 'none';
});

socket.on('noGameFound', function(){
    window.location.href = '../../';//Redirect user to 'join game' page 
});

function answerSubmitted(num){
    if(playerAnswered == false){
        playerAnswered = true;
        
        socket.emit('playerAnswer', num);//Sends player answer to server
        
        //Hiding buttons from user
        document.getElementById('answer1').style.visibility = "hidden";
        document.getElementById('answer2').style.visibility = "hidden";
        document.getElementById('answer3').style.visibility = "hidden";
        document.getElementById('answer4').style.visibility = "hidden";
        document.getElementById('message').style.display = "block";
        var submitted = window.i18nPlayer ? window.i18nPlayer.t('submitted') : "Answer Submitted! Waiting on other players...";
        document.getElementById('message').innerHTML = submitted;
        
    }
}

//Get results on last question
socket.on('answerResult', function(data){
    if(data == true){
        correct = true;
    }
});

function updatePlayerRank(playerData){
    var rankEl = document.getElementById('rankText');
    if(!rankEl){
        return;
    }
    if(!Array.isArray(playerData) || playerData.length === 0){
        rankEl.textContent = '';
        rankEl.style.display = 'none';
        return;
    }
    var sorted = playerData.slice().sort(function(a, b){
        return (b.gameData.score || 0) - (a.gameData.score || 0);
    });
    var position = sorted.findIndex(function(p){ return p.playerId === socket.id; });
    if(position !== -1 && position < 10){
        var label = window.i18nPlayer ? window.i18nPlayer.t('rank_top') : 'Top 10 - Puesto';
        rankEl.textContent = label + ' ' + (position + 1);
        rankEl.style.display = 'block';
    }else{
        var outside = window.i18nPlayer ? window.i18nPlayer.t('rank_out') : 'Fuera del Top 10';
        rankEl.textContent = outside;
        rankEl.style.display = outside ? 'block' : 'none';
    }
}

socket.on('questionOver', function(playerData){
    if(correct == true){
        document.body.style.backgroundColor = "#4CAF50";
        document.getElementById('message').style.display = "block";
        document.getElementById('message').innerHTML = window.i18nPlayer ? window.i18nPlayer.t('correct') : "Correct!";
    }else{
        document.body.style.backgroundColor = "#f94a1e";
        document.getElementById('message').style.display = "block";
        document.getElementById('message').innerHTML = window.i18nPlayer ? window.i18nPlayer.t('incorrect') : "Incorrect!";
    }
    document.getElementById('answer1').style.visibility = "hidden";
    document.getElementById('answer2').style.visibility = "hidden";
    document.getElementById('answer3').style.visibility = "hidden";
    document.getElementById('answer4').style.visibility = "hidden";
    updatePlayerRank(playerData);
    socket.emit('getScore');
});

socket.on('newScore', function(data){
    var label = window.i18nPlayer ? window.i18nPlayer.t('score') : 'Score:';
    document.getElementById('scoreText').innerHTML = label + " " + data;
});

socket.on('nextQuestionPlayer', function(){
    correct = false;
    playerAnswered = false;
    
    document.getElementById('answer1').style.visibility = "visible";
    document.getElementById('answer2').style.visibility = "visible";
    document.getElementById('answer3').style.visibility = "visible";
    document.getElementById('answer4').style.visibility = "visible";
    document.getElementById('message').style.display = "none";
    document.body.style.backgroundColor = "white";
    document.getElementById('rankText').textContent = '';
    document.getElementById('rankText').style.display = 'none';
    
});

socket.on('hostDisconnect', function(){
    window.location.href = "../../";
});

socket.on('playerGameData', function(data){
   for(var i = 0; i < data.length; i++){
       if(data[i].playerId == socket.id){
           var nameLabel = window.i18nPlayer ? window.i18nPlayer.t('name') : 'Name:';
           var scoreLabel = window.i18nPlayer ? window.i18nPlayer.t('score') : 'Score:';
           var icon = data[i].icon ? data[i].icon + " " : "";
           document.getElementById('nameText').innerHTML = nameLabel + " " + icon + data[i].name;
           document.getElementById('scoreText').innerHTML = scoreLabel + " " + data[i].gameData.score;
       }
   }
});

socket.on('questionMedia', function(data){
    setMedia(data && data.image, data && data.video);
});

socket.on('playerQuestion', function(data){
    if(data.question){
        document.getElementById('questionText').textContent = data.question;
    }
    if(data.answers && data.answers.length >= 4){
        document.getElementById('answer1').textContent = data.answers[0];
        document.getElementById('answer2').textContent = data.answers[1];
        document.getElementById('answer3').textContent = data.answers[2];
        document.getElementById('answer4').textContent = data.answers[3];
    }
    setMedia(data.image, data.video);
});

socket.on('GameOver', function(){
    document.body.style.backgroundColor = "#FFFFFF";
    document.getElementById('answer1').style.visibility = "hidden";
    document.getElementById('answer2').style.visibility = "hidden";
    document.getElementById('answer3').style.visibility = "hidden";
    document.getElementById('answer4').style.visibility = "hidden";
    document.getElementById('message').style.display = "block";
    document.getElementById('message').innerHTML = window.i18nPlayer ? window.i18nPlayer.t('game_over') : "GAME OVER";
});

function setMedia(imageUrl, videoUrl){
    var img = document.getElementById('playerQuestionImage');
    var vid = document.getElementById('playerQuestionVideo');
    if(img){
        if(imageUrl){
            img.src = imageUrl;
            img.style.display = 'block';
        }else{
            img.removeAttribute('src');
            img.style.display = 'none';
        }
    }
    if(vid){
        if(videoUrl){
            vid.src = videoUrl;
            vid.style.display = 'block';
        }else{
            vid.removeAttribute('src');
            vid.pause();
            vid.style.display = 'none';
        }
    }
}
