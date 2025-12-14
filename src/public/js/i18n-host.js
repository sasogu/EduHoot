(function(){
  var translations = {
    es: {
      join_title: 'Únete a esta partida con el PIN:',
      opt_rand_q: 'Preguntas aleatorias',
      opt_rand_a: 'Respuestas aleatorias',
      opt_send_mobile: 'Enviar pregunta a los móviles',
      opt_show_scores: 'Mostrar puntuaciones entre preguntas',
      opt_time: 'Tiempo por pregunta (s)',
      start_btn: 'Iniciar partida',
      resume_btn: 'Reanudar última partida',
      cancel_btn: 'Cancelar partida',
      lang_label: 'Idioma'
    },
    en: {
      join_title: 'Join this game with the PIN:',
      opt_rand_q: 'Shuffle questions',
      opt_rand_a: 'Shuffle answers',
      opt_send_mobile: 'Send questions to mobiles',
      opt_show_scores: 'Show scores between questions',
      opt_time: 'Time per question (s)',
      start_btn: 'Start game',
      resume_btn: 'Resume last game',
      cancel_btn: 'Cancel game',
      lang_label: 'Language'
    },
    ca: {
      join_title: 'Uneix-te a la partida amb el PIN:',
      opt_rand_q: 'Preguntes aleatòries',
      opt_rand_a: 'Respostes aleatòries',
      opt_send_mobile: 'Envia preguntes als mòbils',
      opt_show_scores: 'Mostra puntuacions entre preguntes',
      opt_time: 'Temps per pregunta (s)',
      start_btn: 'Inicia partida',
      resume_btn: 'Reprèn l\'última partida',
      cancel_btn: 'Cancel·la la partida',
      lang_label: 'Idioma'
    }
  };

  function detectLang(){
    var stored = localStorage.getItem('lang-host');
    if(stored && translations[stored]) return stored;
    var nav = (navigator.language || 'es').toLowerCase();
    if(nav.startsWith('ca')) return 'ca';
    if(nav.startsWith('es')) return 'es';
    return 'en';
  }

  var lang = detectLang();

  function t(key){
    return (translations[lang] && translations[lang][key]) || translations.en[key] || key;
  }

  function apply(){
    document.querySelectorAll('[data-i18n-host]').forEach(function(el){
      var key = el.getAttribute('data-i18n-host');
      var txt = t(key);
      if(txt) el.textContent = txt;
    });
    var cancelBtn = document.getElementById('cancel');
    if(cancelBtn){
      cancelBtn.textContent = t('cancel_btn');
    }
    var langLabel = document.querySelector('.host-lang span');
    if(langLabel){
      langLabel.textContent = t('lang_label');
    }
    var select = document.getElementById('host-lang-select');
    if(select){
      select.value = lang;
    }
  }

  function setLang(newLang){
    if(translations[newLang]){
      lang = newLang;
      localStorage.setItem('lang-host', newLang);
      try{ localStorage.setItem('lang', newLang); }catch(e){}
      apply();
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    apply();
    var select = document.getElementById('host-lang-select');
    if(select){
      select.addEventListener('change', function(){
        setLang(select.value);
      });
    }
  });

  // Exponer para host.js
  window.applyHostTranslations = function(newLang){
    setLang(newLang || lang);
  };
})();
