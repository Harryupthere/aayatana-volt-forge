create database aayatana;
use aayatana;


create table admins(
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name  varchar(100) not null,
    email varchar(250) not null,
    wallet_address text,
    encrypted_pk text,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP
);

create table plans(
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name  varchar(100) not null,
    total_passports int default 0,
    polygon_quantity DECIMAL(36,18) default 0,
    status enum('active','inactive') default 'active',
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP
);


create table company_registrtion(
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name  varchar(100) not null,
    address text not null,
    is_approved enum('yes','no') default 'no',
    status enum('active','inactive') default 'active',
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP
);

create table company_application(
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
     company_id BIGINT UNSIGNED NOT NULL,
    plan_id BIGINT UNSIGNED NOT NULL,
    is_approved enum('yes','no') default 'no',
    status enum('active','inactive') default 'active',
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP
);


create table company_wallets(
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT UNSIGNED,
    wallet_address  text not null,
    encrypted_pk text not null,
    current_balance DECIMAL(36,18) default 0,
    status enum('active','inactive') default 'active',
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_company_wallets_company_id (company_id)
);


create table wallet_funding_logs(
id BIGINT  UNSIGNED AUTO_INCREMENT PRIMARY KEY,
company_id BIGINT UNSIGNED NOT NULL,
wallet_address VARCHAR(255),
amount DECIMAL(36,18) default 0,
transaction_hash VARCHAR(255),
funded_by BIGINT,
remarks TEXT,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP
);

create table passports(
id BIGINT  UNSIGNED AUTO_INCREMENT PRIMARY KEY,
company_id BIGINT UNSIGNED NOT NULL,
passport_number VARCHAR(255),
passport_hash VARCHAR(255),
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_passports_company_id (company_id)
);

create table passport_blockchain_records(
id BIGINT  UNSIGNED AUTO_INCREMENT PRIMARY KEY,
company_id BIGINT UNSIGNED NOT NULL,
passport_id BIGINT UNSIGNED NOT NULL,
passport_number VARCHAR(255),
passport_hash VARCHAR(255),
registration_mode ENUM('individual','batch') NOT NULL DEFAULT 'individual',
latest_public_data_hash VARCHAR(255),
current_version INT,
issuer_wallet text,
responsible_wallet text,
created_tx_hash text,
created_block_number BIGINT,
contract_address text,
status ENUM(
    'pending',
    'processing',
    'completed',
    'failed'
)
default 'pending',
is_active TINYINT(1) default 1,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_blockchain_records_passport_id (passport_id),
    INDEX idx_blockchain_records_company_id (company_id)
);

create table blockchain_transaction_queue(
id BIGINT  UNSIGNED AUTO_INCREMENT PRIMARY KEY,
company_id BIGINT UNSIGNED NOT NULL,
passport_id BIGINT UNSIGNED,
passport_blockchain_record_id BIGINT UNSIGNED,
transaction_type ENUM(
    'create_passport',
    'update_passport',
    'transfer_responsibility',
    'fund_wallet',
    'add_company',
    'create_passport_batch',
    'deactivate_passport_batch'
) default 'create_passport',
payload JSON,
status ENUM(
    'pending',
    'processing',
    'completed',
    'failed'
) default 'pending',
retry_count INT default 3,
error_message TEXT,
transaction_hash text,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP
);

-- Merkle batch metadata. One row per on-chain Merkle root.
create table passport_batches(
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    batch_id CHAR(66) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
    company_id BIGINT UNSIGNED NOT NULL,
    merkle_root CHAR(66) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    passport_count INT UNSIGNED NOT NULL,
    issuer_wallet VARCHAR(42) NOT NULL,
    contract_address VARCHAR(42),
    created_tx_hash VARCHAR(66),
    created_block_number BIGINT UNSIGNED,
    status ENUM('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_passport_batches_company_id (company_id),
    INDEX idx_passport_batches_status (status),
    INDEX idx_passport_batches_created_at (created_at)
);

-- Off-chain batch membership and proofs. The passport leaf/hash is verified against
-- passport_batches.merkle_root; the individual Passport mapping is not populated on-chain.
create table passport_batch_items(
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    passport_batch_id BIGINT UNSIGNED NOT NULL,
    passport_id BIGINT UNSIGNED NOT NULL,
    passport_blockchain_record_id BIGINT UNSIGNED,
    passport_hash CHAR(66) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    merkle_proof JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_batch_passport (passport_batch_id, passport_id),
    UNIQUE KEY uq_batch_record (passport_batch_id, passport_blockchain_record_id),
    INDEX idx_batch_items_passport_id (passport_id),
    INDEX idx_batch_items_record_id (passport_blockchain_record_id),
    CONSTRAINT fk_batch_items_batch
      FOREIGN KEY (passport_batch_id) REFERENCES passport_batches(id)
      ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_batch_items_blockchain_record
      FOREIGN KEY (passport_blockchain_record_id) REFERENCES passport_blockchain_records(id)
      ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_batch_items_passport
      FOREIGN KEY (passport_id) REFERENCES passports(id)
      ON DELETE RESTRICT ON UPDATE CASCADE
);

