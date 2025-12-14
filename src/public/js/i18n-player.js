// Lightweight i18n for player-facing screens (join, lobby, game)
(function () {
  const translations = {
    es: {
      join_title: 'Únete a una partida',
      join_name: 'Nombre a mostrar',
      join_pin: 'PIN de la partida',
      join_button: 'Entrar',
      join_icon: 'Icono',
      join_pin_prompt: 'Ingresa el PIN del juego',
      join_pin_blocked: 'Necesitas un PIN válido para continuar.',
      join_continue: 'Continuar',
      join_pin_error: 'PIN incorrecto. Intenta de nuevo.',
      install_title: 'Instala EduHoot como app',
      install_subtitle: 'Acceso directo y pantalla completa desde tu dispositivo.',
      install_now: 'Instalar',
      install_skip: 'Ahora no',
      player_ranking_title: 'Top 10',
      player_ranking_close: 'Continuar',
      player_ranking_you: 'Tú',
      join_host: 'Haz clic aquí para crear una partida',
      lobby_wait: 'Esperando a que el anfitrión inicie la partida',
      lobby_check: '¿Ves tu nombre en pantalla?',
      correct: '¡Correcto!',
      incorrect: '¡Incorrecto!',
      correct_answer: 'Respuesta correcta:',
      submitted: 'Respuesta enviada. Esperando al resto...',
      status_pending: 'Responde ahora',
      status_submitted: 'Respuesta enviada',
      host_skipped: 'El anfitrión saltó la pregunta',
      score: 'Puntuación:',
      name: 'Nombre:',
      game_over: 'PARTIDA TERMINADA',
      rank_top: 'Top 10 - Puesto',
      rank_out: 'Fuera del Top 10'
    },
    ca: {
      join_title: 'Uneix-te a una partida',
      join_name: 'Nom a mostrar',
      join_pin: 'PIN de la partida',
      join_button: 'Entrar',
      join_icon: 'Icona',
      join_pin_prompt: 'Introdueix el PIN de la partida',
      join_pin_blocked: 'Necessites un PIN vàlid per continuar.',
      join_continue: 'Continua',
      join_pin_error: 'PIN incorrecte. Torna-ho a provar.',
      install_title: 'Instal·la EduHoot com a app',
      install_subtitle: 'Accés directe i pantalla completa al teu dispositiu.',
      install_now: 'Instal·lar',
      install_skip: 'Ara no',
      player_ranking_title: 'Top 10',
      player_ranking_close: 'Continua',
      player_ranking_you: 'Tu',
      join_host: 'Fes clic ací per crear una partida',
      lobby_wait: 'Esperant que l\'amfitrió inicie la partida',
      lobby_check: 'Veus el teu nom en pantalla?',
      correct: 'Correcte!',
      incorrect: 'Incorrecte!',
      correct_answer: 'Resposta correcta:',
      submitted: 'Resposta enviada. Esperant la resta...',
      status_pending: 'Respon ara',
      status_submitted: 'Resposta enviada',
      host_skipped: 'L\'amfitrió ha saltat la pregunta',
      score: 'Puntuació:',
      name: 'Nom:',
      game_over: 'PARTIDA ACABADA',
      rank_top: 'Top 10 - Posició',
      rank_out: 'Fora del Top 10'
    },
    en: {
      join_title: 'Join a Game',
      join_name: 'Display Name',
      join_pin: 'Game Pin',
      join_button: 'Join',
      join_icon: 'Icon',
      join_pin_prompt: 'Enter the game PIN',
      join_pin_blocked: 'You need a valid PIN to continue.',
      join_continue: 'Continue',
      join_pin_error: 'Invalid PIN. Please try again.',
      install_title: 'Install EduHoot as an app',
      install_subtitle: 'Quick access and fullscreen on your device.',
      install_now: 'Install',
      install_skip: 'Not now',
      player_ranking_title: 'Top 10',
      player_ranking_close: 'Continue',
      player_ranking_you: 'You',
      join_host: 'Click here to host an EduHoot',
      lobby_wait: 'Waiting on host to start the game',
      lobby_check: 'Do you see your name on the screen?',
      correct: 'Correct!',
      incorrect: 'Incorrect!',
      correct_answer: 'Correct answer:',
      submitted: 'Answer Submitted! Waiting on other players...',
      status_pending: 'Answer now',
      status_submitted: 'Answer received',
      host_skipped: 'Host skipped the question',
      score: 'Score:',
      name: 'Name:',
      game_over: 'GAME OVER',
      rank_top: 'Top 10 - Rank',
      rank_out: 'Outside Top 10'
    }
  };

  function detectLang() {
    const stored = window.localStorage.getItem('lang-player');
    if (stored && translations[stored]) return stored;
    const nav = (navigator.language || navigator.userLanguage || 'es').toLowerCase();
    if (nav.startsWith('ca')) return 'ca';
    if (nav.startsWith('es')) return 'es';
    return 'en';
  }

  const lang = detectLang();
  try {
    if (!window.localStorage.getItem('lang-player')) {
      window.localStorage.setItem('lang-player', lang);
    }
  } catch (e) {}
  if (document && document.documentElement) {
    document.documentElement.setAttribute('lang', lang);
  }
  const dict = translations[lang] || translations.en;

  function t(key) {
    return dict[key] || translations.en[key] || key;
  }

  function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const txt = t(key);
      if (txt) el.textContent = txt;
    });
    const selector = document.getElementById('lang-switcher');
    if (selector) {
      selector.querySelectorAll('button[data-lang]').forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
      });
    }
  }

  function setLang(newLang) {
    if (translations[newLang]) {
      window.localStorage.setItem('lang-player', newLang);
      window.location.reload();
    }
  }

  window.i18nPlayer = { t, lang, setLang };
  document.addEventListener('DOMContentLoaded', applyTranslations);
})();
