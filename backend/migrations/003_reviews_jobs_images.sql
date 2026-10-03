-- Migration 003: email verification, product image metadata, reviews, background jobs.

CREATE TABLE email_verifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_email_verif_user (user_id)
) ENGINE=InnoDB;

-- Tracks where a product image came from and whether staff confirmed the business has rights to use it.
ALTER TABLE products
  ADD COLUMN image_source ENUM('upload','url') NULL AFTER image_url,
  ADD COLUMN image_rights_confirmed TINYINT(1) NOT NULL DEFAULT 0 AFTER image_source,
  ADD COLUMN image_credit VARCHAR(255) NULL AFTER image_rights_confirmed;

CREATE TABLE reviews (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  body VARCHAR(2000) NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  moderated_by BIGINT UNSIGNED NULL,
  moderated_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (moderated_by) REFERENCES users(id) ON DELETE SET NULL,
  CHECK (rating BETWEEN 1 AND 5),
  -- One review per product per order: a real purchase can only be reviewed once, which limits fake/repeat reviews.
  UNIQUE KEY uq_review_order_product (order_id, product_id),
  INDEX idx_reviews_product_status (product_id, status)
) ENGINE=InnoDB;

INSERT INTO permissions (code) VALUES ('reviews.moderate');
INSERT INTO role_permissions SELECT r.id, p.id FROM roles r JOIN permissions p WHERE r.name IN ('administrator','manager') AND p.code = 'reviews.moderate';

-- Durable background job queue, polled by src/jobs/worker.js. Survives a process restart, unlike an in-memory queue.
CREATE TABLE jobs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(60) NOT NULL,
  payload JSON NOT NULL,
  status ENUM('pending','processing','done','failed') NOT NULL DEFAULT 'pending',
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  max_attempts TINYINT UNSIGNED NOT NULL DEFAULT 5,
  run_after DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_error VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_jobs_poll (status, run_after)
) ENGINE=InnoDB;
