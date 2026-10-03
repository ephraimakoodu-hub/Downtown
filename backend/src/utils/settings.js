
export async function getSettings(conn) {
  const [rows] = await conn.execute(
    'SELECT setting_key, setting_value FROM settings'
  );

  const m = Object.fromEntries(
    rows.map((r) => [r.setting_key, r.setting_value])
  );

  return {
    deliveryEnabled: m.delivery_enabled === 'true',
    deliveryFeeKobo:
      m.delivery_fee_kobo == null
        ? null
        : Number(m.delivery_fee_kobo),
    pickupEnabled: m.pickup_enabled === 'true',
    maxItemsPerOrder: Number(m.max_items_per_order || 100),

    // Manual bank transfer settings
    bankTransferEnabled: m.bank_transfer_enabled === 'true',
    bankName: m.bank_name || '',
    bankAccountName: m.bank_account_name || '',
    bankAccountNumber: m.bank_account_number || '',
  };
}