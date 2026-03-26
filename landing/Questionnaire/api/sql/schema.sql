CREATE TABLE IF NOT EXISTS `survey_responses` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(120) NOT NULL,
  `contact` VARCHAR(190) NOT NULL,
  `role` VARCHAR(120) NOT NULL DEFAULT 'Unknown',
  `device_type` ENUM('Android','iOS','Desktop') NOT NULL DEFAULT 'Desktop',
  `ip` VARCHAR(45) NOT NULL,
  `city` VARCHAR(120) NOT NULL DEFAULT 'Unknown',
  `country_code` CHAR(2) DEFAULT NULL,
  `user_agent` VARCHAR(512) NOT NULL DEFAULT '',
  `answers_json` JSON NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_role` (`role`),
  KEY `idx_device_type` (`device_type`),
  KEY `idx_city` (`city`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
