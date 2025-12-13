var socket = io();
var questionNum = 0; // Se incrementa cuando se añaden tarjetas
var editingId = null;

function updateDatabase(){
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
    
    var quiz = {id: editingId || 0, "name": name, "questions": questions};
    quiz.visibility = visibility;
    quiz.allowClone = allowClone;

    if(editingId){
        quiz.tags = tags;
        saveExistingQuiz(editingId, quiz);
    }else{
        quiz.tags = tags;
        socket.emit('newQuiz', quiz);
    }
}

function buildQuestionCard(num, data){
    var card = document.createElement('div');
    card.className = 'question-card';
    card.setAttribute('data-question', String(num));

    var head = document.createElement('div');
    head.className = 'question-card-head';
    var pill = document.createElement('span');
    pill.className = 'pill pill-muted';
    pill.textContent = 'Pregunta ' + String(num);
    head.appendChild(pill);

    var questionLabel = document.createElement('label');
    questionLabel.textContent = 'Enunciado';
    var questionField = document.createElement('textarea');
    questionField.className = 'question';
    questionField.id = 'q' + String(num);
    questionField.rows = 3;
    questionField.placeholder = '¿Cuál es...?';
    questionField.value = (data && data.question) || '';

    var answersWrap = document.createElement('div');
    answersWrap.className = 'answers';
    for(var n = 1; n <= 4; n++){
        var answerLabel = document.createElement('label');
        answerLabel.textContent = 'Respuesta ' + n;
        var answerField = document.createElement('input');
        answerField.id = String(num) + 'a' + n;
        answerField.type = 'text';
        answerField.placeholder = 'Opción ' + n;
        var ans = data && data.answers && data.answers[n-1];
        answerField.value = ans || '';
        answerLabel.appendChild(answerField);
        answersWrap.appendChild(answerLabel);
    }

    var correctLabel = document.createElement('label');
    correctLabel.textContent = 'Respuesta correcta (1-4)';
    var correctField = document.createElement('input');
    correctField.className = 'correct';
    correctField.id = 'correct' + String(num);
    correctField.type = 'number';
    correctField.min = '1';
    correctField.max = '4';
    correctField.value = (data && data.correct) ? data.correct : '1';

    var imageLabel = document.createElement('label');
    imageLabel.textContent = 'Imagen (URL opcional)';
    var imageField = document.createElement('input');
    imageField.id = 'img' + String(num);
    imageField.type = 'text';
    imageField.placeholder = 'https://...';
    imageField.value = (data && data.image) || '';

    var imagePreview = document.createElement('div');
    imagePreview.className = 'image-preview';
    var imageTag = document.createElement('img');
    imageTag.alt = 'Vista previa';
    imageTag.className = 'image-thumb hidden';
    imagePreview.appendChild(imageTag);

    var videoLabel = document.createElement('label');
    videoLabel.textContent = 'Video (URL opcional)';
    var videoField = document.createElement('input');
    videoField.id = 'vid' + String(num);
    videoField.type = 'text';
    videoField.placeholder = 'https://...';
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
    if (confirm("¿Seguro que quieres salir? Se perderán los cambios.")) {
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
            alert(result.error || 'No se pudo guardar el quiz.');
            return;
        }
        alert('Quiz actualizado');
        window.location.href = '../';
    }catch(err){
        alert('No se pudo guardar el quiz.');
    }
}

async function loadQuiz(id){
    try{
        var res = await fetch('/api/quizzes/' + id);
        var quiz = await res.json();
        if(!res.ok){
            alert(quiz.error || 'No se pudo cargar el quiz.');
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
