
import { Router } from 'express';
import express from 'express';
import { verifySignature } from '../utils/signature.js';
import { withTransaction } from '../config/db.js';
import { getSettings } from '../utils/settings.js';
import { logger } from '../utils/logger.js';

// Customer payment routes.
// Customers can submit a transfer reference, but cannot confirm their own payment.
export function paymentsRouter(env, pool) {
  const r = Router();

  // Get bank-transfer instructions for an order.
  r.get('/:ref/payment-instructions', async (req, res, next) => {
    try {
      const result = await withTransaction(pool, async (conn) => {
        const [[order]] = await conn.execute(
          `SELECT id, public_ref, total_kobo, status
           FROM orders
           WHERE public_ref = ? AND user_id = ?
           LIMIT 1`,
          [req.params.ref, req.user.id]
        );

        if (!order) return { error: 'NOT_FOUND' };

        if (order.status === 'cancelled') {
          return { error: 'ORDER_CANCELLED' };
        }

        const settings = await getSettings(conn);

        if (!settings.bankTransferEnabled) {
          return { error: 'BANK_TRANSFER_DISABLED' };
        }

        const [[payment]] = await conn.execute(
          `SELECT status, provider_reference
           FROM payments
           WHERE order_id = ? AND provider = 'manual'
           ORDER BY id DESC
           LIMIT 1`,
          [order.id]
        );

        return {
          orderRef: order.public_ref,
          amountKobo: Number(order.total_kobo),
          bankTransferEnabled: true,
          bankName: settings.bankName,
          bankAccountName: settings.bankAccountName,
          bankAccountNumber: settings.bankAccountNumber,
          paymentStatus: payment?.status || 'not_submitted',
        };
      });

      if (result.error === 'NOT_FOUND') {
        return res.status(404).json({
          error: { code: 'ORDER_NOT_FOUND', message: 'Order not found.' },
        });
      }

      if (result.error === 'ORDER_CANCELLED') {
        return res.status(409).json({
          error: { code: 'ORDER_CANCELLED', message: 'This order has been cancelled.' },
        });
      }

      if (result.error === 'BANK_TRANSFER_DISABLED') {
        return res.status(403).json({
          error: { code: 'BANK_TRANSFER_DISABLED', message: 'Bank transfers are not currently available.' },
        });
      }

      return res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Submit a bank-transfer transaction reference.
  r.post('/:ref/pay', async (req, res, next) => {
    try {
      const providerReference =
        typeof req.body?.providerReference === 'string'
          ? req.body.providerReference.trim()
          : '';

      if (
        providerReference.length < 4 ||
        providerReference.length > 120
      ) {
        return res.status(400).json({
          error: {
            code: 'INVALID_REFERENCE',
            message: 'Enter a transaction reference between 4 and 120 characters.',
          },
        });
      }

      const result = await withTransaction(pool, async (conn) => {
        const [[order]] = await conn.execute(
          `SELECT id, public_ref, total_kobo, status
           FROM orders
           WHERE public_ref = ? AND user_id = ?
           FOR UPDATE`,
          [req.params.ref, req.user.id]
        );

        if (!order) return { error: 'NOT_FOUND' };

        if (order.status === 'cancelled') {
          return { error: 'ORDER_CANCELLED' };
        }

        const settings = await getSettings(conn);

        if (!settings.bankTransferEnabled) {
          return { error: 'BANK_TRANSFER_DISABLED' };
        }

        const [[existing]] = await conn.execute(
          `SELECT id, status
           FROM payments
           WHERE order_id = ?
             AND provider = 'manual'
             AND status IN ('pending', 'succeeded')
           LIMIT 1
           FOR UPDATE`,
          [order.id]
        );

        if (existing?.status === 'succeeded') {
          return { error: 'ALREADY_PAID' };
        }

        if (existing?.status === 'pending') {
          return { error: 'PAYMENT_PENDING' };
        }

        await conn.execute(
          `INSERT INTO payments
            (order_id, provider, method, provider_reference, amount_kobo, status)
           VALUES (?, 'manual', 'bank_transfer', ?, ?, 'pending')`,
          [
            order.id,
            providerReference,
            Number(order.total_kobo),
          ]
        );

        return {
          orderRef: order.public_ref,
          paymentStatus: 'pending',
          message: 'Transfer reference submitted. Your payment is awaiting verification.',
        };
      });

      if (result.error === 'NOT_FOUND') {
        return res.status(404).json({
          error: { code: 'ORDER_NOT_FOUND', message: 'Order not found.' },
        });
      }

      if (result.error === 'ORDER_CANCELLED') {
        return res.status(409).json({
          error: { code: 'ORDER_CANCELLED', message: 'This order has been cancelled.' },
        });
      }

      if (result.error === 'BANK_TRANSFER_DISABLED') {
        return res.status(403).json({
          error: { code: 'BANK_TRANSFER_DISABLED', message: 'Bank transfers are not currently available.' },
        });
      }

      if (result.error === 'ALREADY_PAID') {
        return res.status(409).json({
          error: { code: 'ALREADY_PAID', message: 'This order has already been paid.' },
        });
      }

      if (result.error === 'PAYMENT_PENDING') {
        return res.status(409).json({
          error: { code: 'PAYMENT_PENDING', message: 'A transfer reference is already awaiting verification.' },
        });
      }

      return res.status(201).json(result);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          error: {
            code: 'REFERENCE_ALREADY_USED',
            message: 'This transaction reference has already been submitted.',
          },
        });
      }

      next(err);
    }
  });

  return r;
}

// Payment webhook.
// Keep this mounted before express.json so the raw request body is available.
export function paymentWebhookRouter(env, pool) {
  const r = Router();

  r.post(
    '/',
    express.raw({ type: 'application/json', limit: '50kb' }),
    async (req, res, next) => {
      try {
        if (!env.PAYMENT_WEBHOOK_SECRET || !env.PAYMENT_PROVIDER) {
          return res.status(503).json({
            error: {
              code: 'PAYMENT_NOT_CONFIGURED',
              message: 'Payments are not configured.',
              requestId: req.id,
            },
          });
        }

        const signature = req.get('x-signature');

        if (
          !Buffer.isBuffer(req.body) ||
          !verifySignature(req.body, signature, env.PAYMENT_WEBHOOK_SECRET)
        ) {
          logger.warn('webhook_bad_signature', { requestId: req.id });

          return res.status(401).json({
            error: {
              code: 'BAD_SIGNATURE',
              message: 'Signature check failed.',
              requestId: req.id,
            },
          });
        }

        let evt;

        try {
          evt = JSON.parse(req.body.toString('utf8'));
        } catch {
          return res.status(400).json({
            error: {
              code: 'BAD_JSON',
              message: 'Unreadable payload.',
              requestId: req.id,
            },
          });
        }

        const { reference, orderRef, amountKobo, status } = evt || {};

        if (
          typeof reference !== 'string' ||
          typeof orderRef !== 'string' ||
          !Number.isInteger(amountKobo) ||
          !['succeeded', 'failed'].includes(status)
        ) {
          return res.status(400).json({
            error: {
              code: 'BAD_PAYLOAD',
              message: 'Unexpected payload.',
              requestId: req.id,
            },
          });
        }

        await withTransaction(pool, async (conn) => {
          const [[order]] = await conn.execute(
            `SELECT id, total_kobo, status
             FROM orders
             WHERE public_ref = ?
             FOR UPDATE`,
            [orderRef]
          );

          if (!order) return;

          const [ins] = await conn.execute(
            `INSERT IGNORE INTO payments
              (order_id, provider, method, provider_reference, amount_kobo, status)
             VALUES (?, ?, 'provider', ?, ?, 'pending')`,
            [
              order.id,
              env.PAYMENT_PROVIDER,
              reference,
              amountKobo,
            ]
          );

          if (!ins.affectedRows) return;

          const ok =
            status === 'succeeded' &&
            amountKobo === Number(order.total_kobo) &&
            order.status !== 'cancelled';

          await conn.execute(
            `UPDATE payments
             SET status = ?
             WHERE provider = ? AND provider_reference = ?`,
            [
              ok ? 'succeeded' : 'failed',
              env.PAYMENT_PROVIDER,
              reference,
            ]
          );

          if (status === 'succeeded' && !ok) {
            logger.warn('webhook_amount_mismatch', {
              orderId: order.id,
            });
          }
        });

        return res.status(200).json({ received: true });
      } catch (err) {
        next(err);
      }
    }
  );

  return r;
}