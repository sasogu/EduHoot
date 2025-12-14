(function(){
    var picker = document.getElementById('icon-picker');
    var hiddenIcon = document.getElementById('icon');
    var preview = document.getElementById('icon-preview');
    var joinForm = document.querySelector('form[action="/player/"]') || document.querySelector('form');
    var pinInput = document.getElementById('pin');
    var nameInput = document.getElementById('name');
    var tokenInput = document.getElementById('token');
    var joinButton = document.getElementById('joinButton');
    var pinModal = document.getElementById('pinModal');
    var pinModalForm = document.getElementById('pinModalForm');
    var pinModalInput = document.getElementById('pinModalInput');
    var pinModalError = document.getElementById('pinModalError');
    var pinDisplay = document.getElementById('pin-display');
    var pinDisplayValue = document.getElementById('pin-display-value');
    var installCard = document.getElementById('install-card');
    var installNowBtn = document.getElementById('installNow');
    var installSkipBtn = document.getElementById('installSkip');
    var pinValidated = false;
    var validating = false;
    var deferredPrompt = null;
    var installDismissKey = 'pwa-install-dismissed';

    function t(key, fallback){
        if(window.i18nPlayer && typeof window.i18nPlayer.t === 'function'){
            return window.i18nPlayer.t(key);
        }
        return fallback || key;
    }

    function selectIcon(btn){
        if(!btn || !hiddenIcon) return;
        hiddenIcon.value = btn.dataset.icon || '';
        if(picker){
            picker.querySelectorAll('button').forEach(function(b){
                b.classList.toggle('selected', b === btn);
            });
        }
        if(preview) preview.textContent = btn.dataset.icon || '';
    }

    if (picker && hiddenIcon) {
        picker.addEventListener('click', function(ev){
            if (ev.target && ev.target.dataset.icon) {
                selectIcon(ev.target);
            }
        });
        var first = picker.querySelector('button[data-icon]');
        if (first) {
            selectIcon(first);
        }
    }

    function loadTokens(){
        try{
            return JSON.parse(localStorage.getItem('playerTokens') || '{}');
        }catch(e){
            return {};
        }
    }
    function saveTokens(obj){
        localStorage.setItem('playerTokens', JSON.stringify(obj));
    }
    function genToken(){
        var arr = new Uint8Array(16);
        crypto.getRandomValues(arr);
        return Array.from(arr).map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
    }

    function showModal(){
        if(pinModal){
            pinModal.classList.remove('hidden');
        }
        document.body.classList.add('modal-open');
        if(pinModalInput){
            pinModalInput.focus();
        }
    }

    function hideModal(){
        if(pinModal){
            pinModal.classList.add('hidden');
        }
        document.body.classList.remove('modal-open');
    }

    function setError(msg){
        if(pinModalError){
            pinModalError.textContent = msg || '';
        }
    }

    function setLoading(isLoading){
        validating = isLoading;
        var btn = document.getElementById('pinModalSubmit');
        if(btn){
            btn.disabled = !!isLoading;
            btn.classList.toggle('is-loading', !!isLoading);
        }
        if(pinModalInput){
            pinModalInput.disabled = !!isLoading;
        }
    }

    function applyValidPin(pin){
        pinValidated = true;
        if(pinInput) pinInput.value = pin;
        if(joinButton) joinButton.disabled = false;
        if(pinDisplay && pinDisplayValue){
            pinDisplay.classList.remove('hidden');
            pinDisplayValue.textContent = pin;
        }
        hideModal();
        if(nameInput) nameInput.focus();
        maybeShowInstallPrompt();
    }

    function validatePin(pin){
        if(!pin || validating){
            setError(t('join_pin_error', 'Ingresa un PIN valido.'));
            return;
        }
        setLoading(true);
        setError('');
        fetch('/api/validate-pin/' + encodeURIComponent(pin), {
            headers: { 'Accept': 'application/json' }
        })
            .then(function(res){ return res.json(); })
            .then(function(data){
                if(data && data.valid){
                    applyValidPin(pin);
                }else{
                    setError(t('join_pin_error', 'PIN incorrecto. Intenta de nuevo.'));
                    if(pinModalInput) pinModalInput.focus();
                }
            })
            .catch(function(){
                setError(t('join_pin_error', 'No pudimos validar el PIN. Intenta nuevamente.'));
            })
            .finally(function(){
                setLoading(false);
            });
    }

    if(pinModalForm){
        pinModalForm.addEventListener('submit', function(ev){
            ev.preventDefault();
            var pinVal = (pinModalInput && pinModalInput.value || '').trim();
            validatePin(pinVal);
        });
    }

    if(joinForm && pinInput && nameInput && tokenInput){
        joinForm.addEventListener('submit', function(ev){
            var pinVal = (pinInput.value || '').trim();
            if(!pinValidated || !pinVal){
                ev.preventDefault();
                showModal();
                setError(t('join_pin_error', 'Necesitas un PIN válido para entrar.'));
                return;
            }
            var name = (nameInput.value || '').trim();
            if(!name){
                ev.preventDefault();
                nameInput.focus();
                return;
            }
            var tokens = loadTokens();
            var key = pinVal + ':' + name;
            if(!tokens[key]){
                tokens[key] = genToken();
                saveTokens(tokens);
            }
            tokenInput.value = tokens[key];
        });
    }

    function hideInstallCard(){
        if(installCard){
            installCard.classList.add('hidden');
        }
    }

    function isInstalled(){
        return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    }

    function isChromiumBrowser(){
        var ua = navigator.userAgent || '';
        var isEdge = ua.includes('Edg/');
        var isChrome = ua.includes('Chrome/') || ua.includes('CriOS/');
        var isOpera = ua.includes('OPR/');
        var isBrave = ua.includes('Brave/');
        return (isChrome || isEdge || isOpera || isBrave) && !ua.includes('Firefox/');
    }

    function maybeShowInstallPrompt(){
        if(!pinValidated) return;
        if(!isChromiumBrowser()) return hideInstallCard();
        if(isInstalled()) return hideInstallCard();
        if(localStorage.getItem(installDismissKey) === '1') return;
        if(!deferredPrompt) return;
        if(installCard){
            installCard.classList.remove('hidden');
        }
    }

    window.addEventListener('beforeinstallprompt', function(e){
        e.preventDefault();
        if(!isChromiumBrowser()) return;
        deferredPrompt = e;
        maybeShowInstallPrompt();
    });

    window.addEventListener('appinstalled', function(){
        deferredPrompt = null;
        hideInstallCard();
        localStorage.setItem(installDismissKey, '1');
    });

    if(installNowBtn){
        installNowBtn.addEventListener('click', function(){
            if(!deferredPrompt) return;
            installNowBtn.disabled = true;
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then(function(choiceResult){
                if(choiceResult.outcome === 'accepted'){
                    hideInstallCard();
                }else{
                    localStorage.setItem(installDismissKey, '1');
                }
            }).finally(function(){
                deferredPrompt = null;
                installNowBtn.disabled = false;
            });
        });
    }

    if(installSkipBtn){
        installSkipBtn.addEventListener('click', function(){
            localStorage.setItem(installDismissKey, '1');
            hideInstallCard();
        });
    }

    if('serviceWorker' in navigator){
        window.addEventListener('load', function(){
            navigator.serviceWorker.register('/sw.js').catch(function(err){
                console.warn('SW registration failed', err);
            });
        });
    }

    // Si la URL ya trae un pin, validarlo automáticamente para agilizar
    var params = new URLSearchParams(window.location.search);
    var presetPin = params.get('pin');
    if(presetPin && pinModalInput){
        pinModalInput.value = presetPin;
        validatePin(presetPin.trim());
    }else{
        showModal();
    }
})();
