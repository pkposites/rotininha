// Simulador LOCAL do Mercado Pago (só desenvolvimento). Uso: node scripts/mock-mp.mjs
//   POST /v1/payments        cria Pix pendente        GET /v1/payments/:id   consulta
//   POST /__set/:id {status} muda o status             GET /__last            id do último pagamento
import http from 'node:http';
const PORT = Number(process.env.MP_PORT ?? 19877);
const payments = new Map(); let seq = Date.now();
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
  const send = (st, o) => { res.writeHead(st, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (req.method === 'POST' && req.url === '/v1/payments') {
    if (!req.headers['x-idempotency-key']) return send(400, { message: 'X-Idempotency-Key obrigatório' });
    if (body.payment_method_id !== 'pix' || !body.payer?.email || !body.payer?.identification?.number) return send(400, { message: 'dados do pagador' });
    const id = String(++seq);
    // PNG 1x1 válido, só para o <img> renderizar no teste
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const p = { id, status: 'pending', transaction_amount: body.transaction_amount, currency_id: 'BRL', payment_method_id: 'pix',
      external_reference: body.external_reference, point_of_interaction: { transaction_data: { qr_code: '00020126PIXSIMULADO' + id, qr_base64: png } } };
    payments.set(id, p); return send(201, p);
  }
  const m = /^\/v1\/payments\/(\w+)$/.exec(req.url);
  if (req.method === 'GET' && m) return payments.has(m[1]) ? send(200, payments.get(m[1])) : send(404, {});
  if (req.method === 'POST' && req.url.startsWith('/__set/')) { Object.assign(payments.get(req.url.split('/')[2]), body); return send(200, {}); }
  if (req.method === 'GET' && req.url === '/__last') return send(200, { id: String(seq) });
  send(404, {});
}).listen(PORT, () => console.log('mock MP em http://localhost:' + PORT));
