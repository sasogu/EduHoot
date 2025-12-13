class Players {
    constructor () {
        this.players = [];
        this.tokens = new Map(); // token -> { hostId, playerId }
    }
    addPlayer(hostId, playerId, name, gameData, icon, token){
        var player = {hostId, playerId, name, icon: icon || '', gameData};
        this.players.push(player);
        if(token){
            this.tokens.set(token, { hostId, playerId });
        }
        return player;
    }
    removePlayer(playerId){
        var player = this.getPlayer(playerId);
        
        if(player){
            this.players = this.players.filter((player) => player.playerId !== playerId);
        }
        return player;
    }
    getByToken(token){
        if(!token) return null;
        const link = this.tokens.get(token);
        if(!link) return null;
        return this.getPlayer(link.playerId);
    }
    getPlayer(playerId){
        return this.players.filter((player) => player.playerId === playerId)[0]
    }
    getPlayers(hostId){
        return this.players.filter((player) => player.hostId === hostId);
    }
}

module.exports = {Players};
