(function(){
    var defaultTracks = [
        {
            id: 'roblox-fortnite',
            label: 'Roblox & Fortnite energy',
            url: '/music/roblox-minecraft-fortnite-video-game-music-358426.mp3'
        },
        {
            id: 'minecraft-anthem',
            label: 'Minecraft gaming loop',
            url: '/music/game-gaming-minecraft-background-music-377647.mp3'
        },
        {
            id: 'retro-arcade-1',
            label: 'Retro arcade synth',
            url: '/music/retro-arcade-game-music-297305.mp3'
        },
        {
            id: 'gaming-chill',
            label: 'Gaming chill lounge',
            url: '/music/gaming-game-minecraft-background-music-372242.mp3'
        },
        {
            id: 'retro-arcade-2',
            label: 'Retro arcade anthem',
            url: '/music/retro-arcade-game-music-408074.mp3'
        }
    ];

    function safeGetStorage(key){
        if(!key || !window.localStorage) return null;
        try{
            return localStorage.getItem(key);
        }catch(e){
            return null;
        }
    }

    function safeSetStorage(key, value){
        if(!key || !window.localStorage) return;
        try{
            localStorage.setItem(key, value);
        }catch(e){}
    }

    function trackExists(url){
        return defaultTracks.some(function(track){ return track.url === url; });
    }

    function createTrackOptions(select, savedValue){
        defaultTracks.forEach(function(track, index){
            var option = document.createElement('option');
            option.value = track.url;
            option.textContent = track.label;
            if(savedValue && track.url === savedValue){
                option.selected = true;
            }else if(!savedValue && index === 0){
                option.selected = true;
            }
            select.appendChild(option);
        });
    }

    function initBackgroundMusic(containerSelector, options){
        var container = document.querySelector(containerSelector);
        if(!container) return null;
        var opts = options || {};
        var labels = opts.labels || {};
        var storageKey = opts.storageKey;
        var savedTrack = storageKey ? safeGetStorage(storageKey) : null;
        if(savedTrack && !trackExists(savedTrack)){
            savedTrack = null;
        }
        var selectedTrack = savedTrack;
        // Solo rotamos aleatoriamente si:
        // - randomStart está activo
        // - NO hay pista guardada
        // - NO hay defaultTrack explícito
        var randomRotationEnabled = !!opts.randomStart && !savedTrack && !(opts.defaultTrack && trackExists(opts.defaultTrack));
        var userSelectedTrack = false;

        function pickRandomTrack(excludeUrl){
            if(!defaultTracks.length) return null;
            if(defaultTracks.length === 1) return defaultTracks[0].url;
            var candidate = null;
            for(var i = 0; i < 8; i++){
                candidate = defaultTracks[Math.floor(Math.random() * defaultTracks.length)].url;
                if(!excludeUrl || candidate !== excludeUrl) return candidate;
            }
            // Fallback si por azar repite
            return defaultTracks.find(function(t){ return t.url !== excludeUrl; }).url;
        }

        if(!selectedTrack){
            if(opts.defaultTrack && trackExists(opts.defaultTrack)){
                selectedTrack = opts.defaultTrack;
            }else if(opts.randomStart){
                selectedTrack = pickRandomTrack(null) || defaultTracks[0].url;
            }else{
                selectedTrack = defaultTracks[0].url;
            }
        }
        var wrapper = document.createElement('div');
        wrapper.className = 'music-player';
        var title = document.createElement('div');
        title.className = 'music-player__header';
        title.textContent = labels.title || 'Background music';
        var chooseLabel = document.createElement('label');
        chooseLabel.className = 'music-player__label';
        var chooseText = document.createElement('span');
        chooseText.className = 'music-player__label-text';
        chooseText.textContent = labels.choose || 'Choose track';
        var select = document.createElement('select');
        select.className = 'music-player__select';
        chooseLabel.appendChild(chooseText);
        chooseLabel.appendChild(select);
        var controls = document.createElement('div');
        controls.className = 'music-player__controls';

        var prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.className = 'music-player__nav music-player__nav--prev';
        prevBtn.textContent = labels.prev || 'Prev';

        var playBtn = document.createElement('button');
        playBtn.type = 'button';
        playBtn.className = 'music-player__toggle';
        playBtn.textContent = labels.play || 'Play music';

        var nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'music-player__nav music-player__nav--next';
        nextBtn.textContent = labels.next || 'Next';

        var volumeLabel = document.createElement('label');
        volumeLabel.className = 'music-player__label music-player__label--inline';
        var volumeText = document.createElement('span');
        volumeText.className = 'music-player__label-text';
        volumeText.textContent = labels.volume || 'Volume';
        var volumeInput = document.createElement('input');
        volumeInput.type = 'range';
        volumeInput.min = '0';
        volumeInput.max = '1';
        volumeInput.step = '0.05';
        volumeInput.value = typeof opts.volume === 'number' ? opts.volume : 0.6;
        volumeInput.className = 'music-player__volume';
        volumeLabel.appendChild(volumeText);
        volumeLabel.appendChild(volumeInput);

        controls.appendChild(prevBtn);
        controls.appendChild(playBtn);
        controls.appendChild(nextBtn);
        controls.appendChild(volumeLabel);
        wrapper.appendChild(title);
        wrapper.appendChild(chooseLabel);
        wrapper.appendChild(controls);
        var audio = document.createElement('audio');
        audio.preload = 'auto';
        audio.loop = !randomRotationEnabled;
        audio.volume = typeof opts.volume === 'number' ? opts.volume : 0.6;
        audio.src = selectedTrack;
        audio.style.display = 'none';
        wrapper.appendChild(audio);
        container.appendChild(wrapper);
        createTrackOptions(select, selectedTrack);
        select.value = selectedTrack;
        var isPlaying = false;
        function updatePlayButton(){
            if(isPlaying){
                playBtn.textContent = labels.pause || 'Pause music';
                playBtn.setAttribute('aria-pressed', 'true');
            }else{
                playBtn.textContent = labels.play || 'Play music';
                playBtn.setAttribute('aria-pressed', 'false');
            }
        }

        function getTrackIndex(url){
            if(!url) return -1;
            for(var i = 0; i < defaultTracks.length; i++){
                if(defaultTracks[i].url === url) return i;
            }
            return -1;
        }

        function applyUserTrackSelection(url){
            if(!url) return;
            userSelectedTrack = true;
            if(randomRotationEnabled){
                randomRotationEnabled = false;
                audio.loop = true;
            }
            audio.src = url;
            select.value = url;
            if(storageKey){
                safeSetStorage(storageKey, url);
            }
            if(isPlaying){
                audio.play().catch(function(){});
            }
        }

        function goToDelta(delta){
            var currentUrl = select.value || audio.src;
            var idx = getTrackIndex(currentUrl);
            if(idx < 0) idx = 0;
            var nextIndex = (idx + delta) % defaultTracks.length;
            if(nextIndex < 0) nextIndex = defaultTracks.length - 1;
            applyUserTrackSelection(defaultTracks[nextIndex].url);
        }

        audio.addEventListener('ended', function(){
            if(!randomRotationEnabled || userSelectedTrack) return;
            var nextUrl = pickRandomTrack(audio.src);
            if(!nextUrl) return;
            audio.src = nextUrl;
            select.value = nextUrl;
            if(isPlaying){
                audio.play().catch(function(){});
            }
        });

        prevBtn.addEventListener('click', function(){
            goToDelta(-1);
        });
        nextBtn.addEventListener('click', function(){
            goToDelta(1);
        });

        function play(){
            if(isPlaying) return Promise.resolve();
            return audio.play().then(function(){
                isPlaying = true;
                updatePlayButton();
            }).catch(function(){});
        }

        function pause(){
            if(!isPlaying) return;
            audio.pause();
            isPlaying = false;
            updatePlayButton();
        }

        playBtn.addEventListener('click', function(){
            if(isPlaying){
                pause();
                return;
            }
            play();
        });
        select.addEventListener('change', function(){
            var value = select.value;
            if(!value) return;
            applyUserTrackSelection(value);
        });
        volumeInput.addEventListener('input', function(){
            audio.volume = parseFloat(volumeInput.value);
        });
        function updateLabels(newLabels){
            if(!newLabels) return;
            if(newLabels.title){
                title.textContent = newLabels.title;
            }
            if(newLabels.choose){
                chooseText.textContent = newLabels.choose;
            }
            if(newLabels.volume){
                volumeText.textContent = newLabels.volume;
            }
            if(newLabels.prev){
                prevBtn.textContent = newLabels.prev;
            }
            if(newLabels.next){
                nextBtn.textContent = newLabels.next;
            }
            if(isPlaying){
                if(newLabels.pause){
                    playBtn.textContent = newLabels.pause;
                }
            }else{
                if(newLabels.play){
                    playBtn.textContent = newLabels.play;
                }
            }
        }
        updatePlayButton();
        return {
            audio: audio,
            updateLabels: updateLabels,
            play: play,
            pause: pause,
            isPlaying: function(){ return isPlaying; }
        };
    }
    window.initBackgroundMusic = initBackgroundMusic;
})();
