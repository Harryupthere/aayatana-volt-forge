-- MySQL dump 10.13  Distrib 8.0.41, for macos15 (x86_64)
--
-- Host: 127.0.0.1    Database: aayatana
-- ------------------------------------------------------
-- Server version	9.2.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `admins`
--

DROP TABLE IF EXISTS `admins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admins` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `email` varchar(250) NOT NULL,
  `wallet_address` text,
  `encrypted_pk` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admins`
--

LOCK TABLES `admins` WRITE;
/*!40000 ALTER TABLE `admins` DISABLE KEYS */;
INSERT INTO `admins` VALUES (1,'Super Admin','admin@volt-forge.io','0x497Ed6653a604b47c8a555D6b2Ae7A74AcB4Da2e','b0832080b5b1ed7129e2303d:b3fbfd41262b992a92a6b3952ab3d214:b29b5cc82ea76bf4ef46a461a0d355cd5e27c2abda2531bcb3f3f018a91bc9f6e223350409dfa670cfb14c58b50f745a58546528d869219bbfcc353db594e4730605','2026-07-16 18:17:17','2026-07-16 18:17:25');
/*!40000 ALTER TABLE `admins` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `blockchain_transaction_queue`
--

DROP TABLE IF EXISTS `blockchain_transaction_queue`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `blockchain_transaction_queue` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `company_id` bigint unsigned NOT NULL,
  `passport_id` bigint unsigned DEFAULT NULL,
  `passport_blockchain_record_id` bigint unsigned DEFAULT NULL,
  `payload` json DEFAULT NULL,
  `status` enum('pending','processing','completed','failed') DEFAULT 'pending',
  `retry_count` int DEFAULT '3',
  `error_message` text,
  `transaction_hash` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `transaction_type` enum('create_passport','update_passport','transfer_responsibility','fund_wallet','add_company') DEFAULT 'create_passport',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `blockchain_transaction_queue`
--

LOCK TABLES `blockchain_transaction_queue` WRITE;
/*!40000 ALTER TABLE `blockchain_transaction_queue` DISABLE KEYS */;
INSERT INTO `blockchain_transaction_queue` VALUES (1,1,NULL,NULL,'{\"admin_id\": 1, \"application_id\": 1, \"company_wallet_id\": 1, \"company_wallet_address\": \"0x267283236cF79D2f7913E1bfeD0A09E61Be6cef8\"}','completed',3,NULL,'0x423e33c661193fa9ff3e1a419a58a706b83b356ba3038b7e402c0feb9566b44d','2026-07-16 18:17:39','2026-07-16 18:18:50','add_company'),(2,1,NULL,NULL,'{\"amount\": \"0.000100000000000000\", \"plan_id\": 1, \"admin_id\": 1, \"application_id\": 1, \"company_wallet_id\": 1, \"company_wallet_address\": \"0x267283236cF79D2f7913E1bfeD0A09E61Be6cef8\"}','completed',3,NULL,'0x3513da8a5d8cd41d3a54afe0a3738c7b723b904f2a21fad79bb10c4c0496fc70','2026-07-16 18:17:39','2026-07-16 18:20:16','fund_wallet'),(3,1,1,1,'{\"data_hash\": \"0x521650bbef124d57d820445a3b6dc47410d4c0f845b19dbe1ccba8af19595f4b\", \"passport_number\": \"BATT-0001\", \"company_wallet_id\": 1}','pending',2,'insufficient funds for intrinsic transaction cost (transaction=\"0x02f8f58301388280850df84757c1850df847583f83032abb9460f3ef5cc75687440f9e670fe40f8e1854002ae580b884a5d23e260000000000000000000000000000000000000000000000000000000000000040521650bbef124d57d820445a3b6dc47410d4c0f845b19dbe1ccba8af19595f4b0000000000000000000000000000000000000000000000000000000000000009424154542d303030310000000000000000000000000000000000000000000000c080a0c11f696476529564ac78519df5889df3aa974dad1973dbbadf78b19b626c6a67a03ef847c1727c9def524d19f23f4964483e744ecca4af47d52563df0befb6f42a\", info={ \"error\": { \"code\": -32000, \"message\": \"insufficient funds for gas * price + value: balance 100000000000000, tx cost 12452820013075461, overshot 12352820013075461\" } }, code=INSUFFICIENT_FUNDS, version=6.17.0)',NULL,'2026-07-16 18:55:39','2026-07-16 18:58:11','create_passport');
/*!40000 ALTER TABLE `blockchain_transaction_queue` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `company_application`
--

DROP TABLE IF EXISTS `company_application`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `company_application` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `company_id` bigint unsigned NOT NULL,
  `plan_id` bigint unsigned NOT NULL,
  `is_approved` enum('yes','no') DEFAULT 'no',
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `company_application`
--

LOCK TABLES `company_application` WRITE;
/*!40000 ALTER TABLE `company_application` DISABLE KEYS */;
INSERT INTO `company_application` VALUES (1,1,1,'yes','active','2026-07-16 18:15:12','2026-07-16 18:15:41');
/*!40000 ALTER TABLE `company_application` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `company_registrtion`
--

DROP TABLE IF EXISTS `company_registrtion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `company_registrtion` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `address` text NOT NULL,
  `is_approved` enum('yes','no') DEFAULT 'no',
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `company_registrtion`
--

LOCK TABLES `company_registrtion` WRITE;
/*!40000 ALTER TABLE `company_registrtion` DISABLE KEYS */;
INSERT INTO `company_registrtion` VALUES (1,'Acme Corp','123 Main St, Springfield','yes','active','2026-07-16 18:14:26','2026-07-16 18:15:25');
/*!40000 ALTER TABLE `company_registrtion` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `company_wallets`
--

DROP TABLE IF EXISTS `company_wallets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `company_wallets` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `company_id` bigint unsigned DEFAULT NULL,
  `wallet_address` text NOT NULL,
  `encrypted_pk` text NOT NULL,
  `current_balance` decimal(36,18) DEFAULT '0.000000000000000000',
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_company_wallets_company_id` (`company_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `company_wallets`
--

LOCK TABLES `company_wallets` WRITE;
/*!40000 ALTER TABLE `company_wallets` DISABLE KEYS */;
INSERT INTO `company_wallets` VALUES (1,1,'0x267283236cF79D2f7913E1bfeD0A09E61Be6cef8','aa363b9dd1d2468457b50557:facb4a94ab9db990a81f03f27562f448:afaab1316154d20b9e637ffae0a3496e87dc233900709b82667cddffab8bc1f04b1874bdf242d48385e442910a42a91df507e068b2ded19a91c4c0cc3efd014ea59b',0.000100000000000000,'active','2026-07-16 18:17:39','2026-07-16 18:20:16');
/*!40000 ALTER TABLE `company_wallets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `passport_blockchain_records`
--

DROP TABLE IF EXISTS `passport_blockchain_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `passport_blockchain_records` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `company_id` bigint unsigned NOT NULL,
  `passport_id` bigint unsigned NOT NULL,
  `passport_number` varchar(255) DEFAULT NULL,
  `passport_hash` varchar(255) DEFAULT NULL,
  `latest_public_data_hash` varchar(255) DEFAULT NULL,
  `current_version` int DEFAULT NULL,
  `issuer_wallet` text,
  `responsible_wallet` text,
  `created_tx_hash` text,
  `created_block_number` bigint DEFAULT NULL,
  `contract_address` text,
  `status` enum('pending','processing','completed','failed') DEFAULT 'pending',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `passport_blockchain_records`
--

LOCK TABLES `passport_blockchain_records` WRITE;
/*!40000 ALTER TABLE `passport_blockchain_records` DISABLE KEYS */;
INSERT INTO `passport_blockchain_records` VALUES (1,1,1,'BATT-0001','0x521650bbef124d57d820445a3b6dc47410d4c0f845b19dbe1ccba8af19595f4b',NULL,1,'0x267283236cF79D2f7913E1bfeD0A09E61Be6cef8','0x267283236cF79D2f7913E1bfeD0A09E61Be6cef8',NULL,NULL,NULL,'pending',1,'2026-07-16 18:55:38','2026-07-16 18:55:38');
/*!40000 ALTER TABLE `passport_blockchain_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `passports`
--

DROP TABLE IF EXISTS `passports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `passports` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `company_id` bigint unsigned NOT NULL,
  `passport_number` varchar(255) DEFAULT NULL,
  `passport_hash` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `passports`
--

LOCK TABLES `passports` WRITE;
/*!40000 ALTER TABLE `passports` DISABLE KEYS */;
INSERT INTO `passports` VALUES (1,1,'BATT-0001','0x521650bbef124d57d820445a3b6dc47410d4c0f845b19dbe1ccba8af19595f4b','2026-07-16 18:55:38','2026-07-16 18:55:38');
/*!40000 ALTER TABLE `passports` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `plans`
--

DROP TABLE IF EXISTS `plans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `plans` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `total_passports` int DEFAULT '0',
  `polygon_quantity` decimal(36,18) DEFAULT '0.000000000000000000',
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `plans`
--

LOCK TABLES `plans` WRITE;
/*!40000 ALTER TABLE `plans` DISABLE KEYS */;
INSERT INTO `plans` VALUES (1,'Starter',100,0.000100000000000000,'active','2026-07-16 18:15:05','2026-07-16 18:15:05');
/*!40000 ALTER TABLE `plans` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `wallet_funding_logs`
--

DROP TABLE IF EXISTS `wallet_funding_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wallet_funding_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `company_id` bigint unsigned NOT NULL,
  `wallet_address` varchar(255) DEFAULT NULL,
  `amount` decimal(36,18) DEFAULT '0.000000000000000000',
  `transaction_hash` varchar(255) DEFAULT NULL,
  `funded_by` bigint DEFAULT NULL,
  `remarks` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `wallet_funding_logs`
--

LOCK TABLES `wallet_funding_logs` WRITE;
/*!40000 ALTER TABLE `wallet_funding_logs` DISABLE KEYS */;
INSERT INTO `wallet_funding_logs` VALUES (1,1,'0x267283236cF79D2f7913E1bfeD0A09E61Be6cef8',0.000100000000000000,'0x3513da8a5d8cd41d3a54afe0a3738c7b723b904f2a21fad79bb10c4c0496fc70',1,'Auto-funded on application approval','2026-07-16 18:20:16','2026-07-16 18:20:16');
/*!40000 ALTER TABLE `wallet_funding_logs` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-17  0:29:20
