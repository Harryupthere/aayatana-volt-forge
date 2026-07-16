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
      ON UPDATE CURRENT_TIMESTAMP
);

create table passport_blockchain_records(
id BIGINT  UNSIGNED AUTO_INCREMENT PRIMARY KEY,
company_id BIGINT UNSIGNED NOT NULL,
passport_id BIGINT UNSIGNED NOT NULL,
passport_number VARCHAR(255),
passport_hash VARCHAR(255),
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
      ON UPDATE CURRENT_TIMESTAMP
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
     'add_company'
) default  'create_passport',
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


