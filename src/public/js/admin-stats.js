(function(){
  var cardsEl = document.getElementById('cards');
  var breakdownEl = document.getElementById('breakdown');
  var errorEl = document.getElementById('stats-error');
  var loginForm = document.getElementById('login-form');
  var loginEmail = document.getElementById('login-email');
  var loginPass = document.getElementById('login-pass');
  var loginStatus = document.getElementById('login-status');

  function renderCards(data){
    if(!cardsEl) return;
    cardsEl.innerHTML = '';
    var cardData = [
      { label: 'Total de quizzes', value: data.totalQuizzes, badge: 'Todos' },
      { label: 'Preguntas totales', value: data.totalQuestions, badge: 'Contenido' },
      { label: 'Partidas jugadas', value: data.totalPlays, badge: 'Histórico' },
      { label: 'Jugadores totales', value: data.totalPlayers, badge: 'Histórico' },
      { label: 'Promedio de preguntas', value: data.avgQuestionsPerQuiz, badge: 'Media' },
      { label: 'Partidas activas', value: data.liveGames, badge: 'En vivo' },
      { label: 'Jugadores activos', value: data.livePlayers, badge: 'En vivo' },
      { label: 'Quizzes efímeros', value: data.ephemeral.totalQuizzes, badge: 'Local' }
    ];
    cardData.forEach(function(item, idx){
      var card = document.createElement('div');
      card.className = 'card';
      var h3 = document.createElement('h3');
      h3.textContent = item.label;
      var val = document.createElement('p');
      val.className = 'value';
      val.textContent = item.value || 0;
      var sub = document.createElement('div');
      sub.className = 'sub';
      sub.textContent = item.badge;
      card.appendChild(h3);
      card.appendChild(val);
      card.appendChild(sub);
      cardsEl.appendChild(card);
    });
  }

  function renderBreakdown(data){
    if(!breakdownEl) return;
    breakdownEl.innerHTML = '';
    var visPanel = document.createElement('div');
    visPanel.className = 'panel';
    var visTitle = document.createElement('h4');
    visTitle.textContent = 'Visibilidad';
    var ul = document.createElement('ul');
    ['public','unlisted','private'].forEach(function(key){
      var li = document.createElement('li');
      li.innerHTML = '<span>'+key+'</span><span class="value">'+(data.visibilityCounts[key] || 0)+'</span>';
      ul.appendChild(li);
    });
    visPanel.appendChild(visTitle);
    visPanel.appendChild(ul);

    var ephPanel = document.createElement('div');
    ephPanel.className = 'panel';
    var ephTitle = document.createElement('h4');
    ephTitle.textContent = 'Quizzes efímeros';
    var ul2 = document.createElement('ul');
    var li1 = document.createElement('li');
    li1.innerHTML = '<span>Quizzes</span><span class="value">'+(data.ephemeral.totalQuizzes || 0)+'</span>';
    var li2 = document.createElement('li');
    li2.innerHTML = '<span>Preguntas</span><span class="value">'+(data.ephemeral.totalQuestions || 0)+'</span>';
    ul2.appendChild(li1);
    ul2.appendChild(li2);
    ephPanel.appendChild(ephTitle);
    ephPanel.appendChild(ul2);

    breakdownEl.appendChild(visPanel);
    breakdownEl.appendChild(ephPanel);
  }

  function showError(msg){
    if(errorEl){
      errorEl.textContent = msg || 'No se pudieron cargar las estadísticas.';
    }
  }

  function loadStats(){
    fetch('/api/admin/stats', { credentials: 'include' })
      .then(function(res){
        if(!res.ok) throw new Error('Error HTTP '+res.status);
        return res.json();
      })
      .then(function(payload){
        if(!payload || !payload.data) throw new Error('Respuesta incompleta');
        renderCards(payload.data);
        renderBreakdown(payload.data);
        if(errorEl) errorEl.textContent = '';
      })
      .catch(function(err){
        console.error(err);
        showError('No se pudieron cargar las estadísticas. ¿Tienes sesión de admin iniciada?');
      });
  }

  loadStats();

  if(loginForm){
    loginForm.addEventListener('submit', function(e){
      e.preventDefault();
      if(!loginEmail || !loginPass) return;
      if(loginStatus) loginStatus.textContent = '...';
      fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: (loginEmail.value || '').trim(),
          password: loginPass.value
        })
      }).then(function(res){ return res.json().then(function(body){ return { ok: res.ok, body: body }; }); })
      .then(function(result){
        if(!result.ok){
          if(loginStatus) loginStatus.textContent = result.body.error || 'Login fallido';
          return;
        }
        if(loginStatus) loginStatus.textContent = 'Ok';
        loginPass.value = '';
        loadStats();
      })
      .catch(function(){
        if(loginStatus) loginStatus.textContent = 'Error de red';
      });
    });
  }
})();
