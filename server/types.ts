export interface Player {
    id: string;
    x: number;
    y: number;
    size: number;
    color: string;
}

export interface Food {
    id: string;
    x: number;
    y: number;
    size: number;
    color: string;
}

export interface GameState {
    players: Player[];
    food: Food[];
}

export interface WorldBounds {
    width: number;
    height: number;
}

export interface GameSnapshot {
    tick: number;
    timestamp: number;
    bounds: WorldBounds;
    state: GameState;
}

export interface JoinMessage {
    type: "join";
    name: string;
    color: string;
}

export interface MoveMessage {
    type: "move";
    targetX: number;
    targetY: number;
}

export interface PingMessage {
    type: "ping";
    timestamp: number;
}

export type ClientMessage = JoinMessage | MoveMessage | PingMessage;

export interface JoinAckMessage {
    type: "joinAck";
    playerId: string;
    bounds: WorldBounds;
    state: GameState;
}

export interface GameStateMessage {
    type: "gameState";
    tick: number;
    timestamp: number;
    bounds: WorldBounds;
    state: GameState;
}

export interface PlayerDisconnectMessage {
    type: "playerDisconnect";
    playerId: string;
}

export interface PongMessage {
    type: "pong";
    timestamp: number;
    serverTime: number;
}

export interface ErrorMessage {
    type: "error";
    message: string;
}

export type ServerMessage =
    | JoinAckMessage
    | GameStateMessage
    | PlayerDisconnectMessage
    | PongMessage
    | ErrorMessage;