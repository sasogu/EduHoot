var socket = io();
var playerAnswered = false;
var correct = false;
var name;
var score = 0;
var token = null;
var lastAnswers = [];
var rankingTimeout = null;
var timerTotal = 20;
var timerLeft = 20;
var timerInterval = null;

var params = jQuery.deparam(window.location.search); //Gets the id from url
if(params.token){
    token = params.token;
}else{
    try{
        var tokens = JSON.parse(localStorage.getItem('playerTokens') || '{}');
        var key = (params.pin || '') + ':' + (params.name || '');
        token = tokens[key];
    }catch(e){}
}

socket.on('connect', function() {
    //Tell server that it is host connection from game view
    var payload = Object.assign({}, params);
    if(token) payload.token = token;
    socket.emit('player-join-game', payload);
    
    document.getElementById('answer1').style.visibility = "visible";
    document.getElementById('answer2').style.visibility = "visible";
    document.getElementById('answer3').style.visibility = "visible";
    document.getElementById('answer4').style.visibility = "visible";

    // Hide language switcher once in game view
    var langSw = document.getElementById('lang-switcher');
    if (langSw) langSw.style.display = 'none';

    resetTimer();
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
        setAnswerStatus('submitted');
        
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

socket.on('questionOver', function(playerData, correctAnswer){
    setMedia(null, null);
    if(correct == true){
        document.body.style.backgroundColor = "#4CAF50";
        document.getElementById('message').style.display = "block";
        document.getElementById('message').innerHTML = window.i18nPlayer ? window.i18nPlayer.t('correct') : "Correct!";
    }else{
        document.body.style.backgroundColor = "#f94a1e";
        document.getElementById('message').style.display = "block";
        var incorrectMsg = window.i18nPlayer ? window.i18nPlayer.t('incorrect') : "Incorrect!";
        var correctLabel = window.i18nPlayer ? window.i18nPlayer.t('correct_answer') : "Correct answer:";
        var answerTxt = (lastAnswers && correctAnswer && lastAnswers[correctAnswer - 1]) ? lastAnswers[correctAnswer - 1] : '';
        document.getElementById('message').innerHTML = incorrectMsg + (answerTxt ? '<span class="player-correct-answer">' + correctLabel + ' ' + answerTxt + '</span>' : '');
    }
    setAnswerStatus('over');
    document.getElementById('answer1').style.visibility = "hidden";
    document.getElementById('answer2').style.visibility = "hidden";
    document.getElementById('answer3').style.visibility = "hidden";
    document.getElementById('answer4').style.visibility = "hidden";
    updatePlayerRank(playerData);
    stopTimer();
    if(rankingTimeout){
        clearTimeout(rankingTimeout);
    }
    rankingTimeout = setTimeout(function(){
        showPlayerRanking(playerData);
    }, 3000);
    socket.emit('getScore');
});

socket.on('newScore', function(data){
    var label = window.i18nPlayer ? window.i18nPlayer.t('score') : 'Score:';
    document.getElementById('scoreText').innerHTML = label + " " + data;
});

socket.on('nextQuestionPlayer', function(){
    correct = false;
    playerAnswered = false;
    if(rankingTimeout){
        clearTimeout(rankingTimeout);
        rankingTimeout = null;
    }
    
    document.getElementById('answer1').style.visibility = "visible";
    document.getElementById('answer2').style.visibility = "visible";
    document.getElementById('answer3').style.visibility = "visible";
    document.getElementById('answer4').style.visibility = "visible";
    document.getElementById('message').style.display = "none";
    document.body.style.backgroundColor = "white";
    document.getElementById('rankText').textContent = '';
    document.getElementById('rankText').style.display = 'none';
    hidePlayerRanking();
    stopTimer();
    resetTimer();
    setAnswerStatus('pending');
    
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
        lastAnswers = data.answers.slice(0, 4);
    }
    resetTimer();
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
    var iframe = document.getElementById('playerQuestionIframe');
    if(img){
        if(imageUrl){
            img.src = imageUrl;
            img.style.display = 'block';
        }else{
            img.removeAttribute('src');
            img.style.display = 'none';
        }
    }
    if(vid && iframe){
        var ytId = parseYouTubeId(videoUrl);
        if(ytId){
            vid.removeAttribute('src');
            vid.pause();
            vid.style.display = 'none';
            iframe.src = 'https://www.youtube-nocookie.com/embed/' + ytId;
            iframe.style.display = 'block';
        }else if(videoUrl){
            iframe.removeAttribute('src');
            iframe.style.display = 'none';
            vid.src = videoUrl;
            vid.style.display = 'block';
        }else{
            iframe.removeAttribute('src');
            iframe.style.display = 'none';
            vid.removeAttribute('src');
            vid.pause();
            vid.style.display = 'none';
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

socket.on('hostSkipped', function(){
    var skipMsg = window.i18nPlayer ? window.i18nPlayer.t('host_skipped') : 'El anfitrión saltó la pregunta';
    document.getElementById('message').style.display = "block";
    document.getElementById('message').textContent = skipMsg;
});

function showPlayerRanking(playerData){
    var modal = document.getElementById('playerRankingModal');
    var list = document.getElementById('playerRankingList');
    var title = document.getElementById('playerRankingTitle');
    if(!modal || !list){
        return;
    }
    list.innerHTML = '';
    var sorted = Array.isArray(playerData) ? playerData.slice().sort(function(a, b){
        return (b.gameData.score || 0) - (a.gameData.score || 0);
    }) : [];
    var top = sorted.slice(0, 10);
    var myId = socket.id;
    var youLabel = (window.i18nPlayer && window.i18nPlayer.t('player_ranking_you')) || 'You';
    if(youLabel === 'player_ranking_you') youLabel = 'You';
    top.forEach(function(p, idx){
        var icon = p.icon ? p.icon + ' ' : '';
        var meMark = p.playerId === myId ? ' (' + youLabel + ')' : '';
        var li = document.createElement('li');
        li.textContent = icon + p.name + ' - ' + (p.gameData.score || 0) + meMark;
        list.appendChild(li);
    });
    if(window.i18nPlayer && title){
        var titleText = window.i18nPlayer.t('player_ranking_title');
        title.textContent = titleText === 'player_ranking_title' ? 'Top 10' : titleText;
    }
    modal.classList.add('show');
}

function hidePlayerRanking(){
    var modal = document.getElementById('playerRankingModal');
    if(modal){
        modal.classList.remove('show');
    }
}

var playerRankingClose = document.getElementById('playerRankingClose');
if(playerRankingClose){
    playerRankingClose.addEventListener('click', function(){
        hidePlayerRanking();
    });
}

socket.on('time', function(data){
    if(typeof data.time === 'number'){
        timerLeft = Math.max(0, Math.min(timerTotal, data.time));
        updateTimerUi();
    }
});

function resetTimer(){
    timerLeft = timerTotal;
    updateTimerUi();
    if(timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(function(){
        if(timerLeft > 0){
            timerLeft -= 1;
            updateTimerUi();
        }
    }, 1000);
}

function stopTimer(){
    if(timerInterval){
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function updateTimerUi(){
    var bar = document.getElementById('playerTimerFill');
    var txt = document.getElementById('playerTimerText');
    var pct = Math.max(0, Math.min(100, (timerLeft / timerTotal) * 100));
    if(bar){
        bar.style.width = pct + '%';
        if(pct < 35){
            bar.style.background = 'linear-gradient(135deg, #f97316, #ef4444)';
        }else if(pct < 60){
            bar.style.background = 'linear-gradient(135deg, #facc15, #f97316)';
        }else{
            bar.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';
        }
    }
    if(txt){
        txt.textContent = Math.max(0, Math.ceil(timerLeft)) + 's';
    }
}

function setAnswerStatus(state){
    var statusEl = document.getElementById('playerAnswerStatus');
    if(!statusEl) return;
    if(state === 'submitted'){
        statusEl.textContent = (window.i18nPlayer && window.i18nPlayer.t('status_submitted')) || 'Respuesta enviada';
        statusEl.classList.remove('hidden');
    }else if(state === 'pending'){
        statusEl.textContent = (window.i18nPlayer && window.i18nPlayer.t('status_pending')) || 'Responde ahora';
        statusEl.classList.remove('hidden');
    }else{
        statusEl.classList.add('hidden');
    }
}
