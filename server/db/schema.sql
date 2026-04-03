CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) PRIMARY KEY,
    username VARCHAR(30) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS games (
    id CHAR(36) PRIMARY KEY,
    player1_id CHAR(36),
    player2_id CHAR(36),
    mode VARCHAR(20) NOT NULL,
    winner_id CHAR(36),
    winner_anonymous BOOLEAN DEFAULT FALSE,
    turns INTEGER,
    player1_accuracy DECIMAL(5,2),
    player2_accuracy DECIMAL(5,2),
    duration_seconds INTEGER,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP NULL,
    FOREIGN KEY (player1_id) REFERENCES users(id),
    FOREIGN KEY (player2_id) REFERENCES users(id),
    FOREIGN KEY (winner_id) REFERENCES users(id),
    INDEX idx_games_player1 (player1_id),
    INDEX idx_games_player2 (player2_id),
    INDEX idx_games_mode (mode)
);
