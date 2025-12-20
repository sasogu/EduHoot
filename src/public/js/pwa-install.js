(function(){
    var installBtn = document.getElementById('installApp');
    var deferredPrompt = null;
    var installDismissKey = 'pwa-install-dismissed';

    function hideInstall(){
        if(installBtn){
            installBtn.hidden = true;
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

    function maybeShowInstall(){
        if(!installBtn) return;
        if(!isChromiumBrowser()) return hideInstall();
        if(isInstalled()) return hideInstall();
        if(localStorage.getItem(installDismissKey) === '1') return;
        if(!deferredPrompt) return;
        installBtn.hidden = false;
    }

    window.addEventListener('beforeinstallprompt', function(e){
        e.preventDefault();
        if(!isChromiumBrowser()) return;
        deferredPrompt = e;
        maybeShowInstall();
    });

    window.addEventListener('appinstalled', function(){
        deferredPrompt = null;
        hideInstall();
        localStorage.setItem(installDismissKey, '1');
    });

    if(installBtn){
        installBtn.addEventListener('click', function(){
            if(!deferredPrompt) return;
            installBtn.disabled = true;
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then(function(choiceResult){
                if(choiceResult.outcome === 'accepted'){
                    hideInstall();
                }else{
                    localStorage.setItem(installDismissKey, '1');
                }
            }).finally(function(){
                deferredPrompt = null;
                installBtn.disabled = false;
            });
        });
    }

    if('serviceWorker' in navigator){
        window.addEventListener('load', function(){
            navigator.serviceWorker.register('/sw.js').then(function(reg){
                if(reg && typeof reg.update === 'function'){
                    reg.update();
                }
            }).catch(function(err){
                console.warn('SW registration failed', err);
            });
        });
    }
})();
