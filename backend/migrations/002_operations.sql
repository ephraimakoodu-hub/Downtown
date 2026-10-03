-- Migration 002: settings, order details, status history, password resets, extra permissions.

CREATE TABLE settings (
  setting_key VARCHAR(60) NOT NULL PRIMARY KEY,
  setting_value VARCHAR(500) NULL,
  updated_by BIGINT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Empty values mean "not configured". Delivery and pickup stay off until the business sets them.
INSERT INTO settings (setting_key, setting_value) VALUES
  ('delivery_enabled', 'false'),
  ('delivery_fee_kobo', NULL),
  ('pickup_enabled', 'false'),
  ('max_items_per_order', '100');

ALTER TABLE orders
  ADD COLUMN contact_phone VARCHAR(30) NOT NULL DEFAULT '' AFTER fulfilment,
  ADD COLUMN delivery_address VARCHAR(300) NULL AFTER contact_phone,
  ADD COLUMN stock_committed TINYINT(1) NOT NULL DEFAULT 0 AFTER total_kobo,
  ADD COLUMN location_id SMALLINT UNSIGNED NULL AFTER stock_committed,
  ADD FOREIGN KEY (location_id) REFERENCES locations(id);

ALTER TABLE payments ADD COLUMN method VARCHAR(30) NOT NULL DEFAULT 'provider' AFTER provider;

CREATE TABLE order_status_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  from_status VARCHAR(20) NULL,
  to_status VARCHAR(20) NOT NULL,
  changed_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_history_order (order_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE password_resets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_resets_user (user_id)
) ENGINE=InnoDB;

INSERT INTO permissions (code) VALUES ('suppliers.manage'), ('purchasing.manage'), ('customers.read');
INSERT INTO role_permissions SELECT r.id, p.id FROM roles r JOIN permissions p
  WHERE r.name IN ('administrator','manager') AND p.code IN ('suppliers.manage','purchasing.manage','customers.read');
INSERT INTO role_permissions SELECT r.id, p.id FROM roles r JOIN permissions p
  WHERE r.name = 'inventory_staff' AND p.code IN ('suppliers.manage','purchasing.manage');
