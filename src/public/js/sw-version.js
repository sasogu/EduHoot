(function(){
    function extractVersion(cacheName){
        if(!cacheName) return '';
        var s = String(cacheName);
        var m = s.match(/eduh-pwa-(v[0-9]+(?:\.[0-9]+)*)/i);
        if(m && m[1]) return m[1];
        return s;
    }

    function setFooterVersion(text){
        var el = document.getElementById('sw-version');
        if(el){
            el.textContent = text;
            return true;
        }
        // Fallback: añadirlo al footer existente si no hay placeholder
        var about = document.querySelector('.site-footer__about');
        if(about){
            if(about.getAttribute('data-sw-version-attached') === '1') return true;
            about.setAttribute('data-sw-version-attached', '1');
            about.textContent = about.textContent + ' · ' + text;
            return true;
        }
        return false;
    }

    function requestVersionFromServiceWorker(sw){
        return new Promise(function(resolve){
            try{
                var channel = new MessageChannel();
                var settled = false;
                var timer = setTimeout(function(){
                    if(settled) return;
                    settled = true;
                    resolve(null);
                }, 800);

                channel.port1.onmessage = function(ev){
                    if(settled) return;
                    settled = true;
                    clearTimeout(timer);
                    var data = ev && ev.data ? ev.data : null;
                    resolve(data && (data.cacheName || data.version) ? (data.cacheName || data.version) : null);
                };

                sw.postMessage({ type: 'GET_SW_VERSION' }, [channel.port2]);
            }catch(e){
                resolve(null);
            }
        });
    }

    async function init(){
        if(!('serviceWorker' in navigator)) return;

        // No bloquees el render
        setFooterVersion('SW: …');

        var reg = null;
        try{
            reg = await navigator.serviceWorker.ready;
        }catch(e){
            return;
        }

        var sw = navigator.serviceWorker.controller || (reg && (reg.active || reg.waiting || reg.installing));
        if(!sw) return;

        var cacheName = await requestVersionFromServiceWorker(sw);
        if(!cacheName) return;

        var ver = extractVersion(cacheName);
        setFooterVersion('SW ' + ver);
    }

    // Esperar a DOM listo para no romper páginas sin footer
    if(document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', init);
    }else{
        init();
    }
})();
