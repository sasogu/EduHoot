class LiveGames {
    constructor () {
        this.games = [];
    }
    addGame(pin, hostId, gameLive, gameData){
        var game = {pin, hostId, gameLive, gameData};
        this.games.push(game);
        return game;
    }
    removeGame(hostId){
        var game = this.getGame(hostId);
        
        if(game){
            this.games = this.games.filter((game) => game.hostId !== hostId);
        }
        return game;
    }
    getGame(hostId){
        return this.games.filter((game) => game.hostId === hostId)[0]
    }
    getGameByPin(pin){
        const matches = this.games.filter((game) => game.pin.toString() === pin.toString());
        return matches.length ? matches[matches.length - 1] : undefined;
    }
}

module.exports = {LiveGames};
